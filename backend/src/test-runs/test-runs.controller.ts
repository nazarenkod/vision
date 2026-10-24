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
import { A11yIssueRefDto, FileA11yBugDto, IgnoreA11yIssueDto, LinkA11yIssueDto } from '../a11y/a11y-issue.dto';

@ApiTags('test-runs')
@Controller('test-runs')
export class TestRunsController {
  private readonly logger: Logger = new Logger(TestRunsController.name);

  constructor(
    private testRunsService: TestRunsService,
    private a11yIssuesService: A11yIssuesService
  ) {}

  @Get()
  @ApiOkResponse({ type: TestRunDto, isArray: true })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  get(@Query('buildId', new ParseUUIDPipe()) buildId: string): Promise<TestRunDto[]> {
    return this.testRunsService.findMany(buildId);
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
  @UseGuards(JwtAuthGuard)
  getAccessibility(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.testRunsService.getAccessibilityReport(id);
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
    return this.a11yIssuesService.ignore(id, body.violationId, body.comment, user?.id);
  }

  @Post(':id/a11y/reset')
  @ApiOkResponse({ description: 'Forgets the decision on the issue' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  resetA11yIssue(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: A11yIssueRefDto) {
    return this.a11yIssuesService.reset(id, body.violationId);
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
    return this.a11yIssuesService.link(id, body.violationId, body.jiraKey, user?.id);
  }

  @Post(':id/a11y/jira')
  @ApiOkResponse({ description: 'Files a Jira bug for the issue, linked to the given task' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  fileA11yBug(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: FileA11yBugDto) {
    return this.a11yIssuesService.fileBug(id, body.violationId, body.parentKey, user?.id);
  }

  @Get(':id/structure')
  @ApiOkResponse({ description: 'Element-level changes, elements under changed areas and noise hints' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
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
  ): Promise<void> {
    this.logger.debug(`Going to approve TestRuns: ${ids}`);
    for (const id of ids) {
      await this.testRunsService.approve(id, merge, false, user.id);
    }
  }

  @Get('matchingSiblings/:id')
  @ApiOperation({
    summary: 'Preview the variation group of a test run for bulk review',
    description:
      'Read-only. Returns the reviewed test run together with its sibling variations in the same build ' +
      '(same name/os/device/browser/viewport/branch, differing only by customTags — e.g. locales) whose ' +
      'change matches it, plus the siblings left out (skipped) because of a different/additional change. ' +
      'Nothing is mutated: the reviewer confirms the group and then approves/rejects the chosen ids, so a ' +
      'similar-looking regression can never be accepted without a human seeing it.',
  })
  @ApiParam({ name: 'id', required: true })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getMatchingSiblings(
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<{ variations: TestRunDto[]; skipped: Array<TestRunDto & { reason: string }> }> {
    return this.testRunsService.getMatchingVariations(id);
  }

  @Post('reject')
  @ApiOkResponse({ type: undefined })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  async reject(@Body() ids: string[]): Promise<void> {
    this.logger.debug(`Going to reject TestRuns: ${ids}`);
    for (const id of ids) {
      await this.testRunsService.setStatus(id, TestStatus.failed);
    }
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
  postTestRun(@Body() createTestRequestDto: CreateTestRequestBase64Dto): Promise<TestRunResultDto> {
    const imageBuffer = Buffer.from(createTestRequestDto.imageBase64, 'base64');
    return this.testRunsService.postTestRun({
      createTestRequestDto,
      imageBuffer,
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
  postTestRunMultipart(@Body() createTestRequestDto: CreateTestRequestMultipartDto): Promise<TestRunResultDto> {
    const imageBuffer = createTestRequestDto.image.buffer;
    return this.testRunsService.postTestRun({ createTestRequestDto, imageBuffer });
  }
}
