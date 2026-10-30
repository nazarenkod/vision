import {
  Controller,
  UseGuards,
  Param,
  ParseUUIDPipe,
  Body,
  Get,
  Query,
  Post,
  ParseBoolPipe,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  Logger,
  Patch,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
  ApiSecurity,
  ApiOkResponse,
  ApiConsumes,
  ApiBody,
  ApiOperation,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Role, TestRun, TestStatus, User } from '@prisma/client';
import { TestRunsService } from './test-runs.service';
import { TestRunResultDto } from './dto/testRunResult.dto';
import { ApiGuard } from '../auth/guards/api.guard';
import { fromVisionCli } from '../projects/allowed-devices';
import { MixedGuard } from '../auth/guards/mixed.guard';
import { TestRunDto } from './dto/testRun.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateTestRequestBase64Dto } from './dto/create-test-request-base64.dto';
import { CreateTestRequestMultipartDto } from './dto/create-test-request-multipart.dto';
import { FileToBodyInterceptor } from '../shared/fite-to-body.interceptor';
import { UpdateIgnoreAreasDto } from './dto/update-ignore-area.dto';
import { UpdateTestRunDto } from './dto/update-test.dto';
import { CurrentUser } from '../shared/current-user.decorator';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../shared/roles.decorator';
import { A11yIssuesService } from '../a11y/a11y-issues.service';
import { ChangeGroupsService } from './change-groups.service';
import { DecisionUndoService } from './decision-undo.service';
import { AddElementRuleDto, RemoveElementRuleDto, ReplaceAreaWithElementDto } from './dto/element-rule.dto';
import {
  A11yIssueRefDto,
  FileA11yBugDto,
  PrepareA11yBugDto,
  IgnoreA11yIssueDto,
  LinkA11yIssueDto,
  issueIds,
} from '../a11y/a11y-issue.dto';

@ApiTags('test-runs')
@Controller('test-runs')
export class TestRunsController {
  private readonly logger: Logger = new Logger(TestRunsController.name);

  constructor(
    private testRunsService: TestRunsService,
    private a11yIssuesService: A11yIssuesService,
    private changeGroupsService: ChangeGroupsService,
    private decisionUndoService: DecisionUndoService
  ) {}

  @Get()
  @ApiOkResponse({ type: TestRunDto, isArray: true })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  get(@Query('buildId', new ParseUUIDPipe()) buildId: string): Promise<TestRunDto[]> {
    return this.testRunsService.findMany(buildId);
  }

