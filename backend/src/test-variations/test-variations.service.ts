import { BaselineUser } from '../shared/dto/baseline.dto';
import { Injectable, Inject, forwardRef, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TestVariation, Baseline, Build, TestRun, User } from '@prisma/client';
import { StaticService } from '../static/static.service';
import { BuildsService } from '../builds/builds.service';
import { TestRunsService } from '../test-runs/test-runs.service';
import { CreateTestRequestDto } from '../test-runs/dto/create-test-request.dto';
import { BuildDto } from '../builds/dto/build.dto';
import { getTestVariationUniqueData } from '../utils';
import { TestVariationUpdateDto } from './dto/test-variation-update.dto';
import { featureToKeep } from './variation-feature';
import { BaselineDataDto } from '../shared/dto/baseline-data.dto';
import { UiTreeService } from '../ui-tree/ui-tree.service';
import { InspectorTree } from '../ui-tree/inspector-tree';

@Injectable()
export class TestVariationsService {
  private readonly logger = new Logger(TestVariationsService.name);

  constructor(
    private prismaService: PrismaService,
    private staticService: StaticService,
    @Inject(forwardRef(() => TestRunsService))
    private testRunsService: TestRunsService,
    @Inject(forwardRef(() => BuildsService))
    private buildsService: BuildsService,
    private uiTreeService: UiTreeService
  ) {}

  /**
   * The UI tree of one version in the check's baseline history, for viewing
   * (079). A version of another check is not found: access is checked on the
   * check in the address.
   */
  async getBaselineUiTree(id: string, baselineId: string): Promise<InspectorTree | null> {
    const baseline = await this.prismaService.baseline.findFirst({
      where: { id: baselineId, testVariationId: id },
      select: { uiTreeName: true },
    });
    if (!baseline) throw new NotFoundException('Baseline not found');
    return this.uiTreeService.inspectorOf(baseline.uiTreeName);
  }

