import { ProjectAccessService } from './project-access.service';
import { EventsGateway } from '../shared/events/events.gateway';
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
        { provide: ProjectAccessService, useValue: {} },
        { provide: EventsGateway, useValue: {} },
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
        { provide: ProjectAccessService, useValue: {} },
        { provide: EventsGateway, useValue: {} },
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

  const withAccess = (granted: string[]) => {
    const projects = [
      { id: 'a', name: 'Android' },
      { id: 'b', name: 'iOS' },
    ];
    const projectsService = {
      findAll: jest.fn().mockResolvedValue(projects),
      create: jest.fn(async (dto) => ({ id: 'new', ...dto })),
    };
    const access = { grantedTo: jest.fn().mockResolvedValue(new Set(granted)), grant: jest.fn() };
    return {
      controller: new ProjectsController(projectsService as never, {} as never, access as never, {} as never),
      access,
    };
  };

  it('lists only the projects a person has access to', async () => {
    const { controller } = withAccess(['b']);
    const editor = { id: 'u', role: 'editor' } as never;
    expect((await controller.getAll(editor)).map((project) => project.name)).toEqual(['iOS']);
    // with none, the list is empty: the page asks them to turn to an admin
    expect(await withAccess([]).controller.getAll(editor)).toEqual([]);
    // an admin sees every project, given or not
    const admin = { id: 'admin', role: 'admin' } as never;
    expect((await withAccess([]).controller.getAll(admin)).map((project) => project.name)).toEqual(['Android', 'iOS']);
  });

  it('gives an editor access to the project they create', async () => {
    const { controller, access } = withAccess([]);
    const editor = { id: 'u', role: 'editor' };
    await controller.create(editor as never, { name: 'Web' } as never);
    expect(access.grant).toHaveBeenCalledWith('new', 'u', editor);

    const admin = withAccess([]);
    await admin.controller.create({ id: 'admin', role: 'admin' } as never, { name: 'Web' } as never);
    expect(admin.access.grant).not.toHaveBeenCalled();
  });

  // an admin passes the access check for any id, an unknown one too: the page must not reach Jira then
  it('checks the project before asking Jira for its types', async () => {
    const projectsService = {
      findOne: jest.fn().mockRejectedValue(new Error('Project not found')),
      jiraTypes: jest.fn().mockResolvedValue({ issueTypes: [], linkTypes: [] }),
    };
    const controller = new ProjectsController(projectsService as never, {} as never, {} as never, {} as never);
    const admin = { id: 'admin', role: 'admin' } as never;

    await expect(
      controller.jiraTypes('0b0b0b0b-0000-4000-8000-000000000000', 'https://jira.example.com', admin)
    ).rejects.toThrow('Project not found');
    expect(projectsService.jiraTypes).not.toHaveBeenCalled();

    projectsService.findOne.mockResolvedValue({ id: 'p' });
    await controller.jiraTypes('0b0b0b0b-0000-4000-8000-000000000000', 'https://jira.example.com', admin);
    expect(projectsService.jiraTypes).toHaveBeenCalledWith('https://jira.example.com', 'admin');
  });
});
