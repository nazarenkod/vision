import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { A11yIssuesService } from '../a11y/a11y-issues.service';
import { BuildsService } from '../builds/builds.service';
import { TestVariationsService } from '../test-variations/test-variations.service';

describe('Projects Controller', () => {
  let controller: ProjectsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: A11yIssuesService, useValue: {} },
      ],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('lists the devices the project received snapshots from', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { device: 'Pixel 7', os: 'Android 15' },
      { device: 'iPhone 17', os: '26.2' },
      { device: null, os: 'Android 15' },
      { device: 'Pixel 7', os: '' },
    ]);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: { testVariation: { findMany } } },
        { provide: A11yIssuesService, useValue: {} },
        { provide: BuildsService, useValue: {} },
        { provide: TestVariationsService, useValue: {} },
      ],
    }).compile();

    const devices = await module.get(ProjectsController).devices('3f7c1a52-2a4b-4d8e-9a51-0c2e6b1d7f90');

    expect(devices).toEqual([
      { device: 'Pixel 7', os: 'Android 15' },
      { device: 'iPhone 17', os: '26.2' },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: '3f7c1a52-2a4b-4d8e-9a51-0c2e6b1d7f90' },
        distinct: ['device', 'os'],
      })
    );
  });
});
