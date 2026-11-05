import { Controller, Get, UseGuards, Body, Post, Param, ParseUUIDPipe, Delete, Put, Logger } from '@nestjs/common';
import { User } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { ProjectsService, toPublicProject } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { Role } from '@prisma/client';
import { ProjectDto } from './dto/project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../shared/roles.decorator';
import { A11yIssuesService } from '../a11y/a11y-issues.service';
import { NoProjectData, ProjectFrom, inBody, inParam } from './project-access';
import { ProjectAccessService, ProjectMember } from './project-access.service';
import { CurrentUser } from '../shared/current-user.decorator';
import { EventsGateway } from '../shared/events/events.gateway';

@Controller('projects')
@ApiTags('projects')
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(
    private projectsService: ProjectsService,
    private a11yIssuesService: A11yIssuesService,
    private projectAccess: ProjectAccessService,
    private eventsGateway: EventsGateway
  ) {}

  @NoProjectData()
  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: ProjectDto, isArray: true })
  // an admin sees every project, anyone else the ones they were given (REQ-042-01, 04)
  async getAll(@CurrentUser() user: User) {
    const projects = await this.projectsService.findAll();
    const granted = user.role === Role.admin ? null : await this.projectAccess.grantedTo(user.id);
    return projects.filter((project) => !granted || granted.has(project.id)).map(toPublicProject);
  }

  @ProjectFrom(inParam('id', 'project'))
  @Get(':id/devices')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', required: true })
  devices(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.projectsService.findDevices(id);
  }

  @NoProjectData()
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  @ApiOkResponse({ type: ProjectDto })
  async create(@CurrentUser() user: User, @Body() createProjectDto: CreateProjectDto) {
    const project = await this.projectsService.create(createProjectDto);
    // an editor keeps what they made; an admin reaches every project anyway (REQ-042-07)
    if (user.role !== Role.admin) await this.projectAccess.grant(project.id, user.id, user);
    return toPublicProject(project);
  }

  @ProjectFrom(inBody('id', 'project'))
  @Put()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  @ApiOkResponse({ type: ProjectDto })
  async update(@Body() projectDto: UpdateProjectDto) {
    const project = await this.projectsService.update(projectDto);
    if (projectDto.uiTreeSettings) {
      // accessibility norms may have changed: recount the latest builds without holding up the save
      this.a11yIssuesService.recountLatestBuilds(project.id).catch((error) => {
        this.logger.warn(`Accessibility recount for ${project.id} failed: ${error}`);
      });
    }
    return toPublicProject(project);
  }

  @ProjectFrom(inParam('id', 'project'))
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  @ApiOkResponse({ type: ProjectDto })
  @ApiParam({ name: 'id', required: true })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return toPublicProject(await this.projectsService.remove(id));
  }

  /** Who may see and work in the project; admins are not listed, they reach every project (REQ-042-05). */
  @ProjectFrom(inParam('id', 'project'))
  @Get(':id/access')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin)
  access(@Param('id', new ParseUUIDPipe()) id: string): Promise<ProjectMember[]> {
    return this.projectAccess.members(id);
  }

  @ProjectFrom(inParam('id', 'project'))
  @Put(':id/access/:userId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin)
  async grant(
    @CurrentUser() admin: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) userId: string
  ): Promise<ProjectMember[]> {
    await this.projectsService.findOne(id);
    await this.projectAccess.grant(id, userId, admin);
    return this.projectAccess.members(id);
  }

  @ProjectFrom(inParam('id', 'project'))
  @Delete(':id/access/:userId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin)
  async revoke(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) userId: string
  ): Promise<ProjectMember[]> {
    await this.projectAccess.revoke(id, userId);
    // the next request is refused, and live events stop now (REQ-042-03)
    this.eventsGateway.leaveProject(userId, id);
    return this.projectAccess.members(id);
  }
}
