import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService, toPublicProject } from './projects.service';
import { TEST_PROJECT } from '../_data_';
import { PrismaService } from '../prisma/prisma.service';
import { TestVariationsService } from '../test-variations/test-variations.service';
import { BuildsService } from '../builds/builds.service';
import { HttpException, HttpStatus } from '@nestjs/common';

const initService = async ({ projectFindUniqueMock = jest.fn(), projectUpdateMock = jest.fn() }) => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ProjectsService,
      {
        provide: PrismaService,
        useValue: {
          project: {
            findUnique: projectFindUniqueMock,
            update: projectUpdateMock,
          },
        },
      },
      { provide: TestVariationsService, useValue: {} },
      { provide: BuildsService, useValue: {} },
    ],
  }).compile();

  return module.get<ProjectsService>(ProjectsService);
};
describe('ProjectsService', () => {
  let service: ProjectsService;

  describe('findOne', () => {
    it.each([
      ['name', 'someName', { id: undefined, name: 'someName' }],
      ['id', 'a9385fc1-884d-4f9f-915e-40da0e7773d5', { id: 'a9385fc1-884d-4f9f-915e-40da0e7773d5', name: undefined }],
    ])('should find by %s', async (_, query, expected) => {
      const projectFindUniqueMock = jest.fn().mockResolvedValue({});
      service = await initService({ projectFindUniqueMock });

      await service.findOne(query);

      expect(projectFindUniqueMock).toHaveBeenCalledWith({
        where: expected,
      });
    });

    it('should throw exception if not found', async () => {
      const projectFindUniqueMock = jest.fn().mockResolvedValueOnce(undefined);
      service = await initService({ projectFindUniqueMock });

      await expect(service.findOne('foo')).rejects.toThrowError(
        new HttpException('Project not found', HttpStatus.NOT_FOUND)
      );
    });
  });

  describe('update', () => {
    it('keeps the rules of single checks that the settings form does not know about', async () => {
      const stored = { checkRules: { '["Payment",""]': [{ id: 'r1', selector: 'id:banner', action: 'ignore' }] } };
      const projectFindUniqueMock = jest.fn().mockResolvedValue({ uiTreeSettings: JSON.stringify(stored) });
      const projectUpdateMock = jest.fn().mockResolvedValue({});
      service = await initService({ projectFindUniqueMock, projectUpdateMock });

      await service.update({
        id: 'p1',
        name: 'Mobile',
        uiTreeSettings: JSON.stringify({ excludeSystemBars: false, checkRules: {} }),
      } as never);

      const saved = JSON.parse(projectUpdateMock.mock.calls[0][0].data.uiTreeSettings);
      expect(saved.excludeSystemBars).toBe(false);
      expect(saved.checkRules).toEqual(stored.checkRules);
    });

    it('leaves the settings alone when the form does not send them', async () => {
      const projectFindUniqueMock = jest.fn();
      const projectUpdateMock = jest.fn().mockResolvedValue({});
      service = await initService({ projectFindUniqueMock, projectUpdateMock });

      await service.update({ id: 'p1', name: 'Mobile' } as never);

      expect(projectFindUniqueMock).not.toHaveBeenCalled();
      expect(projectUpdateMock.mock.calls[0][0].data.uiTreeSettings).toBeUndefined();
    });

    it('ignores the variation settings an old page still sends', async () => {
      const projectUpdateMock = jest.fn().mockResolvedValue({});
      service = await initService({ projectUpdateMock });

      await service.update({
        id: 'p1',
        name: 'Mobile',
        bulkApproveVariations: true,
        bulkApproveGroupBy: 'os',
      } as never);

      const { data } = projectUpdateMock.mock.calls[0][0];
      expect(data.name).toBe('Mobile');
      expect(data).not.toHaveProperty('bulkApproveVariations');
      expect(data).not.toHaveProperty('bulkApproveGroupBy');
    });
  });

  describe('toPublicProject', () => {
    it('leaves the variation settings out of a project it returns', () => {
      const project = { ...TEST_PROJECT, bulkApproveVariations: true, bulkApproveGroupBy: 'os' };

      const returned = toPublicProject(project);

      expect(returned.name).toBe(TEST_PROJECT.name);
      expect(returned).not.toHaveProperty('bulkApproveVariations');
      expect(returned).not.toHaveProperty('bulkApproveGroupBy');
    });
  });
});
