import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Role, TestRun } from '@prisma/client';
import { BuildDto } from '../../builds/dto/build.dto';
import { getBuildsStats } from '../../builds/build-stats';
import { debounce } from 'lodash';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { msUntilExpiry, tokenFromHandshake } from './events-auth';
import { groupByProject, projectRoom } from './events-rooms';
import { serverFileLinkKey, signFile, withFileSignatures } from '../../static/file-links';
import { allowOwnInterface } from '../../security';

// The message a rejected client gets in connect_error; the UI signs out on it.
export const UNAUTHORIZED = 'unauthorized';

// Only signed-in users get events, and only of the project they subscribed to
// (spec 032, ADR-0023), never to anyone listening.
// the same origin as the REST API: only Vision's own interface (045)
@WebSocketGateway({ cors: { origin: allowOwnInterface } })
export class EventsGateway implements OnGatewayInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsGateway.name);
  private readonly fileKey = serverFileLinkKey();

  @WebSocketServer()
  server: Server;

  constructor(
    private prismaService: PrismaService,
    private authService: AuthService
  ) {}

  private debounceTimeout = 1500;
  private maxWait = 3000;
  private testRunsCreatedQueued: Array<TestRun> = [];
  private testRunsDeletedQueued: Array<TestRun> = [];
  private testRunsUpdatedQueued: Array<TestRun> = [];
  private buildsUpdatedQueued: Array<string> = [];

  afterInit(server: Server): void {
    server.use((socket, next) => {
      this.authenticate(socket).then(
        () => next(),
        () => next(new Error(UNAUTHORIZED))
      );
    });
  }

  // A burst still waiting for its debounce would fire into a closed server.
  onModuleDestroy(): void {
    this.testRunCreatedDebounced.cancel();
    this.testRunUpdatedDebounced.cancel();
    this.testRunDeletedDebounced.cancel();
    this.buildUpdatedDebounced.cancel();
  }

  private async authenticate(socket: Socket): Promise<void> {
    const token = tokenFromHandshake(socket.handshake.auth);
    if (!token) throw new Error(UNAUTHORIZED);
    const payload = await this.authService.verifyToken(token);
    const user = await this.prismaService.user.findUnique({
      where: { email: payload.email },
      select: { id: true },
    });
    if (!user) throw new Error(UNAUTHORIZED);
    socket.data.userId = user.id;

    const expiresIn = msUntilExpiry(payload.exp, Date.now());
    if (expiresIn !== undefined) {
      const timer = setTimeout(() => socket.disconnect(true), expiresIn);
      socket.on('disconnect', () => clearTimeout(timer));
    }
  }

  @SubscribeMessage('subscribe')
  async subscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { projectId?: string | null } | undefined
  ): Promise<{ ok: boolean }> {
    const projectId = body?.projectId || null;
    // Remembered before the lookups so that a later subscribe wins even if its
    // lookups finish first.
    socket.data.projectId = projectId;
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }
    if (!projectId) return { ok: true };

    // only a project the person may reach (042): an admin any, anyone else one they were given
    const allowed = await Promise.all([
      this.prismaService.project.findUnique({ where: { id: projectId }, select: { id: true } }),
      this.prismaService.user.findUnique({ where: { id: socket.data.userId }, select: { id: true, role: true } }),
      this.prismaService.projectAccess.findUnique({
        where: { userId_projectId: { userId: socket.data.userId, projectId } },
        select: { projectId: true },
      }),
    ]).then(
      ([project, user, access]) => !!project && !!user && (user.role === Role.admin || !!access),
      () => false
    );
    if (!allowed) return { ok: false };
    if (socket.data.projectId === projectId) socket.join(projectRoom(projectId));
    return { ok: true };
  }

  /** Access was taken away: that person's sockets stop getting the project's events now. */
  leaveProject(userId: string, projectId: string): void {
    this.server
      .in(projectRoom(projectId))
      .fetchSockets()
      .then((sockets) =>
        sockets
          .filter((socket) => socket.data.userId === userId)
          .forEach((socket) => socket.leave(projectRoom(projectId)))
      )
      .catch((error) => this.logger.warn(`Could not stop events of ${projectId} for ${userId}: ${error}`));
  }

  buildCreated(build: BuildDto): void {
    this.server.to(projectRoom(build.projectId)).emit(
      'build_created',
      withFileSignatures(build, (name) => signFile(name, this.fileKey))
    );
  }

  buildUpdated(id: string): void {
    this.buildsUpdatedQueued.push(id);
    this.buildUpdatedDebounced();
  }

  testRunCreated(testRun: TestRun): void {
    this.testRunsCreatedQueued.push(testRun);
    this.testRunCreatedDebounced();
    this.buildUpdated(testRun.buildId);
  }

  testRunUpdated(testRun: TestRun): void {
    this.testRunsUpdatedQueued.push(testRun);
    this.testRunUpdatedDebounced();
    this.buildUpdated(testRun.buildId);
  }

  testRunDeleted(testRun: TestRun): void {
    this.testRunsCreatedQueued = this.testRunsCreatedQueued.filter((tr) => tr.id !== testRun.id);
    this.testRunsUpdatedQueued = this.testRunsUpdatedQueued.filter((tr) => tr.id !== testRun.id);
    this.testRunsDeletedQueued.push(testRun);
    this.testRunDeletedDebounced();
    this.buildUpdated(testRun.buildId);
  }

  buildDeleted(buildDto: BuildDto) {
    this.server.to(projectRoom(buildDto.projectId)).emit('build_deleted', buildDto);
  }

  private emitToProjects<T>(event: string, items: T[], projectOf: (item: T) => string | null | undefined): void {
    for (const [projectId, group] of groupByProject(items, projectOf)) {
      // members of the room see these rows in the interface, with their images (043)
      this.server.to(projectRoom(projectId)).emit(
        event,
        withFileSignatures(group, (name) => signFile(name, this.fileKey))
      );
    }
  }

  // Older test runs have no projectId of their own; they go to their build's project.
  private emitTestRuns(event: string, testRuns: Array<TestRun>): void {
    const buildIds = [...new Set(testRuns.filter((tr) => !tr.projectId).map((tr) => tr.buildId))];
    if (buildIds.length === 0) {
      this.emitToProjects(event, testRuns, (tr) => tr.projectId);
      return;
    }
    this.prismaService.build
      .findMany({ where: { id: { in: buildIds } }, select: { id: true, projectId: true } })
      .then((builds) => {
        const projectOfBuild = new Map(builds.map((b) => [b.id, b.projectId]));
        this.emitToProjects(event, testRuns, (tr) => tr.projectId ?? projectOfBuild.get(tr.buildId));
      })
      .catch((error) => this.logger.error(`${event} not sent: ${error}`));
  }

  private testRunUpdatedDebounced = debounce(
    () => {
      this.emitTestRuns('testRun_updated', this.testRunsUpdatedQueued);
      this.testRunsUpdatedQueued = [];
    },
    this.debounceTimeout,
    {
      leading: true,
      maxWait: this.maxWait,
    }
  );

  private testRunCreatedDebounced = debounce(
    () => {
      this.emitTestRuns('testRun_created', this.testRunsCreatedQueued);
      this.testRunsCreatedQueued = [];
    },
    this.debounceTimeout,
    {
      leading: true,
      maxWait: this.maxWait,
    }
  );

  private testRunDeletedDebounced = debounce(
    () => {
      this.emitTestRuns('testRun_deleted', this.testRunsDeletedQueued);
      this.testRunsDeletedQueued = [];
    },
    this.debounceTimeout,
    {
      leading: true,
      maxWait: this.maxWait,
    }
  );

  private buildUpdatedDebounced = debounce(
    () => {
      // Deduplicate: during ingestion the queue holds one entry per test run.
      // Stats are aggregated in the database — a build can hold thousands of
      // test runs and this fires on every debounced event burst.
      const buildIds = [...new Set(this.buildsUpdatedQueued)];
      this.buildsUpdatedQueued = [];
      Promise.all([
        this.prismaService.build.findMany({ where: { id: { in: buildIds } } }),
        getBuildsStats(this.prismaService, buildIds),
      ])
        .then(([builds, stats]) => {
          this.emitToProjects(
            'build_updated',
            builds.map((build) => new BuildDto(build, stats.get(build.id))),
            (build) => build.projectId
          );
        })
        .catch((error) => this.logger.error(`build_updated not sent: ${error}`));
    },
    this.debounceTimeout,
    {
      leading: true,
      maxWait: this.maxWait,
    }
  );
}
