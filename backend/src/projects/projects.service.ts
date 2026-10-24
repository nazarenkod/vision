import { forwardRef, HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { BuildsService } from '../builds/builds.service';
import { TestVariationsService } from '../test-variations/test-variations.service';
import { PrismaService } from '../prisma/prisma.service';
import { Project } from '@prisma/client';
import uuidAPIKey from 'uuid-apikey';
import { UpdateProjectDto } from './dto/update-project.dto';

const blankToNull = (value: string | null | undefined) =>
  value === undefined ? undefined : value?.trim() ? value.trim() : null;

/** Jira settings from a create/update payload: undefined keeps a value, empty clears it. */
function jiraFields(dto: Partial<CreateProjectDto>) {
  return {
    jiraUrl: blankToNull(dto.jiraUrl),
    jiraEmail: blankToNull(dto.jiraEmail),
    jiraToken: blankToNull(dto.jiraToken),
    jiraIssueType: blankToNull(dto.jiraIssueType),
    jiraLinkType: blankToNull(dto.jiraLinkType),
    // stored only when it parses, so a bad value can never break comparisons
    uiTreeSettings: dto.uiTreeSettings === undefined ? undefined : normalizeUiTreeSettings(dto.uiTreeSettings),
  };
}

function normalizeUiTreeSettings(value: string | null): string | null {
  if (!value) return null;
  try {
    JSON.parse(value);
    return value;
  } catch {
    throw new HttpException('uiTreeSettings must be JSON', HttpStatus.BAD_REQUEST);
  }
}

/** A project as the API returns it: the Jira token never leaves the server. */
export function toPublicProject(project: Project): Omit<Project, 'jiraToken'> & { jiraTokenSet: boolean } {
  if (!project) return project as never;
  const { jiraToken, ...rest } = project;
  return { ...rest, jiraTokenSet: !!jiraToken };
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private prismaService: PrismaService,
    @Inject(forwardRef(() => BuildsService))
    private buildsService: BuildsService,
    @Inject(forwardRef(() => TestVariationsService))
    private testVariationsService: TestVariationsService
  ) {}

  async findOne(idOrName: string): Promise<Project> {
    const isUUID = uuidAPIKey.isUUID(idOrName);
    const project: Project = await this.prismaService.project.findUnique({
      where: {
        id: isUUID ? idOrName : undefined,
        name: !isUUID ? idOrName : undefined,
      },
    });

    if (!project) {
      throw new HttpException(`Project not found`, HttpStatus.NOT_FOUND);
    }
    return project;
  }

  async findAll(): Promise<Project[]> {
    return this.prismaService.project.findMany();
  }

  async create(projectDto: CreateProjectDto): Promise<Project> {
    return this.prismaService.project.create({
      data: {
        name: projectDto.name,
        mainBranchName: projectDto.mainBranchName,
        autoApproveFeature: projectDto.autoApproveFeature,
        imageComparison: projectDto.imageComparison,
        imageComparisonConfig: projectDto.imageComparisonConfig,
        maxBuildAllowed: projectDto.maxBuildAllowed,
        maxBranchLifetime: projectDto.maxBranchLifetime,
        bulkApproveVariations: projectDto.bulkApproveVariations,
        bulkApproveGroupBy: projectDto.bulkApproveGroupBy,
        ...jiraFields(projectDto),
      },
    });
  }

  async update(projectDto: UpdateProjectDto): Promise<Project> {
    return this.prismaService.project.update({
      where: { id: projectDto.id },
      data: {
        name: projectDto.name,
        mainBranchName: projectDto.mainBranchName,
        autoApproveFeature: projectDto.autoApproveFeature,
        imageComparison: projectDto.imageComparison,
        maxBuildAllowed: projectDto.maxBuildAllowed,
        maxBranchLifetime: projectDto.maxBranchLifetime,
        imageComparisonConfig: projectDto.imageComparisonConfig,
        bulkApproveVariations: projectDto.bulkApproveVariations,
        bulkApproveGroupBy: projectDto.bulkApproveGroupBy,
        ...jiraFields(projectDto),
      },
    });
  }

  async remove(id: string): Promise<Project> {
    this.logger.debug(`Going to remove Project ${id}`);
    const project = await this.prismaService.project.findUnique({
      where: { id },
      include: {
        builds: true,
        testVariations: true,
      },
    });

    for (const build of project.builds) {
      await this.buildsService.remove(build.id);
    }
    for (const testVariation of project.testVariations) {
      await this.testVariationsService.delete(testVariation.id);
    }
    await this.prismaService.a11yIssueState.deleteMany({ where: { projectId: id } });

    return this.prismaService.project.delete({
      where: { id },
    });
  }
}
