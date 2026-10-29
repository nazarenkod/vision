import { Controller, Get, UseGuards, Body, Post, Param, ParseUUIDPipe, Delete, Put, Logger } from '@nestjs/common';
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

@Controller('projects')
@ApiTags('projects')
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(
    private projectsService: ProjectsService,
    private a11yIssuesService: A11yIssuesService
  ) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: ProjectDto, isArray: true })
  async getAll() {
    return (await this.projectsService.findAll()).map(toPublicProject);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  @ApiOkResponse({ type: ProjectDto })
  async create(@Body() createProjectDto: CreateProjectDto) {
    return toPublicProject(await this.projectsService.create(createProjectDto));
  }

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

  @Get(':id/devices')
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ description: 'Devices (os, device, browser, viewport) the project has checks on' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async devices(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.projectsService.devices(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  @ApiOkResponse({ type: ProjectDto })
  @ApiParam({ name: 'id', required: true })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return toPublicProject(await this.projectsService.remove(id));
  }
}
