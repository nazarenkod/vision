import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, TestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StaticService } from '../static/static.service';
import { EventsGateway } from '../shared/events/events.gateway';
import { TestRunsService } from './test-runs.service';
import { DecisionItem, decisionUndo, RunState, undoExpired, UndoStep, VariationState } from './decision-undo';

// journal rows older than this go when the next decision is written
const KEEP_JOURNAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Approve and reject with a journal, and Undo from it (018, ADR-0014). The
 * decisions themselves are upstream's; this only records what they changed.
 */
@Injectable()
export class DecisionUndoService {
  private readonly logger = new Logger(DecisionUndoService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly testRunsService: TestRunsService,
    private readonly staticService: StaticService,
    private readonly eventsGateway: EventsGateway
  ) {}

  async approve(ids: string[], merge: boolean, userId?: string): Promise<{ decisionId: string }> {
    return this.journal('approve', ids, userId, async (id) => {
      await this.testRunsService.approve(id, merge, false, userId);
    });
  }

  async reject(ids: string[], userId?: string): Promise<{ decisionId: string }> {
    return this.journal('reject', ids, userId, async (id) => {
      await this.testRunsService.setStatus(id, TestStatus.failed);
    });
  }

  async undo(decisionId: string, userId?: string, now = new Date()): Promise<{ undone: number }> {
    const decision = await this.prismaService.reviewDecision.findUnique({ where: { id: decisionId } });
    if (!decision) throw new NotFoundException('No such decision.');
    if (decision.undoneAt) throw new ConflictException('This decision was already undone.');
    if (decision.userId && userId && decision.userId !== userId) {
      throw new ForbiddenException('Only the person who decided can undo it.');
    }
    if (undoExpired(decision.createdAt, now)) {
      throw new ConflictException('It is too late to undo this decision.');
    }
    const items = decision.items as unknown as DecisionItem[];

    // all or nothing: one changed run blocks the whole decision
    const current = new Map<string, RunState | null>();
    for (const item of items) current.set(item.testRunId, await this.state(item.testRunId));
    const plan = decisionUndo(items, current);
    if ('blocked' in plan) throw new ConflictException(plan.blocked);

    await this.prismaService.$transaction(async (tx) => {
      for (const step of plan.steps) await this.apply(tx, step);
      await tx.reviewDecision.update({ where: { id: decisionId }, data: { undoneAt: now } });
    });

    // after the commit: tell everyone watching the build, then drop the copies
    for (const item of items) {
      const run = await this.prismaService.testRun.findUnique({ where: { id: item.testRunId } });
      if (run) this.eventsGateway.testRunUpdated(run);
    }
    for (const step of plan.steps) {
      if (step.kind === 'deleteImage') {
        this.staticService.deleteImage(step.name).catch((error) => this.logger.warn(`${error}`));
      } else if (step.kind === 'deleteFile') {
        this.staticService.deleteFile(step.name).catch((error) => this.logger.warn(`${error}`));
      }
    }
    return { undone: items.length };
  }

  private async journal(
    kind: 'approve' | 'reject',
    ids: string[],
    userId: string | undefined,
    decide: (id: string) => Promise<void>
  ): Promise<{ decisionId: string }> {
    const items: DecisionItem[] = [];
    for (const id of ids) {
      const before = await this.state(id);
      await decide(id);
      const after = await this.state(id);
      if (before && after) items.push({ testRunId: id, before, after });
    }
    const decision = await this.prismaService.reviewDecision.create({
      data: { kind, userId: userId ?? null, items: items as unknown as Prisma.InputJsonValue },
    });
    this.prismaService.reviewDecision
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_JOURNAL_MS) } } })
      .catch((error) => this.logger.warn(`Could not prune the decision journal: ${error}`));
    return { decisionId: decision.id };
  }

  /** A run, its variation, and its feature-branch variation if it has one. */
  async state(testRunId: string): Promise<RunState | null> {
    const run = await this.prismaService.testRun.findUnique({ where: { id: testRunId } });
    if (!run) return null;
    const variations: VariationState[] = [];
    const add = async (variation: { id: string } | null) => {
      if (!variation || variations.some((v) => v.id === variation.id)) return;
      const full = await this.prismaService.testVariation.findUnique({
        where: { id: variation.id },
        include: { baselines: { select: { id: true } } },
      });
      if (!full) return;
      variations.push({
        id: full.id,
        baselineName: full.baselineName,
        baselineUiTreeName: full.baselineUiTreeName,
        elementRules: full.elementRules,
        ignoreAreas: full.ignoreAreas,
        comment: full.comment,
        baselineIds: full.baselines.map((baseline) => baseline.id).sort(),
      });
    };
    if (run.testVariationId) await add({ id: run.testVariationId });
    // approving on a feature branch writes to that branch's own variation
    const feature = run.projectId
      ? await this.prismaService.testVariation.findUnique({
          where: {
            projectId_name_browser_device_os_viewport_customTags_branchName: {
              projectId: run.projectId,
              name: run.name,
              browser: run.browser ?? '',
              device: run.device ?? '',
              os: run.os ?? '',
              viewport: run.viewport ?? '',
              customTags: run.customTags ?? '',
              branchName: run.branchName,
            },
          },
          select: { id: true },
        })
      : null;
    await add(feature);
    return {
      testRunId,
      status: run.status,
      testVariationId: run.testVariationId,
      variations: variations.sort((a, b) => a.id.localeCompare(b.id)),
    };
  }

  private async apply(tx: Prisma.TransactionClient, step: UndoStep): Promise<void> {
    switch (step.kind) {
      case 'deleteBaselines':
        await tx.baseline.deleteMany({ where: { id: { in: step.ids } } });
        return;
      case 'link':
        await tx.testRun.update({ where: { id: step.testRunId }, data: { testVariationId: step.testVariationId } });
        return;
      case 'deleteVariation':
        await tx.testVariation.delete({ where: { id: step.id } });
        return;
      case 'variation':
        await tx.testVariation.update({ where: { id: step.id }, data: step.data });
        return;
      case 'status':
        await tx.testRun.update({ where: { id: step.testRunId }, data: { status: step.status as TestStatus } });
        return;
      default:
        // files go after the commit
        return;
    }
  }
}