  @Get('groups')
  @ApiOkResponse({ description: 'Screenshots of the build that need a decision, grouped by the change they carry' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getGroups(@Query('buildId', new ParseUUIDPipe()) buildId: string) {
    return this.changeGroupsService.getGroups(buildId);
  }

  @Get(':id')
  @ApiOkResponse({ type: TestRunDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getDetails(@Param('id', new ParseUUIDPipe()) id: string): Promise<TestRunDto> {
    return this.testRunsService.findOne(id);
  }

  @Get(':id/a11y')
  @ApiOkResponse({ description: 'Accessibility report built from the UI tree; null when none was sent' })
  @ApiBearerAuth()
  @UseGuards(MixedGuard)
  getAccessibility(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.testRunsService.getAccessibilityReport(id, user?.id);
  }

  @Post(':id/a11y/ignore')
  @ApiOkResponse({ description: 'Marks the issue as a false positive on this screen' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  ignoreA11yIssue(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: IgnoreA11yIssueDto
  ) {
    return this.a11yIssuesService.ignore(id, issueIds(body), body.comment, user?.id);
  }

  @Post(':id/a11y/reset')
  @ApiOkResponse({ description: 'Forgets the decision on the issue' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  resetA11yIssue(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: A11yIssueRefDto
  ) {
    return this.a11yIssuesService.reset(id, issueIds(body), user?.id);
  }

  @Post(':id/a11y/link')
  @ApiOkResponse({ description: 'Records an existing Jira issue for the problem' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  linkA11yIssue(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: LinkA11yIssueDto
  ) {
    return this.a11yIssuesService.link(id, issueIds(body), body.jiraKey, user?.id);
  }

  @Post(':id/a11y/jira/prepare')
  @ApiOkResponse({
    description: "Issue and link types of the task's Jira project, and the fields a bug under the task would get",
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  prepareA11yBug(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PrepareA11yBugDto
  ) {
    return this.a11yIssuesService.prepareBug(
      id,
      issueIds(body),
      body.parentKey,
      body.issueTypeId,
      body.fieldValues,
      user?.id
    );
  }

  @Get(':id/a11y/jira/users')
  @ApiOkResponse({ description: "People in the project's Jira matching a name, for user fields of a bug" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  findJiraUsers(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string, @Query('query') query = '') {
    return this.a11yIssuesService.findJiraUsers(id, query.slice(0, 100), user?.id);
  }

  @Post(':id/a11y/jira')
  @ApiOkResponse({ description: 'Files a Jira bug for the issue under the given task' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  fileA11yBug(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: FileA11yBugDto) {
    return this.a11yIssuesService.fileBug(
      id,
      issueIds(body),
      {
        parentKey: body.parentKey,
        issueTypeId: body.issueTypeId,
        linkType: body.linkType,
        fieldValues: body.fieldValues,
      },
      user?.id
    );
  }

  @Post(':id/element-rules')
  @ApiOkResponse({ description: 'Adds an element rule to the screen or the project and compares again' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  addElementRule(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: AddElementRuleDto) {
    return this.testRunsService.addElementRule(id, body);
  }

  @Post(':id/element-rules/remove')
  @ApiOkResponse({ description: 'Removes an element rule and compares again' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  removeElementRule(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: RemoveElementRuleDto) {
    return this.testRunsService.removeElementRule(id, body);
  }

  @Post(':id/ignore-areas/replace-with-element')
  @ApiOkResponse({ description: 'Replaces a saved ignore area with an ignore rule for the element it covers' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  replaceAreaWithElement(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: ReplaceAreaWithElementDto) {
    return this.testRunsService.replaceAreaWithElement(id, body);
  }

  @Get(':id/selector-matches')
  @ApiOkResponse({ description: 'How many elements a selector finds on the baseline and the screenshot' })
  @ApiQuery({ name: 'selector', required: true })
  @ApiBearerAuth()
  @UseGuards(MixedGuard)
  selectorMatches(@Param('id', new ParseUUIDPipe()) id: string, @Query('selector') selector: string) {
    return this.testRunsService.selectorMatches(id, selector);
  }

  @Get(':id/structure')
  @ApiOkResponse({ description: 'Element-level changes, elements under changed areas and noise hints' })
  @ApiBearerAuth()
  @UseGuards(MixedGuard)
  getStructure(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.testRunsService.getStructure(id);
  }

  @Post('approve')
  @ApiQuery({ name: 'merge', required: false })
  @ApiOkResponse({ type: undefined })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  async approveTestRun(
    @CurrentUser() user: User,
    @Body() ids: string[],
    @Query('merge', new ParseBoolPipe()) merge: boolean
  ): Promise<{ decisionId: string }> {
    this.logger.debug(`Going to approve TestRuns: ${ids}`);
    // the same upstream approve, with a journal entry for Undo
    return this.decisionUndoService.approve(ids, merge, user.id);
  }

  @Post('reject')
  @ApiOkResponse({ type: undefined })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  async reject(@CurrentUser() user: User, @Body() ids: string[]): Promise<{ decisionId: string }> {
    this.logger.debug(`Going to reject TestRuns: ${ids}`);
    return this.decisionUndoService.reject(ids, user.id);
  }

  @Post('undo/:decisionId')
  @ApiOperation({
    summary: 'Undo an approve or reject made in the last few seconds',
    description:
      'Puts the statuses and baselines back as they were before the decision. Refused (409) when anything ' +
      'changed the screenshots or their baselines since, or when the decision is too old; all or nothing.',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  undo(@CurrentUser() user: User, @Param('decisionId') decisionId: string): Promise<{ undone: number }> {
    return this.decisionUndoService.undo(decisionId, user.id);
  }

  @Post('delete')
  @ApiOkResponse({ type: undefined })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  async delete(@Body() ids: string[]): Promise<void> {
    this.logger.debug(`Going to delete TestRuns: ${ids}`);
    for (const id of ids) {
      await this.testRunsService.delete(id);
    }
  }

  @Post('ignoreAreas/update')
  @ApiOkResponse({ type: undefined })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  async updateIgnoreAreas(@Body() data: UpdateIgnoreAreasDto): Promise<void> {
    this.logger.debug(`Going to update IgnoreAreas for TestRuns: ${data.ids}`);
    for (const id of data.ids) {
      await this.testRunsService.updateIgnoreAreas(id, data.ignoreAreas);
    }
  }

  @Post('ignoreAreas/add')
  @ApiOkResponse({ type: undefined })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  async addIgnoreAreas(@Body() data: UpdateIgnoreAreasDto): Promise<void> {
    this.logger.debug(`Going to add IgnoreAreas for TestRuns: ${data.ids}`);
    for (const id of data.ids) {
      await this.testRunsService.addIgnoreAreas(id, data.ignoreAreas);
    }
  }

  @Patch('update/:testRunId')
  @ApiParam({ name: 'testRunId', required: true })
  @ApiOkResponse({ type: TestRunDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  update(@Param('testRunId', new ParseUUIDPipe()) id: string, @Body() body: UpdateTestRunDto): Promise<TestRun> {
    this.logger.debug(`Going to update TestRuns: ${id}`);
    return this.testRunsService.update(id, body);
  }

  @Post()
  @ApiSecurity('api_key')
  @ApiOkResponse({ type: TestRunResultDto })
  @UseGuards(ApiGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  postTestRun(
    @Body() createTestRequestDto: CreateTestRequestBase64Dto,
    @Headers('user-agent') userAgent?: string
  ): Promise<TestRunResultDto> {
    const imageBuffer = Buffer.from(createTestRequestDto.imageBase64, 'base64');
    return this.testRunsService.postTestRun({
      createTestRequestDto,
      imageBuffer,
      checkDevice: !fromVisionCli(userAgent),
    });
  }

  @Post('/multipart')
  @ApiSecurity('api_key')
  @ApiBody({ type: CreateTestRequestMultipartDto })
  @ApiOkResponse({ type: TestRunResultDto })
  @ApiConsumes('multipart/form-data')
  @UseGuards(ApiGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  @UseInterceptors(FileInterceptor('image'), FileToBodyInterceptor)
  @UsePipes(new ValidationPipe({ transform: true, forbidUnknownValues: true }))
  postTestRunMultipart(
    @Body() createTestRequestDto: CreateTestRequestMultipartDto,
    @Headers('user-agent') userAgent?: string
  ): Promise<TestRunResultDto> {
    const imageBuffer = createTestRequestDto.image.buffer;
    return this.testRunsService.postTestRun({
      createTestRequestDto,
      imageBuffer,
      checkDevice: !fromVisionCli(userAgent),
    });
  }
}
