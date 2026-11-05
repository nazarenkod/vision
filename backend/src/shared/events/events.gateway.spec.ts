import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TestRun } from '@prisma/client';
import { AddressInfo } from 'net';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { AuthService } from '../../auth/auth.service';
import { BuildDto } from '../../builds/dto/build.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from './events.gateway';

// A real socket.io server and client: the handshake and the rooms are what
// spec 032 is about, and mocks of socket.io would not show either.

const SECRET = 'events-secret';
const signer = new JwtService({ secret: SECRET });
const users = new Map([
  ['guest@example.com', 'user-guest'],
  ['editor@example.com', 'user-editor'],
]);
const projects = new Set(['project-a', 'project-b']);
const builds = new Map([
  ['build-a', 'project-a'],
  ['build-b', 'project-b'],
]);

const prisma = {
  user: {
    findUnique: jest.fn(async ({ where }) => {
      if (where.email) return users.has(where.email) ? { id: users.get(where.email) } : null;
      return [...users.values()].includes(where.id) ? { id: where.id, role: 'editor' } : null;
    }),
  },
  project: {
    findUnique: jest.fn(async ({ where }) => (projects.has(where.id) ? { id: where.id } : null)),
  },
  build: {
    findMany: jest.fn(async ({ where }) =>
      where.id.in.filter((id) => builds.has(id)).map((id) => ({ id, projectId: builds.get(id) }))
    ),
  },
  testRun: { groupBy: jest.fn(async () => []) },
  // who was given which project (042); every pair unless a test takes one away
  projectAccess: {
    findUnique: jest.fn(async ({ where }) =>
      granted.has(`${where.userId_projectId.userId}:${where.userId_projectId.projectId}`)
        ? { projectId: where.userId_projectId.projectId }
        : null
    ),
  },
};
const everyPair = () => [...users.values()].flatMap((user) => [...projects].map((project) => `${user}:${project}`));
let granted = new Set(everyPair());

const tokenFor = (email: string) => signer.sign({ email }, { expiresIn: '1h' });
const testRun = (id: string, buildId: string, projectId: string | null) =>
  ({ id, buildId, projectId }) as unknown as TestRun;

