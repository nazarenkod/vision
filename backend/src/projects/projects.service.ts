import {
  BadRequestException,
  ConflictException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { BuildsService } from '../builds/builds.service';
import { TestVariationsService } from '../test-variations/test-variations.service';
import { PrismaService } from '../prisma/prisma.service';
import { Project } from '@prisma/client';
import { looksLikeUuid } from '../shared/random-key';
import { UpdateProjectDto } from './dto/update-project.dto';
import { settingsConflict } from './settings-conflict';
import { hideConfigSecrets, keepConfigSecrets } from './project-secrets';
import { AllowedDevice, invalidAllowedDevice } from './allowed-devices';
import { wipeSharedJiraCredentials } from './shared-jira-credentials';
import { sealSecret } from '../shared/secret-box';
import { allowedJiraHosts, JIRA_HOSTS_VARIABLE, jiraHostProblem } from '../a11y/jira-hosts';
import { settingsJira } from '../a11y/jira-access';
import { JiraClient } from '../a11y/jira.client';
import { jiraTypesFor, JiraTypesResponse } from '../a11y/jira-types';

const blankToNull = (value: string | null | undefined) =>
  value === undefined ? undefined : value?.trim() ? value.trim() : null;

/**
 * Jira settings from a create/update payload: undefined keeps a value, empty clears it. An
 * address goes in only on a host the server allows (044): the person filing a bug sends their
 * token there.
 */
function jiraFields(dto: Partial<CreateProjectDto>) {
  const jiraUrl = blankToNull(dto.jiraUrl);
  const hostProblem = jiraUrl && jiraHostProblem(jiraUrl, allowedJiraHosts(process.env[JIRA_HOSTS_VARIABLE]));
  if (hostProblem) throw new BadRequestException(hostProblem);
  return {
    jiraUrl,
    jiraIssueType: blankToNull(dto.jiraIssueType),
    jiraLinkType: blankToNull(dto.jiraLinkType),
    // stored only when it parses, so a bad value can never break comparisons
    uiTreeSettings: dto.uiTreeSettings === undefined ? undefined : normalizeUiTreeSettings(dto.uiTreeSettings),
  };
}

function normalizeUiTreeSettings(value: string | null): string | null {
  if (!value) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new HttpException('uiTreeSettings must be JSON', HttpStatus.BAD_REQUEST);
  }
  // a wildcard the server would read differently from what the person meant is refused, not dropped
  const devices = (parsed as { allowedDevices?: unknown } | null)?.allowedDevices;
  for (const entry of Array.isArray(devices) ? devices : []) {
    const problem = invalidAllowedDevice(entry && typeof entry === 'object' ? entry : {});
    if (problem) throw new HttpException(problem, HttpStatus.BAD_REQUEST);
  }
  return value;
}

/**
 * A project as the API returns it. The columns of the removed variation groups
 * (022) and of the shared Jira token (035) stay in the row unread.
 */
export function toPublicProject(project: Project): Omit<
  Project,
  'jiraToken' | 'jiraEmail' | 'bulkApproveVariations' | 'bulkApproveGroupBy'
> & {
  geminiApiKeySet: boolean;
} {
  if (!project) return project as never;
  const { jiraToken, jiraEmail, bulkApproveVariations, bulkApproveGroupBy, ...rest } = project;
  const comparison = hideConfigSecrets(project.imageComparisonConfig);
  return {
    ...rest,
    imageComparisonConfig: comparison.config,
    geminiApiKeySet: comparison.apiKeySet,
  };
}