  async getDetails(
    id: string
  ): Promise<TestVariation & { baselines: (Baseline & { testRun: TestRun; user: BaselineUser | null })[] }> {
    return this.prismaService.testVariation.findUnique({
      where: { id },
      include: {
        baselines: {
          include: {
            testRun: true,
            // never the whole row: it holds the password hash, API key and Jira token
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async findUnique(data: BaselineDataDto & { projectId: string }): Promise<TestVariation | null> {
    return this.prismaService.testVariation.findUnique({
      where: {
        projectId_name_browser_device_os_viewport_customTags_branchName: {
          projectId: data.projectId,
          name: data.name,
          browser: data.browser,
          device: data.device,
          os: data.os,
          viewport: data.viewport,
          customTags: data.customTags,
          branchName: data.branchName,
        },
      },
    });
  }

  async update(
    id: string,
    data: TestVariationUpdateDto & { baselineUiTreeName?: string | null; elementRules?: string | null },
    testRunId?: string
  ): Promise<TestVariation> {
    return this.prismaService.testVariation.update({
      where: { id },
      data: {
        baselineName: data.baselineName,
        // left untouched unless the caller says, so older callers keep the tree
        ...(data.baselineUiTreeName !== undefined ? { baselineUiTreeName: data.baselineUiTreeName } : {}),
        ...(data.elementRules !== undefined ? { elementRules: data.elementRules } : {}),
        ignoreAreas: data.ignoreAreas,
        comment: data.comment,
        testRuns: testRunId ? { connect: { id: testRunId } } : undefined,
      },
    });
  }

  /**
   * The baseline keeps the feature the test named last (068). Only a baseline
   * of the snapshot's own branch: a feature branch comparing with the main
   * branch's baseline has none of its own yet. The date stays as it was, since
   * `find` chooses between the branch's and the main branch's baseline by it,
   * and a renamed feature must not change what a snapshot is compared with.
   */
  async keepFeature(
    testVariation: TestVariation,
    createTestRequestDto: Pick<CreateTestRequestDto, 'branchName' | 'featureName'>
  ): Promise<TestVariation> {
    if (testVariation.branchName !== createTestRequestDto.branchName) return testVariation;
    const featureName = featureToKeep(testVariation.featureName, createTestRequestDto.featureName);
    if (featureName === (testVariation.featureName ?? null)) return testVariation;
    return this.prismaService.testVariation.update({
      where: { id: testVariation.id },
      data: { featureName, updatedAt: testVariation.updatedAt },
    });
  }

  /**
   * Tries to get test variation for the same branch
   * Falls back to main branch if not found
   * @param projectId
   * @param baselineData
   * @returns
   */
  async find(
    createTestRequestDto: BaselineDataDto & { projectId: string; sourceBranch?: string }
  ): Promise<TestVariation | null> {
    const project = await this.prismaService.project.findUnique({ where: { id: createTestRequestDto.projectId } });
    const mainBranch = createTestRequestDto.sourceBranch ?? project.mainBranchName;

    const [mainBranchTestVariation, currentBranchTestVariation] = await Promise.all([
      // search main branch variation
      this.findUnique({
        projectId: createTestRequestDto.projectId,
        branchName: mainBranch,
        ...getTestVariationUniqueData(createTestRequestDto),
      }),
      // search current branch variation
      createTestRequestDto.branchName !== mainBranch &&
        this.findUnique({
          projectId: createTestRequestDto.projectId,
          branchName: createTestRequestDto.branchName,
          ...getTestVariationUniqueData(createTestRequestDto),
        }),
    ]);

    if (!!currentBranchTestVariation) {
      if (mainBranchTestVariation && mainBranchTestVariation.updatedAt > currentBranchTestVariation.updatedAt) {
        return mainBranchTestVariation;
      }
      return currentBranchTestVariation;
    }

    if (!!mainBranchTestVariation) {
      return mainBranchTestVariation;
    }
  }

  /**
   * Creates empty test variation (no baseline)
   */
  create({
    testRunId,
    createTestRequestDto,
  }: {
    testRunId?: string;
    createTestRequestDto: Omit<CreateTestRequestDto, 'buildId' | 'ignoreAreas'>;
  }): Promise<TestVariation> {
    return this.prismaService.testVariation.create({
      data: {
        project: { connect: { id: createTestRequestDto.projectId } },
        testRuns: testRunId ? { connect: { id: testRunId } } : undefined,
        branchName: createTestRequestDto.branchName,
        // a new baseline starts in the feature the test named (068); a merge passes the source's on
        featureName: createTestRequestDto.featureName?.trim() || null,
        ...getTestVariationUniqueData(createTestRequestDto),
      },
    });
  }

  async addBaseline({
    id,
    userId,
    testRunId,
    baselineName,
    uiTreeName = null,
  }: {
    id: string;
    userId: string;
    testRunId: string;
    baselineName: string;
    // UI tree of the approved screenshot; a baseline without one clears the old tree
    uiTreeName?: string | null;
  }): Promise<TestVariation> {
    return this.prismaService.testVariation.update({
      where: { id },
      data: {
        baselineName,
        baselineUiTreeName: uiTreeName,
        baselines: {
          create: {
            baselineName,
            uiTreeName,
            testRun: {
              connect: {
                id: testRunId,
              },
            },
            user: userId
              ? {
                  connect: {
                    id: userId,
                  },
                }
              : undefined,
          },
        },
      },
    });
  }

  async merge(projectId: string, fromBranch: string, toBranch: string): Promise<BuildDto> {
    // create build
    const build: Build = await this.buildsService.findOrCreate({
      branchName: toBranch,
      projectId,
    });

    // find source branch variations
    const testVariations: TestVariation[] = await this.prismaService.testVariation.findMany({
      where: { projectId, branchName: fromBranch },
    });

    // compare source to destination branch variations
    for (const sourceBranchTestVariation of testVariations) {
      const baselineBuffer = await this.staticService.getImageBuffer(sourceBranchTestVariation.baselineName);
      if (baselineBuffer) {
        // get destination branch request
        const createTestRequestDto: CreateTestRequestDto = {
          ...sourceBranchTestVariation,
          branchName: toBranch,
          buildId: build.id,
          diffTollerancePercent: 0,
          merge: true,
          ignoreAreas: JSON.parse(sourceBranchTestVariation.ignoreAreas),
          featureName: sourceBranchTestVariation.featureName ?? undefined,
        };

        // get destination branch variation
        let destintionBranchTestVariation = await this.find({
          projectId,
          branchName: toBranch,
          ...getTestVariationUniqueData(sourceBranchTestVariation),
        });

        if (destintionBranchTestVariation?.branchName !== toBranch) {
          destintionBranchTestVariation = await this.create({ createTestRequestDto });
        } else {
          // the merged snapshot names the source's feature, as a test's would (068)
          destintionBranchTestVariation = await this.keepFeature(destintionBranchTestVariation, createTestRequestDto);
        }

        const testRun = await this.testRunsService.create({
          testVariation: destintionBranchTestVariation,
          createTestRequestDto,
          imageBuffer: baselineBuffer,
        });

        await this.testRunsService.calculateDiff(projectId, testRun);
      }
    }

    // stop build
    return this.buildsService.update(build.id, { isRunning: false });
  }

  async delete(id: string): Promise<TestVariation> {
    this.logger.debug(`Going to remove TestVariation ${id}`);
    const testVariation = await this.getDetails(id);

    // delete Baselines
    for (const baseline of testVariation.baselines) {
      await this.deleteBaseline(baseline);
    }

    // disconnect TestRuns
    // workaround due to  https://github.com/prisma/prisma/issues/2810
    await this.prismaService
      .$executeRaw`UPDATE "public"."TestRun" SET "testVariationId" = NULL::text WHERE "testVariationId" = ${id}`;

    // delete TestVariation
    return this.prismaService.testVariation.delete({
      where: { id },
    });
  }

  async deleteBaseline(baseline: Baseline): Promise<Baseline> {
    this.logger.debug(`Going to remove Baseline ${baseline.id}`);

    this.staticService.deleteImage(baseline.baselineName);
    if (baseline.uiTreeName) this.staticService.deleteFile(baseline.uiTreeName);
    return this.prismaService.baseline.delete({
      where: { id: baseline.id },
    });
  }
}