describe('EventsGateway', () => {
  let app: INestApplication;
  let gateway: EventsGateway;
  let url: string;
  const clients: ClientSocket[] = [];

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: SECRET })],
      providers: [EventsGateway, AuthService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    gateway = app.get(EventsGateway);
    url = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    clients.splice(0).forEach((client) => client.close());
    await app.close();
  });

  const client = (options: Parameters<typeof io>[1] = {}) => {
    const socket = io(url, { transports: ['websocket'], reconnection: false, forceNew: true, ...options });
    clients.push(socket);
    return socket;
  };

  // resolves with the client once connected, rejects with the server's reason
  const connect = (options: Parameters<typeof io>[1] = {}) =>
    new Promise<ClientSocket>((resolve, reject) => {
      const socket = client(options);
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', (error) => reject(error));
    });

  const connectAs = (email: string) => connect({ auth: { token: tokenFor(email) } });

  const subscribe = (socket: ClientSocket, projectId: string | null) =>
    socket.emitWithAck('subscribe', { projectId }) as Promise<{ ok: boolean }>;

  // everything a client receives, by event name
  const record = (socket: ClientSocket) => {
    const received: Record<string, unknown[]> = {};
    socket.onAny((event, payload) => (received[event] ??= []).push(payload));
    return received;
  };

  const nextEvent = (socket: ClientSocket, event: string) =>
    new Promise<unknown>((resolve) => socket.once(event, resolve));

  const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

  it('rejects a connection without a token', async () => {
    await expect(connect()).rejects.toThrow('unauthorized');
  });

  it('rejects a token signed with another secret', async () => {
    const forged = new JwtService({ secret: 'not-vision' }).sign({ email: 'guest@example.com' });
    await expect(connect({ auth: { token: forged } })).rejects.toThrow('unauthorized');
  });

  it('rejects an expired token', async () => {
    const expired = signer.sign({ email: 'guest@example.com', exp: Math.floor(Date.now() / 1000) - 10 });
    await expect(connect({ auth: { token: expired } })).rejects.toThrow('unauthorized');
  });

  it('rejects a token of a user who no longer exists', async () => {
    await expect(connectAs('deleted@example.com')).rejects.toThrow('unauthorized');
  });

  it('accepts a valid token of a guest', async () => {
    const socket = await connectAs('guest@example.com');
    expect(socket.connected).toBe(true);
  });

  it('rejects an API key without a login token', async () => {
    await expect(
      connect({ auth: { apiKey: 'ASJDHGAKJSDGASD' }, extraHeaders: { apiKey: 'ASJDHGAKJSDGASD' } })
    ).rejects.toThrow('unauthorized');
  });

  it('disconnects when the token expires', async () => {
    const shortLived = signer.sign({ email: 'guest@example.com', exp: Math.floor(Date.now() / 1000) + 2 });
    const socket = await connect({ auth: { token: shortLived } });
    const reason = await new Promise((resolve) => socket.once('disconnect', resolve));
    expect(reason).toBe('io server disconnect');
  }, 10_000);

  it('sends events only to connections subscribed to their project', async () => {
    const [inA, inB] = await Promise.all([connectAs('guest@example.com'), connectAs('editor@example.com')]);
    await subscribe(inA, 'project-a');
    await subscribe(inB, 'project-b');
    const receivedByB = record(inB);

    const created = nextEvent(inA, 'build_created');
    const updated = nextEvent(inA, 'testRun_updated');
    gateway.buildCreated({ id: 'build-a', projectId: 'project-a' } as BuildDto);
    gateway.testRunUpdated(testRun('run-a', 'build-a', 'project-a'));

    expect(await created).toMatchObject({ id: 'build-a' });
    expect(await updated).toEqual([expect.objectContaining({ id: 'run-a' })]);
    await settle();
    expect(receivedByB).toEqual({});
  });

  it('sends nothing about builds to a connection without a subscription', async () => {
    const [subscribed, idle] = await Promise.all([connectAs('guest@example.com'), connectAs('editor@example.com')]);
    await subscribe(subscribed, 'project-a');
    const receivedByIdle = record(idle);

    const deleted = nextEvent(subscribed, 'build_deleted');
    gateway.buildDeleted({ id: 'build-a', projectId: 'project-a' } as BuildDto);

    await deleted;
    await settle();
    expect(receivedByIdle).toEqual({});
  });

  it('routes a test run without its own project to the project of its build', async () => {
    const socket = await connectAs('guest@example.com');
    await subscribe(socket, 'project-b');

    const created = nextEvent(socket, 'testRun_created');
    gateway.testRunCreated(testRun('legacy-run', 'build-b', null));

    expect(await created).toEqual([expect.objectContaining({ id: 'legacy-run' })]);
  });

  it('moving the subscription stops events of the previous project', async () => {
    const socket = await connectAs('guest@example.com');
    await subscribe(socket, 'project-a');
    await subscribe(socket, 'project-b');
    const received = record(socket);

    const fromB = nextEvent(socket, 'build_created');
    gateway.buildCreated({ id: 'build-a', projectId: 'project-a' } as BuildDto);
    gateway.buildCreated({ id: 'build-b', projectId: 'project-b' } as BuildDto);

    expect(await fromB).toMatchObject({ id: 'build-b' });
    await settle();
    expect(received.build_created).toEqual([expect.objectContaining({ id: 'build-b' })]);
  });

  it('subscribes only to a project the person has access to and leaves it when access goes', async () => {
    granted = new Set(everyPair().filter((pair) => pair !== 'user-guest:project-b'));
    try {
      const guest = await connectAs('guest@example.com');
      expect(await subscribe(guest, 'project-b')).toEqual({ ok: false });
      expect(await subscribe(guest, 'project-a')).toEqual({ ok: true });
      const received = record(guest);

      // access to A is taken away while the page is open: its events stop now
      gateway.leaveProject('user-guest', 'project-a');
      await settle();
      gateway.buildCreated({ id: 'build-a', projectId: 'project-a' } as BuildDto);
      await settle();
      expect(received).toEqual({});
    } finally {
      granted = new Set(everyPair());
    }
  });

  it('refuses a subscription to a project that does not exist', async () => {
    const socket = await connectAs('guest@example.com');

    expect(await subscribe(socket, 'no-such-project')).toEqual({ ok: false });
    expect(await subscribe(socket, 'project-a')).toEqual({ ok: true });
  });
});
