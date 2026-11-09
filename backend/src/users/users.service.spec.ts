import { EventsGateway } from '../shared/events/events.gateway';
import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UsersFactoryService } from './users.factory';
import { Role, User } from '@prisma/client';
import { UserLoginResponseDto } from './dto/user-login-response.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { randomUUID } from 'crypto';
import { UserDto } from './dto/user.dto';
import { UpdateUserDto } from './dto/user-update.dto';
import { LdapUsersService } from './ldap/ldapusers.service';
import { OidcUsersService } from './oidc/oidcusers.service';

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

describe('UsersService with DbUserService implementation', () => {
  let service: UsersService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        UsersFactoryService,
        { provide: EventsGateway, useValue: { endSessions: jest.fn(), recheckAccess: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn().mockResolvedValueOnce([]),
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              findUnique: jest.fn().mockResolvedValueOnce(user),
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            endSessions: jest.fn(),
            endSession: jest.fn(),
            generateApiKey: jest.fn(() => ({ key: 'newKey', stored: { apiKey: 'sha256:hash', apiKeyEnding: 'wKey' } })),
            unknownApiKey: jest.fn(() => 'generatedApiKey'),
            encryptPassword: jest.fn(() => 'encryptedPassword'),
            compare: jest.fn(() => true),
            signToken: jest.fn(() => 'token'),
            renewToken: jest.fn(() => 'token'),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it("lets an admin set a user's password", async () => {
    const update = jest.spyOn(prismaService.user, 'update').mockResolvedValueOnce(user);

    expect(await service.setPassword('2', 'new-password')).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: '2' },
      data: { password: 'encryptedPassword' },
      select: { id: true },
    });
    await expect(service.setPassword('2', '  ')).rejects.toThrow('Password is required');
  });

  it('should generate new api key', async () => {
    // Arrange
    const prismaUserUpdateMock = jest.spyOn(prismaService.user, 'update');
    prismaUserUpdateMock.mockResolvedValueOnce(user);

    // Act
    const result = await service.generateNewApiKey(user);

    // Assert
    expect(prismaUserUpdateMock).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { apiKey: 'sha256:hash', apiKeyEnding: 'wKey' },
    });
    expect(result).toBe('newKey');
  });

  it('creates an account with the role the admin chose and no sign-in token', async () => {
    const create = jest.spyOn(prismaService.user, 'create').mockResolvedValueOnce({ ...user, role: Role.editor });

    const result = await service.createAccount({
      email: '  New.Person@Example.com ',
      firstName: ' Ann ',
      lastName: 'Lee',
      role: Role.editor,
      password: 'long-secret-1',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        email: 'new.person@example.com',
        firstName: 'Ann',
        lastName: 'Lee',
        role: Role.editor,
        apiKey: 'generatedApiKey',
        password: 'encryptedPassword',
      },
    });
    expect(result).toBeInstanceOf(UserDto);
    expect(result.role).toBe(Role.editor);
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('password');
  });

  it('creates an account without names', async () => {
    const create = jest.spyOn(prismaService.user, 'create').mockResolvedValueOnce(user);
    await service.createAccount({ email: 'a@example.com', role: Role.guest, password: 'long-secret-1' });
    expect(create.mock.calls[0][0].data).toMatchObject({ firstName: '', lastName: '', role: Role.guest });
  });

  it('refuses an email that is taken in any letter case', async () => {
    const findFirst = jest.spyOn(prismaService.user, 'findFirst').mockResolvedValueOnce({ id: '1' } as never);
    const create = jest.spyOn(prismaService.user, 'create');

    await expect(
      service.createAccount({ email: 'Test@Example.com', role: Role.guest, password: 'long-secret-1' })
    ).rejects.toThrow('This email is already taken');
    expect(findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'test@example.com', mode: 'insensitive' } },
      select: { id: true },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses an account without a password', async () => {
    const create = jest.spyOn(prismaService.user, 'create');
    await expect(service.createAccount({ email: 'a@example.com', role: Role.guest, password: ' ' })).rejects.toThrow(
      'Password is required'
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('takes a local password of 12 characters or more only', async () => {
    for (const short of ['', '   ', 'eleven-char']) {
      await expect(
        service.createAccount({ email: 'a@example.com', role: Role.guest, password: short })
      ).rejects.toThrow(short.trim() ? 'at least 12 characters' : 'Password is required');
      await expect(service.setPassword('2', short)).rejects.toThrow(HttpException);
      await expect(service.changePassword(user, short)).rejects.toThrow(HttpException);
    }
    // signing in does not check it: a short password set before keeps working
    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(user);
    await expect(service.login({ email: user.email, password: 'short' })).resolves.toBeDefined();
  });

  it('closes an email after 5 wrong passwords, the right one too', async () => {
    const auth = (service as unknown as { authService: { compare: jest.Mock } }).authService;
    auth.compare.mockResolvedValue(false);
    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user);
    for (let i = 0; i < 5; i++) {
      await expect(service.login({ email: 'guess@example.com', password: 'wrong' })).rejects.toThrow('Invalid');
    }
    auth.compare.mockResolvedValue(true);
    await expect(service.login({ email: 'guess@example.com', password: 'right' })).rejects.toThrow(
      'Too many attempts: try again in 15 minutes'
    );
  });

  it('lets accounts be created when sign-in goes through the database', () => {
    expect(service.canCreateAccounts()).toBe(true);
  });

  it('should update a user', async () => {
    // Arrange
    const updateUserDto: UpdateUserDto = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
    };

    const prismaUserUpdateMock = jest.spyOn(prismaService.user, 'update');
    prismaUserUpdateMock.mockResolvedValueOnce(user);

    // Act
    const result = await service.update(user.id, updateUserDto);

    // Assert
    expect(prismaUserUpdateMock).toHaveBeenCalled();
    expect(result).toEqual(expect.any(UserLoginResponseDto));
  });

  // the new token keeps the sign-in the request came with, so signing out ends both (VIS-SEC-059)
  it('saves the profile without a new sign-in', async () => {
    jest.spyOn(prismaService.user, 'update').mockResolvedValueOnce(user);

    await service.update(user.id, { email: user.email, firstName: 'John', lastName: 'Doe' }, 'this-sign-in');

    const auth = (service as unknown as { authService: Record<string, jest.Mock> }).authService;
    expect(auth.renewToken).toHaveBeenCalledWith(user, 'this-sign-in');
    expect(auth.signToken).not.toHaveBeenCalled();
  });

  it('should change password', async () => {
    // Arrange
    const prismaUserUpdateMock = jest.spyOn(prismaService.user, 'update');
    prismaUserUpdateMock.mockResolvedValueOnce(user);

    // Act
    const result = await service.changePassword(user, 'new-password-1');

    // Assert
    expect(result).toEqual(true);
  });

  it('should login existing user', async () => {
    // Act
    const result = await service.login({ email: 'test@example.com', password: 'doesntmatter' });

    // Assert
    expect(result).toEqual(expect.any(UserLoginResponseDto));
  });

  it('records the sign-in time on password and SSO sign-in only', async () => {
    await service.login({ email: 'test@example.com', password: 'doesntmatter' });

    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { lastSignInAt: expect.any(Date) },
      select: { id: true },
    });

    // other account actions are not sign-ins
    (prismaService.user.update as jest.Mock).mockClear();
    (prismaService.user.update as jest.Mock).mockResolvedValueOnce(user);
    await service.generateNewApiKey(user);
    expect(prismaService.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastSignInAt: expect.any(Date) } })
    );
  });

  it('lets a sign-in through when recording it fails', async () => {
    (prismaService.user.update as jest.Mock).mockRejectedValueOnce(new Error('db down'));

    await expect(service.login({ email: 'test@example.com', password: 'x' })).resolves.toEqual(
      expect.any(UserLoginResponseDto)
    );
  });

  it('should delete existing user', async () => {
    // Arrange
    const prismaUserDeleteMock = jest.spyOn(prismaService.user, 'delete');
    prismaUserDeleteMock.mockResolvedValueOnce(user);

    // Act
    await service.delete(user.id);

    // Assert
    expect(prismaUserDeleteMock).toHaveBeenCalled();
  });

  it('should get existing user', async () => {
    // Act
    const result = await service.get(user.id);

    // Assert
    expect(result).toBeInstanceOf(UserDto);
  });

  it('should assign role to user', async () => {
    // Arrange
    const assignRoleDto: AssignRoleDto = {
      id: randomUUID(),
      role: Role.editor,
    };

    const prismaUserCreateMock = jest.spyOn(prismaService.user, 'update');
    prismaUserCreateMock.mockResolvedValueOnce(user);

    // Act
    const result = await service.assignRole(assignRoleDto);

    // Assert
    expect(prismaUserCreateMock).toHaveBeenCalled();
    expect(result).toBeInstanceOf(UserDto);
  });

  it('reports OIDC as disabled for the DB implementation', () => {
    expect(service.isOidcEnabled()).toBe(false);
  });

  it('rejects OIDC helpers when OIDC is disabled', async () => {
    await expect(service.oidcGetAuthorizationUrl()).rejects.toThrow('OIDC is not enabled.');
  });
});

