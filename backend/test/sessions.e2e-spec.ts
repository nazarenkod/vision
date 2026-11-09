import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import { TEST_PROJECT } from '../src/_data_';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
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
  let auth: AuthService;
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
    auth = moduleFixture.get(AuthService);
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
  const buildIn = async (projectId: string) => {
    const owner = await person('admin');
    const key = await usersService.generateNewApiKey({ id: owner.id } as never);
    await requestWithApiKey(app, 'post', '/builds', key).send({ project: projectId, branchName: 'master' }).expect(201);
  };

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

  describe('spec 052', () => {
    const closed = (socket: Socket) =>
      new Promise<void>((resolve, reject) => {
        if (socket.disconnected) return resolve();
        const timer = setTimeout(() => reject(new Error('the socket is still open after 5 s')), 5000);
        socket.once('disconnect', () => {
          clearTimeout(timer);
          resolve();
        });
      });

    it('signing out ends this browser only', async () => {
      const editor = await person('editor');
      const laptop = await signIn(editor.email);
      const phone = await signIn(editor.email);
      const laptopSocket = await connect(laptop);
      const phoneSocket = await connect(phone);

      await requestWithAuth(app, 'post', '/users/logout', laptop).expect(204);

      await me(laptop).expect(401);
      await closed(laptopSocket);
      await expect(connect(laptop)).rejects.toThrow();
      // the other browser is still in
      await me(phone).expect(200);
      expect(phoneSocket.connected).toBe(true);
    });

    it('a new password ends the other sign-ins and keeps this one', async () => {
      const editor = await person('editor');
      const laptop = await signIn(editor.email);
      const phone = await signIn(editor.email);
      const laptopSocket = await connect(laptop);
      const phoneSocket = await connect(phone);

      await requestWithAuth(app, 'put', '/users/password', laptop)
        .send({ password: 'another-long-password' })
        .expect(200);

      await me(phone).expect(401);
      await closed(phoneSocket);
      await me(laptop).expect(200);
      expect(laptopSocket.connected).toBe(true);
      // the new password signs in, the old one does not
      await requestWithAuth(app, 'post', '/users/login', '')
        .send({ email: editor.email, password: 'another-long-password' })
        .expect(201);
      await requestWithAuth(app, 'post', '/users/login', '').send({ email: editor.email, password }).expect(400);
    });

    it('a password set by an admin ends every sign-in', async () => {
      const admin = await person('admin');
      const editor = await person('editor');
      const adminToken = await signIn(admin.email);
      const laptop = await signIn(editor.email);
      const socket = await connect(laptop);

      await requestWithAuth(app, 'put', `/users/${editor.id}/password`, adminToken)
        .send({ password: 'given-by-the-admin-1' })
        .expect(200);

      await me(laptop).expect(401);
      await closed(socket);
      await me(adminToken).expect(200);
    });

    it('closes the event sockets of an ended sign-in and a deleted account', async () => {
      const admin = await person('admin');
      const editor = await person('editor');
      const adminToken = await signIn(admin.email);
      const socket = await connect(await signIn(editor.email));

      await requestWithAuth(app, 'delete', '/users', adminToken).send([editor.id]).expect(200);

      await closed(socket);
    });

    it('the API key works whatever the person does with their sign-ins', async () => {
      const editor = await person('editor');
      const team = await project([editor.id]);
      const key = await usersService.generateNewApiKey({ id: editor.id } as never);
      const token = await signIn(editor.email);

      await requestWithAuth(app, 'put', '/users/password', token)
        .send({ password: 'another-long-password' })
        .expect(200);
      await requestWithAuth(app, 'post', '/users/logout', token).expect(204);

      await requestWithApiKey(app, 'post', '/builds', key).send({ project: team.id, branchName: 'master' }).expect(201);
    });

    it('stops the events of a project after a new role takes it away', async () => {
      const admin = await person('admin');
      const lead = await person('admin');
      const team = await project();
      const shared = await project([lead.id]);
      const socket = await connect(await signIn(lead.email));
      expect(await subscribe(socket, team.id)).toEqual({ ok: true });
      const events: unknown[] = [];
      socket.on('build_created', (payload) => events.push(payload));

      await requestWithAuth(app, 'patch', '/users/assignRole', await signIn(admin.email))
        .send({ id: lead.id, role: 'editor' })
        .expect(200);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await buildIn(team.id);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      expect(events).toEqual([]);

      // a project the person has access to keeps sending its events
      expect(await subscribe(socket, shared.id)).toEqual({ ok: true });
      await buildIn(shared.id);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      expect(events.length).toBeGreaterThan(0);
    });

    // found in review: a sign-out between the socket's check and its joining the server's list
    it('closes a socket whose sign-in ended while it was connecting', async () => {
      const editor = await person('editor');
      const token = await signIn(editor.email);
      const socket = await connect(token);
      // ended in the database only, as a sign-out the socket list did not yet see
      await auth.endSession(editor.id, auth.sessionIdOf(`Bearer ${token}`));

      await closed(socket);
    });

    it('ends the old tokens of a person who signs out with one', async () => {
      const editor = await person('editor');
      const old = jwt.sign({ email: editor.email, iat: Math.floor(Date.now() / 1000) - 60 });
      const fresh = await signIn(editor.email);

      await requestWithAuth(app, 'post', '/users/logout', old).expect(204);

      await me(old).expect(401);
      // a sign-in with a session of its own is not an old token
      await me(fresh).expect(200);
    });

    // Saving the profile hands the browser a new token. It opened a new sign-in and left the one
    // before it running, so signing out ended only the new one: a token copied earlier still opened
    // the API (VIS-SEC-059, audit 2026-11-08)
    it('saving the profile keeps the same sign-in, and signing out ends every token of it', async () => {
      const editor = await person('editor');
      const before = await signIn(editor.email);
      const phone = await signIn(editor.email);
      const socket = await connect(before);

      const saved = await requestWithAuth(app, 'put', '/users', before)
        .send({ email: editor.email, firstName: 'New', lastName: 'Name' })
        .expect(200);
      const after = saved.body.token as string;
      expect(auth.sessionIdOf(`Bearer ${after}`)).toBe(auth.sessionIdOf(`Bearer ${before}`));
      await me(after).expect(200);
      await me(before).expect(200);
      expect(socket.connected).toBe(true);

      await requestWithAuth(app, 'post', '/users/logout', after).expect(204);

      await me(after).expect(401);
      await me(before).expect(401);
      await closed(socket);
      // another browser of the person is another sign-in
      await me(phone).expect(200);
    });
  });
});
