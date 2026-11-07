import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { requestWithAuth, haveUserLogged } from './preconditions';
import { ProjectsService } from '../src/projects/projects.service';
import { randomUUID } from 'crypto';
import { UserLoginResponseDto } from '../src/users/dto/user-login-response.dto';
import { ProjectDto } from '../src/projects/dto/project.dto';
import { globalPipes } from '../src/shared/strip-unknown-fields.pipe';

const project: ProjectDto = {
  id: randomUUID(),
  name: 'Test project',
  buildsCounter: 0,
  mainBranchName: 'master',
  createdAt: new Date(),
  updatedAt: new Date(),
  autoApproveFeature: true,
  imageComparison: 'pixelmatch',
  maxBuildAllowed: 0,
  maxBranchLifetime: 0,
  imageComparisonConfig: '{}',
  jiraUrl: null,
  jiraIssueType: null,
  jiraLinkType: null,
  uiTreeSettings: null,
};

const projectServiceMock = {
  findAll: () => [project],
  create: () => project,
  remove: () => project,
  update: () => project,
};

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let usersService: UsersService;
  let loggedUser: UserLoginResponseDto;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProjectsService)
      .useValue(projectServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(...globalPipes());
    usersService = moduleFixture.get<UsersService>(UsersService);

    await app.init();
  });

  beforeEach(async () => {
    loggedUser = await haveUserLogged(usersService);
  });

  afterEach(async () => {
    await usersService.delete(loggedUser.id);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /', () => {
    it('200', () => {
      return requestWithAuth(app, 'post', '/projects', loggedUser.token)
        .send(project)
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe(project.name);
          expect(res.body.mainBranchName).toBe(project.mainBranchName);
          expect(res.body.autoApproveFeature).toBe(project.autoApproveFeature);
          expect(res.body.imageComparison).toBe(project.imageComparison);
          expect(res.body.imageComparisonConfig).toBe(project.imageComparisonConfig);
          expect(res.body.maxBuildAllowed).toBe(project.maxBuildAllowed);
          expect(res.body.maxBranchLifetime).toBe(project.maxBranchLifetime);
        });
    });

    it('401', () => {
      return requestWithAuth(app, 'post', '/projects', '').send(project).expect(401);
    });
  });

  describe('GET /', () => {
    it('200', async () => {
      const res = await requestWithAuth(app, 'get', '/projects', loggedUser.token).send().expect(200);

      // answers carry whether a Gemini key is set, never the key (044)
      expect(res.body).toEqual([expect.objectContaining({ id: project.id, geminiApiKeySet: false })]);
    });

    it('401', async () => {
      await requestWithAuth(app, 'get', '/projects', '').send().expect(401);
    });
  });

  describe('DELETE /', () => {
    it('can delete', async () => {
      const res = await requestWithAuth(app, 'delete', `/projects/${project.id}`, loggedUser.token).send().expect(200);

      expect(res.body).toStrictEqual({
        ...projectServiceMock.remove(),
        geminiApiKeySet: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('not valid UUID', async () => {
      await requestWithAuth(app, 'delete', `/projects/123`, loggedUser.token).send().expect(400);
    });

    it('not valid token', async () => {
      await requestWithAuth(app, 'delete', `/projects/${project.id}`, 'asd').send().expect(401);
    });
  });

  describe('PUT /', () => {
    it('can edit', async () => {
      const res = await requestWithAuth(app, 'put', `/projects`, loggedUser.token).send(project).expect(200);

      expect(res.body).toStrictEqual({
        ...projectServiceMock.update(),
        geminiApiKeySet: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('not valid token', async () => {
      await requestWithAuth(app, 'put', `/projects`, 'asd').send(project).expect(401);
    });
  });
});
