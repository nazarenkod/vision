import { Test, TestingModule } from '@nestjs/testing';
import { LdapUsersService } from './ldapusers.service';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Role, User } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Entry as LdapEntry, Client as LdapClient, SearchOptions, SearchResult } from 'ldapts';

jest.mock('ldapts', () => {
  const mockLdapClient = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    search: jest.fn((_searchDN, searchOptions: SearchOptions): Promise<SearchResult> => {
      if (searchOptions.filter.toString().includes('exists@example.com')) {
        return Promise.resolve({
          searchEntries: [
            {
              dn: 'dn',
              LDAP_ATTRIBUTE_MAIL: 'exists@example.com',
              LDAP_ATTRIBUTE_FIRST_NAME: 'first',
              LDAP_ATTRIBUTE_LAST_NAME: 'last',
            },
          ],
          searchReferences: [],
        });
      } else {
        return Promise.resolve({ searchEntries: [], searchReferences: [] });
      }
    }),
    bind: jest.fn(),
    unbind: jest.fn(),
  };

  return {
    Client: jest.fn(() => mockLdapClient),
  };
});

const user: User = {
  id: '1',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  apiKey: 'generatedApiKey',
  apiKeyEnding: null,
  password: 'encryptedPassword',
  isActive: true,
  jiraToken: null,
  jiraEmail: null,
  geminiApiKey: null,
  lastSignInAt: null,
  tokensValidAfter: null,
  role: Role.editor,
  updatedAt: new Date(),
  createdAt: new Date(),
};

describe('LdapUsersService match from ldap', () => {
  let service: LdapUsersService;
  let prismaService: PrismaService;
  let configService: ConfigService;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('true'),
            getOrThrow: jest.fn((string) => (string === 'LDAP_USERS_SEARCH_FILTER' ? '(&(mail={{email}}))' : string)),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn().mockResolvedValueOnce([]),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            generateApiKey: jest.fn(() => ({ key: 'newKey', stored: { apiKey: 'sha256:hash', apiKeyEnding: 'wKey' } })),
            unknownApiKey: jest.fn(() => 'generatedApiKey'),
            encryptPassword: jest.fn(() => 'encryptedPassword'),
            signToken: jest.fn(() => 'token'),
          },
        },
      ],
    }).compile();
    configService = module.get<ConfigService>(ConfigService);
    prismaService = module.get<PrismaService>(PrismaService);
    authService = module.get<AuthService>(AuthService);
    service = new LdapUsersService(configService, prismaService, authService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create new user on login', async () => {
    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(undefined);
    const prismaUserCreateMock = jest.spyOn(prismaService.user, 'create').mockResolvedValue(user);
    await service.login({ email: 'exists@example.com', password: 'password' });
    expect(prismaUserCreateMock).toHaveBeenCalled();
  });

  it('should login with user already in db', async () => {
    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user);
    const prismaUserCreateMock = jest.spyOn(prismaService.user, 'create');
    await service.login({ email: 'exists@example.com', password: 'password' });
    expect(prismaUserCreateMock).not.toHaveBeenCalled();
  });

  it.each(['', '   '])('turns away a sign-in with the password %p before asking the directory', async (password) => {
    const bind = new LdapClient({ url: '' }).bind as jest.Mock;
    bind.mockClear();
    await expect(service.login({ email: 'exists@example.com', password })).rejects.toThrow(
      'Invalid email or password.'
    );
    expect(bind).not.toHaveBeenCalled();
  });

  it("does not let anyone take a colleague's email for their account", async () => {
    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({ email: 'mallory@example.com' } as never);
    const update = jest.spyOn(prismaService.user, 'update');

    await expect(
      service.update('mallory', { email: 'exists@example.com', firstName: 'M', lastName: 'M' })
    ).rejects.toThrow('cannot be changed here');
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps the email and takes the names from the directory', async () => {
    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({ email: 'exists@example.com' } as never);
    const update = jest.spyOn(prismaService.user, 'update').mockResolvedValue(user);

    await service.update('1', { email: 'Exists@example.com', firstName: 'Typed', lastName: 'Name' });

    expect(update).toHaveBeenCalledWith({ where: { id: '1' }, data: { firstName: 'first', lastName: 'last' } });
  });

  it('lets a local account beside the directory rename itself, but not change its email', async () => {
    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({ email: 'local@example.com' } as never);
    const update = jest.spyOn(prismaService.user, 'update').mockResolvedValue(user);

    await service.update('2', { email: 'local@example.com', firstName: 'Ann', lastName: 'Lee' });

    expect(update).toHaveBeenCalledWith({ where: { id: '2' }, data: { firstName: 'Ann', lastName: 'Lee' } });
    expect(await service.isInDirectory('local@example.com')).toBe(false);
  });
});

describe('LdapUsersService with no results from ldap', () => {
  let service: LdapUsersService;
  let prismaService: PrismaService;
  let configService: ConfigService;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('true'),
            getOrThrow: jest.fn().mockReturnValue('string'),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn().mockResolvedValueOnce([]),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            generateApiKey: jest.fn(() => ({ key: 'newKey', stored: { apiKey: 'sha256:hash', apiKeyEnding: 'wKey' } })),
            unknownApiKey: jest.fn(() => 'generatedApiKey'),
            encryptPassword: jest.fn(() => 'encryptedPassword'),
          },
        },
      ],
    }).compile();
    configService = module.get<ConfigService>(ConfigService);
    prismaService = module.get<PrismaService>(PrismaService);
    authService = module.get<AuthService>(AuthService);
    service = new LdapUsersService(configService, prismaService, authService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should never change a password', async () => {
    const prismaUserCreateMock = jest.spyOn(prismaService.user, 'create');
    const prismaUserUpdateMock = jest.spyOn(prismaService.user, 'update');
    const result = await service.changePassword(user, 'newPassword');
    expect(prismaUserCreateMock).not.toHaveBeenCalled();
    expect(prismaUserUpdateMock).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('should not login when ldap search results are empty', async () => {
    expect.assertions(1);
    try {
      await service.login({ email: 'testÜ*()\\\0@example.com', password: 'password' });
    } catch (e) {
      expect(e.message).toBe('Invalid email or password.');
    }
  });
});