describe('UsersService with OidcUsersService implementation', () => {
  let service: UsersService;
  let oidcUsersService: OidcUsersService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    oidcUsersService = Object.assign(Object.create(OidcUsersService.prototype), {
      getAuthorizationUrl: jest.fn(),
      handleCallback: jest.fn(),
      buildFrontendRedirect: jest.fn(),
    }) as OidcUsersService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersFactoryService, useValue: { getUsersService: () => oidcUsersService } },
        { provide: PrismaService, useValue: { user: { update: jest.fn() } } },
        { provide: AuthService, useValue: {} },
        { provide: EventsGateway, useValue: { endSessions: jest.fn(), recheckAccess: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('signs in a local account beside LDAP and SSO', async () => {
    // an admin creates local accounts in any mode (REQ-045-01, replaces REQ-035-16)
    expect(service.canCreateAccounts()).toBe(true);
    const local = { ...user, email: 'contractor@bank.test', password: 'hash' };
    const findUnique = jest.fn().mockResolvedValue(local);
    Object.assign(prismaService.user, { findUnique });
    const auth = (service as unknown as { authService: object }).authService as Record<string, unknown>;
    Object.assign(auth, { compare: jest.fn(async () => true), signToken: jest.fn(() => 'jwt') });
    const signedIn = await service.login({ email: 'contractor@bank.test', password: 'their-password' });
    expect(signedIn.token).toBe('jwt');
    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'contractor@bank.test' } });

    // beside LDAP: the directory decides for its people, a local password for the rest
    const ldap = Object.assign(Object.create(LdapUsersService.prototype), {
      isInDirectory: jest.fn(async (email: string) => email === 'ann@bank.test'),
      login: jest.fn(async () => ({ id: 'ann', token: 'from-ldap' })),
    });
    const withLdap = new UsersService(
      { getUsersService: () => ldap } as never,
      { user: { findUnique, update: jest.fn() } } as never,
      auth as never,
      { endSessions: jest.fn(), recheckAccess: jest.fn() } as never
    );
    expect((await withLdap.login({ email: 'ann@bank.test', password: 'x' })).token).toBe('from-ldap');
    expect((await withLdap.login({ email: 'contractor@bank.test', password: 'x' })).token).toBe('jwt');
    expect(ldap.login).toHaveBeenCalledTimes(1);
  });

  // found in review of 052: LDAP answers true for its people and stores nothing
  it('ends no sign-in of a directory person whose password Vision cannot change', async () => {
    const ldap = Object.assign(Object.create(LdapUsersService.prototype), {
      isInDirectory: jest.fn(async (email: string) => email === 'ann@bank.test'),
      changePassword: jest.fn(async () => true),
    });
    const auth = { endSessions: jest.fn(), encryptPassword: jest.fn(async () => 'hash') };
    const events = { endSessions: jest.fn(), recheckAccess: jest.fn() };
    const withLdap = new UsersService(
      { getUsersService: () => ldap } as never,
      { user: { update: jest.fn(async () => ({})) } } as never,
      auth as never,
      events as never
    );

    await withLdap.changePassword({ ...user, id: 'ann', email: 'ann@bank.test' }, 'new-password-1', 'sid');
    expect(auth.endSessions).not.toHaveBeenCalled();
    expect(events.endSessions).not.toHaveBeenCalled();

    // a local account beside LDAP has a password here: its other sign-ins end
    await withLdap.changePassword({ ...user, id: 'bob', email: 'bob@bank.test' }, 'new-password-1', 'sid');
    expect(auth.endSessions).toHaveBeenCalledWith('bob', 'sid');
    expect(events.endSessions).toHaveBeenCalledWith('bob', { keep: 'sid' });
  });

  it('checks the projects of open sockets again after a sign-in through SSO', async () => {
    const events = (service as unknown as { eventsGateway: { recheckAccess: jest.Mock } }).eventsGateway;
    const oidc = (service as unknown as { usersService: { handleCallback?: unknown } }).usersService;
    Object.assign(oidc, { handleCallback: jest.fn(async () => ({ id: 'ann', token: 't' })) });

    await service.oidcHandleCallback({ code: 'c' }, { state: 's', codeVerifier: 'v' });

    expect(events.recheckAccess).toHaveBeenCalledWith('ann');
  });

  it('reports OIDC as enabled', () => {
    expect(service.isOidcEnabled()).toBe(true);
  });

  it('records the sign-in time on SSO sign-in', async () => {
    (oidcUsersService.handleCallback as jest.Mock).mockResolvedValue({ id: 'sso-user', token: 'jwt' });

    await service.oidcHandleCallback({ code: 'code' }, { state: 'state', codeVerifier: 'verifier' });

    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { id: 'sso-user' },
      data: { lastSignInAt: expect.any(Date) },
      select: { id: true },
    });
  });

  it('delegates authorization url, callback and redirect building', async () => {
    const authorization = { url: 'https://idp/authorize', state: 'state', codeVerifier: 'verifier' };
    (oidcUsersService.getAuthorizationUrl as jest.Mock).mockResolvedValue(authorization);
    (oidcUsersService.handleCallback as jest.Mock).mockResolvedValue({ token: 'jwt' });
    (oidcUsersService.buildFrontendRedirect as jest.Mock).mockReturnValue('redirect-url');

    await expect(service.oidcGetAuthorizationUrl()).resolves.toEqual(authorization);
    await expect(
      service.oidcHandleCallback({ code: 'code' }, { state: 'state', codeVerifier: 'verifier' })
    ).resolves.toEqual({ token: 'jwt' });
    expect(service.oidcBuildFrontendRedirect('jwt')).toBe('redirect-url');
  });
});
