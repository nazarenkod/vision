import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import { TEST_PROJECT } from '../src/_data_';
import { AppModule } from '../src/app.module';
import { ProjectAccessService } from '../src/projects/project-access.service';
import { ProjectsService } from '../src/projects/projects.service';
import { globalPipes } from '../src/shared/strip-unknown-fields.pipe';
import { UsersService } from '../src/users/users.service';
import { generateUser, requestWithApiKey, requestWithAuth } from './preconditions';

/*
 * Sign-ins as people and the interface use them (052), on a real database and a real events
 * socket. The first tests pin what works today and must keep working; the rest are the sessions
 * spec 052 asks for.
 */

describe('Sign-ins and their sessions (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let usersService: UsersService;
  let projectsService: ProjectsService;
  let access: ProjectAccessService;
  let jwt: JwtService;
  const cleanup: Array<() => Promise<unknown>> = [];
  const sockets: Socket[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(...globalPipes());
    usersService = moduleFixture.get(UsersService);
    projectsService = moduleFixture.get(ProjectsService);
    access = moduleFixture.get(ProjectAccessService);
    jwt = moduleFixture.get(JwtService);
    await app.listen(0);
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    sockets.splice(0).forEach((socket) => socket.close());
    while (cleanup.length) await cleanup.pop()!().catch(() => undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  const password = 'long-enough-password';
  const person = async (role: Role = 'editor') => {
    const account = await usersService.createAccount(generateUser(password, role));
    cleanup.push(() => usersService.delete(account.id).catch(() => undefined));
    return account;
  };
  // a sign-in in a browser of its own
  const signIn = async (email: string) =>
    (await requestWithAuth(app, 'post', '/users/login', '').send({ email, password }).expect(201)).body.token as string;
  const project = async (members: string[] = []) => {
    const created = await projectsService.create({ ...TEST_PROJECT, name: `Sessions e2e ${randomUUID()}` } as never);
    cleanup.push(() => projectsService.remove(created.id));
    for (const member of members) await access.grant(created.id, member);
    return created;
  };
  const me = (token: string) => requestWithAuth(app, 'get', '/users/me', token);

  // the events socket of the interface; resolves once connected, rejects with the server's reason
  const connect = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(url, { transports: ['websocket'], reconnection: false, forceNew: true, auth: { token } });
      sockets.push(socket);
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  const subscribe = (socket: Socket, projectId: string) =>
    socket.emitWithAck('subscribe', { projectId }) as Promise<{ ok: boolean }>;

  describe('as it works today', () => {
    it('keeps working as before for people who stay signed in', async () => {
      const editor = await person('editor');
      const team = await project([editor.id]);
      const laptop = await signIn(editor.email);
      const phone = await signIn(editor.email);

      for (const token of [laptop, phone]) {
        expect((await me(token).expect(200)).body.email).toBe(editor.email);
        const projects = await requestWithAuth(app, 'get', '/projects', token).expect(200);
        expect(projects.body.map((item: { id: string }) => item.id)).toContain(team.id);
      }
      const socket = await connect(laptop);
      expect(await subscribe(socket, team.id)).toEqual({ ok: true });

      // the key of the SDK, the CLI and MCP
      const key = await usersService.generateNewApiKey({ id: editor.id } as never);
      await requestWithApiKey(app, 'post', '/builds', key).send({ project: team.id, branchName: 'master' }).expect(201);
    });

    it('takes a token issued before the update until the person signs out', async () => {
      const editor = await person('editor');
      // as the API signed tokens before 052: the email alone
      const old = jwt.sign({ email: editor.email });

      expect((await me(old).expect(200)).body.email).toBe(editor.email);
      await connect(old);
    });

    it('refuses a token of an account that is gone, and no token at all', async () => {
      const editor = await person('editor');
      const token = await signIn(editor.email);
      await usersService.delete(editor.id);

      await me(token).expect(401);
      await me('').expect(401);
      await expect(connect(token)).rejects.toThrow();
    });
  });
});
