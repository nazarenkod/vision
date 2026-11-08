import { AuthService } from '../auth/auth.service';
import { openSecret } from '../shared/secret-box';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ConfigService } from '@nestjs/config';
import { Role, User } from '@prisma/client';
import { UserDto } from './dto/user.dto';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';

const routeOf = (name: string) => {
  const handler = UsersController.prototype[name];
  return {
    path: Reflect.getMetadata(PATH_METADATA, handler) as string,
    method: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod,
    guards: (Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[],
    roles: Reflect.getMetadata('roles', handler) as Role[] | undefined,
  };
};

describe('Users Controller', () => {
  let controller: UsersController;
  let usersService: {
    isOidcEnabled: jest.Mock;
    oidcGetAuthorizationUrl: jest.Mock;
    oidcBuildFrontendRedirect: jest.Mock;
    oidcBuildStartPage: jest.Mock;
    oidcHandleCallback: jest.Mock;
  };

  const user: User = {
    id: '1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    apiKey: 'api-key',
    apiKeyEnding: null,
    password: 'encrypted',
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

  beforeEach(async () => {
    usersService = {
      isOidcEnabled: jest.fn(),
      oidcGetAuthorizationUrl: jest.fn(),
      oidcBuildFrontendRedirect: jest.fn(),
      oidcBuildStartPage: jest.fn(),
      oidcHandleCallback: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: PrismaService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn((_key: string, defaultValue?: string) => defaultValue) } },
        { provide: AuthService, useValue: { sessionIdOf: jest.fn() } },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns the current user', () => {
    const result = controller.me(user);
    expect(result).toBeInstanceOf(UserDto);
    expect(result.email).toBe('test@example.com');
  });

  it('stores a personal Gemini key and answers only whether one is set', async () => {
    const update = jest.fn(async ({ data }) => ({ ...user, ...data }));
    const prisma = { user: { update } };
    const withPrisma = new UsersController(
      usersService as never,
      prisma as never,
      { get: jest.fn() } as never,
      {} as never
    );

    const saved = await withPrisma.setGemini(user, { geminiApiKey: ' key-1 ' });
    // stored sealed (044), and readable back with the server's key only
    const stored = update.mock.calls[0][0].data.geminiApiKey;
    expect(stored).toMatch(/^enc:v1:/);
    expect(openSecret(stored)).toBe('key-1');
    expect(saved.geminiKeySet).toBe(true);
    expect(JSON.stringify(saved)).not.toContain('key-1');

    const removed = await withPrisma.setGemini(user, { geminiApiKey: '' });
    expect(update).toHaveBeenLastCalledWith({ where: { id: '1' }, data: { geminiApiKey: null } });
    expect(removed.geminiKeySet).toBe(false);
  });

  it('has no route for signing oneself up', () => {
    const routes = Object.getOwnPropertyNames(UsersController.prototype)
      .filter((name) => name !== 'constructor')
      .map(routeOf)
      .filter((route) => route.path !== undefined);
    expect(routes.map((route) => route.path)).not.toContain('register');
    // every route that creates something wants a signed-in caller, apart from signing in itself
    const open = routes.filter((route) => route.method === RequestMethod.POST && !route.guards.length);
    expect(open.map((route) => route.path)).toEqual(['login']);
  });

  it('lets only admins create accounts', () => {
    const route = routeOf('createAccount');
    expect(route.method).toBe(RequestMethod.POST);
    expect(route.path).toBe('/');
    expect(route.guards).toEqual([JwtAuthGuard, RoleGuard]);
    expect(route.roles).toEqual([Role.admin]);
  });

  it('says whether accounts can be created here', () => {
    const canCreateAccounts = jest.fn(() => false);
    const withService = new UsersController(
      { canCreateAccounts } as never,
      {} as never,
      { get: jest.fn() } as never,
      {} as never
    );
    expect(withService.accountsEnabled()).toBe(false);
  });

  it('writes Jira and Gemini secrets only to the signed-in person', async () => {
    const update = jest.fn(async ({ data }) => ({ ...user, ...data }));
    const withPrisma = new UsersController(
      usersService as never,
      { user: { update } } as never,
      { get: jest.fn() } as never,
      {} as never
    );

    const jira = await withPrisma.setJira(user, { jiraToken: 'token-1', jiraEmail: 'me@example.com' });
    const gemini = await withPrisma.setGemini(user, { geminiApiKey: 'key-1' });

    expect(update.mock.calls.map(([args]) => args.where)).toEqual([{ id: '1' }, { id: '1' }]);
    expect(openSecret(update.mock.calls[0][0].data.jiraToken)).toBe('token-1');
    expect(JSON.stringify(update.mock.calls)).not.toMatch(/token-1|key-1/);
    expect(JSON.stringify([jira, gemini])).not.toMatch(/token-1|key-1/);
    // no route takes somebody else's id together with a Jira token or a Gemini key
    for (const name of ['setJira', 'setGemini']) {
      expect(routeOf(name).path).not.toContain(':');
    }
  });

  it('reports whether OIDC is enabled', () => {
    usersService.isOidcEnabled.mockReturnValue(true);
    expect(controller.oidcEnabled()).toBe(true);
  });

  it('redirects to the frontend with an error when the state cookie is missing', async () => {
    usersService.isOidcEnabled.mockReturnValue(true);
    usersService.oidcBuildFrontendRedirect.mockReturnValue('http://localhost:8080/login#error=oidc_login_failed');
    const res = { clearCookie: jest.fn(), redirect: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() };

    await controller.oidcCallback({ headers: {}, query: {} } as never, res as never);

    expect(usersService.oidcHandleCallback).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:8080/login#error=oidc_login_failed');
  });

  it('redirects to the frontend with an error when the state cookie is malformed', async () => {
    usersService.isOidcEnabled.mockReturnValue(true);
    usersService.oidcBuildFrontendRedirect.mockReturnValue('http://localhost:8080/login#error=oidc_login_failed');
    const res = { clearCookie: jest.fn(), redirect: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() };

    await controller.oidcCallback({ headers: { cookie: 'oidc_state=%E0%A4%A' }, query: {} } as never, res as never);

    expect(usersService.oidcHandleCallback).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:8080/login#error=oidc_login_failed');
  });

  it('redirects to the frontend with an error when the identity provider is unreachable', async () => {
    usersService.isOidcEnabled.mockReturnValue(true);
    usersService.oidcGetAuthorizationUrl.mockRejectedValue(new Error('discovery down'));
    usersService.oidcBuildFrontendRedirect.mockReturnValue('http://localhost:8080/login#error=oidc_login_failed');
    const res = { cookie: jest.fn(), redirect: jest.fn() };

    await controller.oidcLogin(res as never, 'Zm9vYmFyYmF6cXV4MTIzNDU2');

    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:8080/login#error=oidc_login_failed');
  });

  it('returns 404 on login when OIDC is disabled', async () => {
    usersService.isOidcEnabled.mockReturnValue(false);
    const res = { cookie: jest.fn(), redirect: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() };

    await controller.oidcLogin(res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(usersService.oidcGetAuthorizationUrl).not.toHaveBeenCalled();
  });

  it('redirects to the identity provider and stores the PKCE state cookie', async () => {
    usersService.isOidcEnabled.mockReturnValue(true);
    usersService.oidcGetAuthorizationUrl.mockResolvedValue({
      url: 'https://idp.example.com/authorize',
      state: 'state',
      codeVerifier: 'verifier',
    });
    const res = { cookie: jest.fn(), redirect: jest.fn() };

    await controller.oidcLogin(res as never, 'Zm9vYmFyYmF6cXV4MTIzNDU2');

    expect(res.cookie).toHaveBeenCalledWith(
      'oidc_state',
      `state.verifier.${'Zm9vYmFyYmF6cXV4MTIzNDU2'}`,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' })
    );
    expect(res.redirect).toHaveBeenCalledWith('https://idp.example.com/authorize');
  });

  it('redirects to the frontend with the token after a successful callback', async () => {
    usersService.isOidcEnabled.mockReturnValue(true);
    usersService.oidcHandleCallback.mockResolvedValue({ token: 'jwt' });
    usersService.oidcBuildFrontendRedirect.mockReturnValue('http://localhost:8080/login#token=jwt');
    const res = { clearCookie: jest.fn(), redirect: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() };
    const req = {
      headers: { cookie: 'oidc_state=state.verifier' },
      query: { code: 'code', state: 'state', repeated: ['a', 'b'] },
    };

    await controller.oidcCallback(req as never, res as never);

    expect(usersService.oidcHandleCallback).toHaveBeenCalledWith(
      { code: 'code', state: 'state' },
      { state: 'state', codeVerifier: 'verifier' }
    );
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:8080/login#token=jwt');
  });

  // the tab that started the sign-in is the only one that takes its token (052, REQ-052-07)
  it('hands the nonce of the sign-in back with the token', async () => {
    usersService.isOidcEnabled.mockReturnValue(true);
    usersService.oidcGetAuthorizationUrl.mockResolvedValue({
      url: 'https://idp.example.com/authorize',
      state: 'state',
      codeVerifier: 'verifier',
    });
    const login = { cookie: jest.fn(), redirect: jest.fn() };
    const nonce = 'Zm9vYmFyYmF6cXV4MTIzNDU2';

    await controller.oidcLogin(login as never, nonce);

    expect(login.cookie).toHaveBeenCalledWith('oidc_state', `state.verifier.${nonce}`, expect.anything());
    usersService.oidcHandleCallback.mockResolvedValue({ token: 'jwt' });
    usersService.oidcBuildFrontendRedirect.mockReturnValue('http://localhost:8080/login#token=jwt&nonce=x');
    const res = { clearCookie: jest.fn(), redirect: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() };

    await controller.oidcCallback(
      { headers: { cookie: `oidc_state=state.verifier.${nonce}` }, query: { code: 'code', state: 'state' } } as never,
      res as never
    );

    expect(usersService.oidcHandleCallback).toHaveBeenCalledWith(
      { code: 'code', state: 'state' },
      { state: 'state', codeVerifier: 'verifier' }
    );
    expect(usersService.oidcBuildFrontendRedirect).toHaveBeenLastCalledWith('jwt', undefined, nonce);
  });

  // a tile of the provider or a bookmark opens /users/oidc/login with no value of a tab (052)
  it('sends a sign-in started outside Vision to its page to start again from the tab', async () => {
    usersService.isOidcEnabled.mockReturnValue(true);
    usersService.oidcBuildStartPage.mockReturnValue('http://localhost:8080/login?sso');
    const login = { cookie: jest.fn(), redirect: jest.fn() };

    for (const nonce of [undefined, 'short', 'with.a.dot.in.it.and.long.enough']) {
      await controller.oidcLogin(login as never, nonce);
    }

    expect(login.cookie).not.toHaveBeenCalled();
    expect(usersService.oidcGetAuthorizationUrl).not.toHaveBeenCalled();
    expect(login.redirect.mock.calls).toEqual([
      ['http://localhost:8080/login?sso'],
      ['http://localhost:8080/login?sso'],
      ['http://localhost:8080/login?sso'],
    ]);
  });

  it('returns 404 on the callback when OIDC is disabled', async () => {
    usersService.isOidcEnabled.mockReturnValue(false);
    const res = { clearCookie: jest.fn(), redirect: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() };

    await controller.oidcCallback({ headers: {}, query: {} } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalled();
  });
});