@Injectable()
export class ProjectsService implements OnModuleInit {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private prismaService: PrismaService,
    @Inject(forwardRef(() => BuildsService))
    private buildsService: BuildsService,
    @Inject(forwardRef(() => TestVariationsService))
    private testVariationsService: TestVariationsService
  ) {}

  // Shared Jira tokens are gone (035, ADR-0025): what an older version saved
  // is wiped here rather than in a migration (ADR-0003). It must not stop the
  // start, and the next start tries again.
  onModuleInit(): void {
    wipeSharedJiraCredentials(this.prismaService)
      .then((count) => count && this.logger.log(`Wiped the shared Jira token of ${count} project(s)`))
      .catch((error) => this.logger.warn(`Could not wipe shared Jira tokens: ${error}`));
  }

  async findOne(idOrName: string): Promise<Project> {
    const isUUID = looksLikeUuid(idOrName);
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
        imageComparisonConfig: keepConfigSecrets(projectDto.imageComparisonConfig, null, sealSecret),
        maxBuildAllowed: projectDto.maxBuildAllowed,
        maxBranchLifetime: projectDto.maxBranchLifetime,
        ...jiraFields(projectDto),
      },
    });
  }

  /** Device and OS pairs the project's snapshots came from, to build the allowed list from (029). */
  /** The Jira issue and link types the settings page offers, as the person sees them (049). */
  async jiraTypes(jiraUrl: string | undefined, userId: string): Promise<JiraTypesResponse> {
    const jira = await settingsJira(this.prismaService, jiraUrl, userId);
    if (!(jira instanceof JiraClient)) return jira;
    try {
      const [issueTypes, linkTypes] = await Promise.all([jira.allIssueTypes(), jira.linkTypes()]);
      return jiraTypesFor(issueTypes, linkTypes);
    } catch (error) {
      this.logger.warn(`Jira types for the settings failed: ${error}`);
      return { problem: 'failed' };
    }
  }

  async findDevices(projectId: string): Promise<AllowedDevice[]> {
    const rows = await this.prismaService.testVariation.findMany({
      where: { projectId },
      select: { device: true, os: true },
      distinct: ['device', 'os'],
      orderBy: [{ device: 'asc' }, { os: 'asc' }],
    });
    // a pair without a device or OS could never be allowed, so it is no suggestion
    return rows
      .filter((row) => row.device?.trim() && row.os?.trim())
      .map((row) => ({ device: row.device, os: row.os }));
  }

  async update(projectDto: UpdateProjectDto): Promise<Project> {
    const checkConflict = !!projectDto.loadedSettings && !projectDto.force;
    // read only when needed: for a conflict, or for a Gemini key to keep
    const stored =
      checkConflict || projectDto.imageComparisonConfig
        ? await this.prismaService.project.findUnique({ where: { id: projectDto.id } })
        : null;
    if (checkConflict) {
      // the page never saw the key, so compare what it could see
      const visible = stored && {
        ...stored,
        imageComparisonConfig: hideConfigSecrets(stored.imageComparisonConfig).config,
      };
      const changed = visible ? settingsConflict(projectDto.loadedSettings, visible) : [];
      if (changed.length) {
        throw new ConflictException({
          message: 'Someone changed these settings after you opened the page.',
          fields: changed,
        });
      }
    }
    const fields = jiraFields(projectDto);
    if (fields.uiTreeSettings) {
      fields.uiTreeSettings = await this.keepCheckRules(projectDto.id, fields.uiTreeSettings);
    }
    return this.prismaService.project.update({
      where: { id: projectDto.id },
      data: {
        name: projectDto.name,
        mainBranchName: projectDto.mainBranchName,
        autoApproveFeature: projectDto.autoApproveFeature,
        imageComparison: projectDto.imageComparison,
        maxBuildAllowed: projectDto.maxBuildAllowed,
        maxBranchLifetime: projectDto.maxBranchLifetime,
        imageComparisonConfig: keepConfigSecrets(
          projectDto.imageComparisonConfig,
          stored?.imageComparisonConfig,
          sealSecret
        ),
        ...fields,
      },
    });
  }

  /**
   * Rules for single checks are added from the review, not the settings form,
   * so a form opened earlier must not wipe the ones added since.
   */
  private async keepCheckRules(projectId: string, incoming: string): Promise<string> {
    const stored = await this.prismaService.project.findUnique({ where: { id: projectId } });
    let checkRules: unknown;
    try {
      checkRules = stored?.uiTreeSettings ? JSON.parse(stored.uiTreeSettings).checkRules : undefined;
    } catch {
      checkRules = undefined;
    }
    const next = JSON.parse(incoming) ?? {};
    if (checkRules) next.checkRules = checkRules;
    else delete next.checkRules;
    return JSON.stringify(next);
  }

  /** Devices the project has checks on, the most used first: candidates for the reference device. */
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
    await this.prismaService.a11yProblem.deleteMany({ where: { projectId: id } });
    await this.prismaService.a11yDecision.deleteMany({ where: { projectId: id } });

    return this.prismaService.project.delete({
      where: { id },
    });
  }
}
