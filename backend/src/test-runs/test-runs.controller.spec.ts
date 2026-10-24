import { Test, TestingModule } from '@nestjs/testing';
import { TestRunsController } from './test-runs.controller';
import { TestRunsService } from './test-runs.service';
import { TestVariationsService } from '../test-variations/test-variations.service';
import { PrismaService } from '../prisma/prisma.service';
import { A11yIssuesService } from '../a11y/a11y-issues.service';
import { ChangeGroupsService } from './change-groups.service';

describe('TestRuns Controller', () => {
  let controller: TestRunsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestRunsController],
      providers: [
        { provide: TestRunsService, useValue: {} },
        { provide: TestVariationsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: A11yIssuesService, useValue: {} },
        { provide: ChangeGroupsService, useValue: {} },
      ],
    }).compile();

    controller = module.get<TestRunsController>(TestRunsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
