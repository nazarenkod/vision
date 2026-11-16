import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Project, Role, TestStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { createServer, IncomingMessage, Server } from 'http';
import { AddressInfo } from 'net';
import { PNG } from 'pngjs';
import { deflateSync, gzipSync } from 'zlib';
import { TEST_PROJECT } from '../src/_data_';
import { AppModule } from '../src/app.module';
import { BuildsService } from '../src/builds/builds.service';
import { ProjectAccessService } from '../src/projects/project-access.service';
import { ProjectsService } from '../src/projects/projects.service';
import { buildPng, ihdr, PNG_SIGNATURE, pngChunk } from '../src/shared/png-test-files';
import { globalPipes } from '../src/shared/strip-unknown-fields.pipe';
import { UsersService } from '../src/users/users.service';
import { haveUserLogged, requestWithApiKey, requestWithAuth } from './preconditions';

/*
 * The fixes of the 2026-11-07 audit through the API as clients call it, on a real database:
 * each attack is refused, and the normal use around it works as before.
 */

type Logged = Awaited<ReturnType<typeof haveUserLogged>>;

const image = readFileSync('./test/image.png');
const edited = readFileSync('./test/image_edited.png');
const plainPng = (width: number, height: number) => Buffer.from(PNG.sync.write(new PNG({ width, height, fill: true })));

// a small first header and a huge second one, as pngjs decodes the second (VIS-SEC-045)
const twoHeaders = Buffer.concat([
  PNG_SIGNATURE,
  ihdr(10, 10),
  ihdr(9000, 9000),
  pngChunk('IDAT', deflateSync(Buffer.alloc(9001 * 10))),
  pngChunk('IEND'),
]);

const androidTree = (body: string) =>
  `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0" width="1080" height="2400">` +
  `<android.widget.FrameLayout class="android.widget.FrameLayout" resource-id="com.bank.app:id/root" text="" ` +
  `content-desc="" displayed="true" bounds="[0,0][1080,2400]">${body}</android.widget.FrameLayout></hierarchy>`;
const textView = (text: string, top = 0) =>
  `<android.widget.TextView class="android.widget.TextView" resource-id="" text="${text}" content-desc="" ` +
  `displayed="true" bounds="[0,${top}][500,${top + 100}]"/>`;
const asField = (xml: string) => gzipSync(Buffer.from(xml)).toString('base64');

function server(
  handle: (request: IncomingMessage) => { status: number; body?: unknown; headers?: Record<string, string> }
) {
  const seen: Array<{ url: string; authorization?: string }> = [];
  const http: Server = createServer((request, response) => {
    seen.push({ url: request.url ?? '', authorization: request.headers.authorization });
    const { status, body, headers } = handle(request);
    response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    response.end(body === undefined ? '' : JSON.stringify(body));
  });
  return new Promise<{ url: string; port: number; seen: typeof seen; close: () => Promise<void> }>((resolve) =>
    http.listen(0, '127.0.0.1', () => {
      const port = (http.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        port,
        seen,
        close: () => new Promise((done) => http.close(() => done())),
      });
    })
  );
}

