/**
 * @see https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing
 */
import { seed } from '../seed';
import { prismaMock } from './client.mock';

const mockDefaultProject = {
  id: '09',
  name: 'Default project',
  mainBranchName: 'main',
  buildsCounter: 0,
  maxBuildAllowed: 100,
  maxBranchLifetime: 30,
  updatedAt: new Date(),
  createdAt: new Date(),
  autoApproveFeature: true,
  imageComparison: 'pixelmatch',
  imageComparisonConfig: '{ "threshold": 0.1, "ignoreAntialiasing": true, "allowDiffDimensions": false }',
  bulkApproveVariations: false,
  bulkApproveGroupBy: 'customTags',
  jiraUrl: null,
  jiraEmail: null,
  jiraToken: null,
  jiraIssueType: null,
  jiraLinkType: null,
  uiTreeSettings: null,
} as const;

const mockDefaultUser = {
  id: '0',
  email: 'admin@vision.local',
  firstName: 'fname',
  lastName: 'lname',
  role: 'admin',
  apiKey: 'DEFAULTUSERAPIKEYTOBECHANGED',
  apiKeyEnding: null,
  password: 'password.hashed',
  isActive: true,
  // fields Vision added to User; the seed leaves them empty
  jiraToken: null,
  jiraEmail: null,
  geminiApiKey: null,
  lastSignInAt: null,
  tokensValidAfter: null,
  updatedAt: new Date(),
  createdAt: new Date(),
} as const;

const STRONG_PASSWORD = 'a-long-admin-password';

beforeEach(() => {
  process.env.DEFAULT_USER_PASSWORD = STRONG_PASSWORD;
});

afterEach(() => {
  // a refused admin sets the exit code; it must not fail the test run itself
  process.exitCode = undefined;
  jest.restoreAllMocks();
});

describe('Defaults get created', () => {
  beforeEach(() => {
    prismaMock.user.upsert.mockResolvedValue(mockDefaultUser);
    prismaMock.project.create.mockResolvedValue(mockDefaultProject);
  });
  test('Default user and project are created for empty database', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.project.findMany.mockResolvedValue([]);

    await seed();

    expect(prismaMock.user.upsert).toHaveBeenCalled();
    expect(prismaMock.project.create).toHaveBeenCalled();
  });

  test('creates admin@vision.local when no admin email is set', async () => {
    delete process.env.DEFAULT_USER_EMAIL;
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.project.findMany.mockResolvedValue([]);

    await seed();

    expect(prismaMock.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'admin@vision.local' } })
    );
  });

  test('Default user and project are created on error', async () => {
    prismaMock.user.findMany.mockRejectedValue(new Error('"user" table does not exist'));
    prismaMock.project.findMany.mockRejectedValue(new Error('"project" table does not exist'));

    await seed();

    expect(prismaMock.user.upsert).toHaveBeenCalled();
    expect(prismaMock.project.create).toHaveBeenCalled();
  });

  test('Default user is create if NO admin user exists', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ ...mockDefaultUser, email: 'foo@bar.com', role: 'editor' }]);
    prismaMock.project.findMany.mockResolvedValue([]);

    await seed();

    expect(prismaMock.user.upsert).toHaveBeenCalled();
    expect(prismaMock.project.create).toHaveBeenCalled();
  });

  test('Default user is create if the only admin user is inActive', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ ...mockDefaultUser, email: 'foo@bar.com', isActive: false }]);
    prismaMock.project.findMany.mockResolvedValue([]);

    await seed();

    expect(prismaMock.user.upsert).toHaveBeenCalled();
    expect(prismaMock.project.create).toHaveBeenCalled();
  });
});

describe('Defaults do NOT get created', () => {
  beforeEach(() => {
    prismaMock.user.upsert.mockResolvedValue(mockDefaultUser);
    prismaMock.project.create.mockResolvedValue(mockDefaultProject);
  });
  test('Default project is NOT create if any project exists', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.project.findMany.mockResolvedValue([mockDefaultProject]);

    await seed();

    expect(prismaMock.user.upsert).toHaveBeenCalled();
    expect(prismaMock.project.create).not.toHaveBeenCalled();
  });

  test('Default user is NOT create if any active admin user exists', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ ...mockDefaultUser, email: 'foo@bar.com' }]);
    prismaMock.project.findMany.mockResolvedValue([]);

    await seed();

    expect(prismaMock.user.upsert).not.toHaveBeenCalled();
    expect(prismaMock.project.create).toHaveBeenCalled();
  });
});

describe('The first admin password (082)', () => {
  beforeEach(() => {
    prismaMock.user.upsert.mockResolvedValue(mockDefaultUser);
    prismaMock.project.create.mockResolvedValue(mockDefaultProject);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.project.findMany.mockResolvedValue([]);
  });

  test.each([
    ['is not set', undefined],
    ['is blank', '   '],
    ['is shorter than 12 characters', '123456'],
  ])('creates no admin and fails the seed when DEFAULT_USER_PASSWORD %s', async (_, password) => {
    if (password === undefined) delete process.env.DEFAULT_USER_PASSWORD;
    else process.env.DEFAULT_USER_PASSWORD = password;
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await seed();

    expect(prismaMock.user.upsert).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(error.mock.calls.flat().join(' ')).toContain('DEFAULT_USER_PASSWORD');
    // the default project does not depend on the admin
    expect(prismaMock.project.create).toHaveBeenCalled();
  });

  test('needs no password when an active admin exists already', async () => {
    delete process.env.DEFAULT_USER_PASSWORD;
    prismaMock.user.findMany.mockResolvedValue([{ ...mockDefaultUser, email: 'foo@bar.com' }]);

    await seed();

    expect(prismaMock.user.upsert).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  test('never prints the admin password or project rows', async () => {
    const printed: unknown[] = [];
    for (const level of ['log', 'info', 'warn', 'error'] as const) {
      jest.spyOn(console, level).mockImplementation((...args) => void printed.push(...args));
    }
    prismaMock.project.findMany.mockResolvedValue([{ ...mockDefaultProject, jiraToken: 'sealed-token' }]);

    await seed();

    expect(prismaMock.user.upsert).toHaveBeenCalled();
    const output = printed.map((value) => (typeof value === 'string' ? value : JSON.stringify(value))).join('\n');
    expect(output).not.toContain(STRONG_PASSWORD);
    expect(output).not.toContain('sealed-token');
  });
});
