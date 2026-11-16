import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { TestVariationsService } from '../../test-variations/test-variations.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prismaService: PrismaService,
    @Inject(forwardRef(() => TestVariationsService))
    private testVariationService: TestVariationsService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanOldTestVariations() {
    // A demo instance running on a copy of a production database turns this off,
    // so the copy keeps the same branches as the instance it was taken from.
    if (process.env.TASKS_CLEANUP_ENABLED?.toLowerCase() === 'false') {
      this.logger.debug('Skipping TestVariations cleanup: TASKS_CLEANUP_ENABLED=false');
      return;
    }
    const projects = await this.prismaService.project.findMany();

    for (const project of projects) {
      const dateRemoveAfter: Date = new Date();
      dateRemoveAfter.setDate(dateRemoveAfter.getDate() - project.maxBranchLifetime);

      const testVariations = await this.prismaService.testVariation.findMany({
        where: {
          projectId: project.id,
          updatedAt: { lte: dateRemoveAfter },
          branchName: { not: project.mainBranchName },
        },
      });
      this.logger.debug(
        `Removing ${testVariations.length} TestVariations for ${project.name} later than ${dateRemoveAfter}`
      );

      for (const testVariation of testVariations) {
        await this.testVariationService.delete(testVariation.id);
      }
    }
  }
}