describe('Fixes of the 2026-11-07 audit (e2e)', () => {
  let app: INestApplication;
  let usersService: UsersService;
  let projectsService: ProjectsService;
  let buildsService: BuildsService;
  let access: ProjectAccessService;
  const cleanup: Array<() => Promise<unknown>> = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(...globalPipes());
    usersService = moduleFixture.get(UsersService);
    projectsService = moduleFixture.get(ProjectsService);
    buildsService = moduleFixture.get(BuildsService);
    access = moduleFixture.get(ProjectAccessService);
    await app.init();
  });

  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()!().catch(() => undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  const user = async (role: Role) => {
    const logged = await haveUserLogged(usersService, role);
    cleanup.push(() => usersService.delete(logged.id));
    return logged;
  };
  const project = async (fields: Partial<Project> = {}, members: Logged[] = []) => {
    const created = await projectsService.create({
      ...TEST_PROJECT,
      name: `Audit e2e ${randomUUID()}`,
      ...fields,
    } as never);
    cleanup.push(() => projectsService.remove(created.id));
    for (const member of members) await access.grant(created.id, member.id);
    return created;
  };
  const build = (key: string, projectId: string, branchName = 'master') =>
    requestWithApiKey(app, 'post', '/builds', key).send({ project: projectId, branchName }).expect(201);
  const upload = (
    key: string,
    projectId: string,
    buildId: string,
    file: Buffer,
    fields: Record<string, string> = {}
  ) => {
    const request = requestWithApiKey(app, 'post', '/test-runs/multipart', key)
      .attach('image', file, 'screen.png')
      .field('name', fields.name ?? 'Screen')
      .field('buildId', buildId)
      .field('projectId', projectId)
      .field('branchName', fields.branchName ?? 'master');
    for (const [name, value] of Object.entries(fields))
      if (!['name', 'branchName'].includes(name)) request.field(name, value);
    return request;
  };
  const approve = (token: string, id: string) =>
    requestWithAuth(app, 'post', '/test-runs/approve?merge=false', token).send([id]).expect(201);

  describe('VIS-SEC-001, 012: a build PATCH writes run state and CI id only', () => {
    it('keeps the role, the project and the other fields of a build as they were', async () => {
      const alice = await user('editor');
      const bob = await user('editor');
      const teamA = await project({}, [alice]);
      await project({}, [bob]);
      const created = (await build(alice.apiKey, teamA.id)).body;

      const patched = await requestWithApiKey(app, 'patch', `/builds/${created.id}`, alice.apiKey)
        .send({
          isRunning: false,
          ciBuildId: 'ci-42',
          branchName: 'injected',
          number: 999,
          user: { update: { role: 'admin' } },
        })
        .expect(200);

      expect(patched.body).toMatchObject({
        isRunning: false,
        ciBuildId: 'ci-42',
        branchName: 'master',
        number: created.number,
      });
      const me = await requestWithAuth(app, 'get', '/users/me', alice.token).expect(200);
      expect(me.body.role).toBe('editor');
      await requestWithAuth(app, 'get', `/builds/${created.id}`, bob.token).expect(404);
    });
  });

  describe('VIS-SEC-014, 045: screenshots are checked before decoding', () => {
    it('takes real screenshots and every kind of valid PNG, and compares them as before', async () => {
      const editor = await user('editor');
      const team = await project({}, [editor]);
      for (const [name, file] of [
        ['photo', image],
        ['interlaced', buildPng({ width: 120, height: 80, interlace: true })],
        ['16-bit', buildPng({ width: 120, height: 80, depth: 16 })],
        ['palette', buildPng({ width: 120, height: 80, colorType: 3 })],
        ['ancillary chunks', buildPng({ width: 120, height: 80, extraChunks: true, idatChunks: 5 })],
      ] as const) {
        const first = await upload(editor.apiKey, team.id, (await build(editor.apiKey, team.id)).body.id, file, {
          name,
        });
        expect({ name, status: first.status, run: first.body.status }).toEqual({
          name,
          status: 201,
          run: TestStatus.new,
        });
        await approve(editor.token, first.body.id);
        const again = await upload(editor.apiKey, team.id, (await build(editor.apiKey, team.id)).body.id, file, {
          name,
        });
        expect({ name, run: again.body.status, diff: again.body.diffPercent }).toEqual({
          name,
          run: TestStatus.ok,
          diff: 0,
        });
      }
      // a real change is still found
      const changed = await upload(editor.apiKey, team.id, (await build(editor.apiKey, team.id)).body.id, edited, {
        name: 'photo',
      });
      expect(changed.body.status).toBe(TestStatus.unresolved);
      expect(changed.body.diffPercent).toBeGreaterThan(1);
    });

    it('turns away what is not a PNG, a decompression bomb and a hidden second header', async () => {
      const editor = await user('editor');
      const team = await project({}, [editor]);
      const buildId = (await build(editor.apiKey, team.id)).body.id;
      const bomb = plainPng(1, 1);
      bomb.writeUInt32BE(30000, 16);
      bomb.writeUInt32BE(30000, 20);

      await upload(editor.apiKey, team.id, buildId, Buffer.from('GIF89a not a png at all')).expect(400);
      expect((await upload(editor.apiKey, team.id, buildId, bomb).expect(413)).body.message).toContain('30000 × 30000');
      expect((await upload(editor.apiKey, team.id, buildId, twoHeaders).expect(413)).body.message).toContain(
        '9000 × 9000'
      );
      // the same through the JSON intake the SDK uses
      await requestWithApiKey(app, 'post', '/test-runs', editor.apiKey)
        .send({
          name: 'json',
          buildId,
          projectId: team.id,
          branchName: 'master',
          imageBase64: twoHeaders.toString('base64'),
        })
        .expect(413);
    });
  });

  describe('VIS-SEC-043: the structure of a long list answers in time', () => {
    it('offers 10 000 rows with no name in well under the 6.8 s it took', async () => {
      const editor = await user('editor');
      const team = await project({}, [editor]);
      const rows = Array.from(
        { length: 10_000 },
        (_, i) =>
          `<android.view.View class="android.view.View" resource-id="" text="" content-desc="" displayed="true" ` +
          `bounds="[${(i % 100) * 10},${Math.floor(i / 100) * 20}][${(i % 100) * 10 + 9},${Math.floor(i / 100) * 20 + 19}]"/>`
      ).join('');
      const run = await upload(
        editor.apiKey,
        team.id,
        (await build(editor.apiKey, team.id)).body.id,
        plainPng(1080, 2400),
        {
          uiTree: asField(androidTree(rows)),
          uiTreeFormat: 'appium-android',
        }
      ).expect(201);

      const started = Date.now();
      const structure = await requestWithAuth(app, 'get', `/test-runs/${run.body.id}/structure`, editor.token).expect(
        200
      );
      expect(Date.now() - started).toBeLessThan(2000);
      expect(structure.body.hasUiTree).toBe(true);
      expect(structure.body.elements.filter((element: { nameless?: boolean }) => element.nameless)).toHaveLength(
        10_000
      );
    });
  });

  describe('VIS-SEC-005: at most 20 ignore areas on a screen', () => {
    const areas = (count: number) => Array.from({ length: count }, (_, i) => ({ x: i, y: i, width: 5, height: 5 }));

    it('takes up to 20 everywhere and refuses 21, writing nothing', async () => {
      const editor = await user('editor');
      const team = await project({}, [editor]);
      const buildId = (await build(editor.apiKey, team.id)).body.id;
      const json = (count: number) =>
        requestWithApiKey(app, 'post', '/test-runs', editor.apiKey).send({
          name: `areas ${count}`,
          buildId,
          projectId: team.id,
          branchName: 'master',
          imageBase64: plainPng(40, 40).toString('base64'),
          ignoreAreas: areas(count),
        });

      const kept = await json(20).expect(201);
      // the areas a test sends are kept apart from the ones drawn in review, as they always were
      expect(JSON.parse(kept.body.tempIgnoreAreas)).toHaveLength(20);
      expect((await json(21).expect(400)).body.message).toBe('ignoreAreas must contain no more than 20 elements');
      await upload(editor.apiKey, team.id, buildId, image, {
        name: 'multipart',
        ignoreAreas: JSON.stringify(areas(21)),
      }).expect(400);
      const multipart = await upload(editor.apiKey, team.id, buildId, image, {
        name: 'multipart',
        ignoreAreas: JSON.stringify(areas(3)),
      }).expect(201);

      await requestWithAuth(app, 'post', '/test-runs/ignoreAreas/update', editor.token)
        .send({ ids: [multipart.body.id], ignoreAreas: areas(21) })
        .expect(400);
      await requestWithAuth(app, 'post', '/test-runs/ignoreAreas/update', editor.token)
        .send({ ids: [multipart.body.id], ignoreAreas: areas(19) })
        .expect(201);
      // two more on a screen with 19 and one with 20: neither gets them
      const refused = await requestWithAuth(app, 'post', '/test-runs/ignoreAreas/add', editor.token)
        .send({ ids: [multipart.body.id, kept.body.id], ignoreAreas: areas(2) })
        .expect(400);
      expect(refused.body.message).toContain('at most 20 ignore areas');
      const after = await requestWithAuth(app, 'get', `/test-runs/${multipart.body.id}`, editor.token).expect(200);
      expect(JSON.parse(after.body.ignoreAreas)).toHaveLength(19);
      await requestWithAuth(app, 'post', '/test-runs/ignoreAreas/add', editor.token)
        .send({ ids: [multipart.body.id], ignoreAreas: areas(1) })
        .expect(201);
    });

    it('refuses a huge list at once', async () => {
      const editor = await user('editor');
      const team = await project({}, [editor]);
      const buildId = (await build(editor.apiKey, team.id)).body.id;
      const started = Date.now();
      const answer = await requestWithApiKey(app, 'post', '/test-runs', editor.apiKey).send({
        name: 'many',
        buildId,
        projectId: team.id,
        branchName: 'master',
        imageBase64: plainPng(10, 10).toString('base64'),
        ignoreAreas: areas(20_000),
      });
      expect([400, 413]).toContain(answer.status);
      expect(Date.now() - started).toBeLessThan(1000);
    });
  });

  describe('VIS-SEC-015: patterns in element rules', () => {
    it('finds texts with ordinary patterns, finishes a catastrophic one, refuses back-references', async () => {
      const editor = await user('editor');
      const team = await project({}, [editor]);
      const tree = androidTree(
        textView('Pay', 0) +
          textView('a'.repeat(30) + '!', 200) +
          textView('1\u00a0250,00', 400) +
          textView('+380 (44) 123-45-67', 600)
      );
      const run = await upload(
        editor.apiKey,
        team.id,
        (await build(editor.apiKey, team.id)).body.id,
        plainPng(1080, 2400),
        {
          uiTree: asField(tree),
          uiTreeFormat: 'appium-android',
        }
      ).expect(201);
      const rule = (selector: string) =>
        requestWithAuth(app, 'post', `/test-runs/${run.body.id}/element-rules`, editor.token).send({
          scope: 'screen',
          selector,
          action: 'ignore',
        });

      await rule('text:/^Pay$/').expect(201);
      // a dash after a set in a class, as phone patterns have it (found in review)
      await rule('text:/^\\+?[\\d\\s-()]+$/').expect(201);
      await rule('text:/^\\d{1,3}(?:\\s\\d{3})*,\\d{2}$/u').expect(201);
      const started = Date.now();
      await rule('text:/(a+)+$/').expect(201);
      expect(Date.now() - started).toBeLessThan(2000);
      expect((await rule('text:/(a)\\1/').expect(400)).body.message).toContain(
        'back-reference, look-around or another part'
      );
      await rule('text:/Pay(?= now)/').expect(400);

      const structure = await requestWithAuth(app, 'get', `/test-runs/${run.body.id}/structure`, editor.token).expect(
        200
      );
      const matches = Object.fromEntries(
        structure.body.rules.map((saved: { selector: string; matches: number }) => [saved.selector, saved.matches])
      );
      expect(matches['text:/^Pay$/']).toBe(1);
      expect(matches['text:/^\\+?[\\d\\s-()]+$/']).toBe(1);
      // the amount with a no-break space as an app prints it
      expect(matches['text:/^\\d{1,3}(?:\\s\\d{3})*,\\d{2}$/u']).toBe(1);
      // it does not hold on a text ending in "!", as RegExp says too, but it no longer takes seconds
      expect(matches['text:/(a+)+$/']).toBe(0);
      expect(new RegExp('(a+)+$').test('a'.repeat(12) + '!')).toBe(false);
    });
  });

  describe('Comparison settings', () => {
    it('finds a change in a project saved with an empty comparison config', async () => {
      const editor = await user('editor');
      const team = await project({ imageComparisonConfig: '{}' }, [editor]);
      const first = await upload(editor.apiKey, team.id, (await build(editor.apiKey, team.id)).body.id, image).expect(
        201
      );
      await approve(editor.token, first.body.id);
      const changed = await upload(
        editor.apiKey,
        team.id,
        (await build(editor.apiKey, team.id)).body.id,
        edited
      ).expect(201);
      expect(changed.body.status).toBe(TestStatus.unresolved);
      expect(changed.body.diffPercent).toBeGreaterThan(1);
    });
  });

  describe('VIS-SEC-008, 048: the Jira token', () => {
    const hosts = process.env.VISION_JIRA_HOSTS;
    afterEach(() => {
      if (hosts === undefined) delete process.env.VISION_JIRA_HOSTS;
      else process.env.VISION_JIRA_HOSTS = hosts;
    });

    it('reads the types from an allowed Jira, and never follows a redirect with the token', async () => {
      const jira = await server((request) =>
        request.url === '/rest/api/2/issuetype'
          ? {
              status: 200,
              body: [
                { id: '1', name: 'Bug' },
                { id: '2', name: 'Sub-task', subtask: true },
              ],
            }
          : request.url === '/rest/api/2/issueLinkType'
            ? { status: 200, body: { issueLinkTypes: [{ name: 'Relates' }] } }
            : { status: 404 }
      );
      const redirecting = await server((request) => ({
        status: 302,
        headers: { Location: `/elsewhere${request.url}` },
      }));
      cleanup.push(jira.close, redirecting.close);
      process.env.VISION_JIRA_HOSTS = `${jira.url},${redirecting.url}`;
      const editor = await user('editor');
      const team = await project({}, [editor]);
      await requestWithAuth(app, 'put', '/users/jira', editor.token).send({ jiraToken: 'personal-token' }).expect(200);

      const types = await requestWithAuth(
        app,
        'get',
        `/projects/${team.id}/jira/types?url=${jira.url}`,
        editor.token
      ).expect(200);
      expect(types.body).toEqual({
        issueTypes: [
          { name: 'Bug', subtask: false },
          { name: 'Sub-task', subtask: true },
        ],
        linkTypes: ['Relates'],
      });
      expect(jira.seen[0].authorization).toBe('Bearer personal-token');

      const redirected = await requestWithAuth(
        app,
        'get',
        `/projects/${team.id}/jira/types?url=${redirecting.url}`,
        editor.token
      ).expect(200);
      expect(redirected.body).toEqual({
        problem: 'redirected',
        location: expect.stringContaining(`${redirecting.url}/elsewhere/rest/api/2/`),
      });
      expect(redirecting.seen.every((call) => !call.url.startsWith('/elsewhere'))).toBe(true);
    });

    it('refuses http, another port and an unknown project', async () => {
      const jira = await server(() => ({ status: 200, body: [] }));
      cleanup.push(jira.close);
      process.env.VISION_JIRA_HOSTS = '127.0.0.1';
      const admin = await user('admin');
      const team = await project();
      await requestWithAuth(app, 'put', '/users/jira', admin.token).send({ jiraToken: 'personal-token' }).expect(200);

      const plain = await requestWithAuth(
        app,
        'get',
        `/projects/${team.id}/jira/types?url=${jira.url}`,
        admin.token
      ).expect(200);
      expect(plain.body).toEqual({ problem: 'hostNotAllowed' });
      await requestWithAuth(app, 'get', `/projects/${randomUUID()}/jira/types?url=${jira.url}`, admin.token).expect(
        404
      );
      expect(jira.seen).toEqual([]);
    });
  });
});
