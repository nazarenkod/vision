import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { TestRunsController } from './test-runs.controller';
import { TestRunsService } from './test-runs.service';
import { TestVariationsService } from '../test-variations/test-variations.service';
import { PrismaService } from '../prisma/prisma.service';
import { A11yIssuesService } from '../a11y/a11y-issues.service';
import { DecisionUndoService } from './decision-undo.service';
import { ChangeGroupsService } from './change-groups.service';
import { ApiGuard } from '../auth/guards/api.guard';
import { JwtAuthGuard } from '../auth/guards/auth.guard';

describe('TestRuns Controller', () => {
  let controller: TestRunsController;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [TestRunsController],
      providers: [
        { provide: TestRunsService, useValue: {} },
        { provide: TestVariationsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: A11yIssuesService, useValue: {} },
        { provide: ChangeGroupsService, useValue: {} },
        { provide: DecisionUndoService, useValue: {} },
        { provide: ApiGuard, useValue: {} },
        { provide: JwtAuthGuard, useValue: {} },
      ],
    }).compile();

    controller = module.get<TestRunsController>(TestRunsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // the bulk review of a screen's variations was removed (022); a script or an
  // old tab asking for a group must get nothing back and change nothing
  it('has no route for a variation group', async () => {
    const app: INestApplication = module.createNestApplication();
    await app.init();
    try {
      await request(app.getHttpServer())
        .get('/test-runs/matchingSiblings/3f7c1a52-2a4b-4d8e-9a51-0c2e6b1d7f90')
        .expect(404);
    } finally {
      await app.close();
    }
  });
});
