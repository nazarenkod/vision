/**
 * The whole working path of Vision, recorded against a real server: sign-in, a project
 * with Jira, two SDK builds with UI trees, review (approve, reject, undo, ignore areas,
 * element rules), accessibility, bugs in Jira, the report, Insights, the CLI and its MCP
 * server, images, and who may do what. Every answer is normalised and compared with the
 * reference in __snapshots__: a difference is either a regression or a behaviour change
 * that comes with its specification and a re-recorded reference.
 *
 * Steps share state and run in order; scripts/control-scenario.sh starts everything.
 */
import { join } from 'path';
import { gzipSync } from 'zlib';
import { Client } from 'pg';
import { API, Answer, FakeJira, Normalizer, call, fixture, run, screenFor, writeWork } from './harness';

const norm = new Normalizer();
const jira = new FakeJira();
const PERSONAL_JIRA_TOKEN = 'personal-jira-token-of-the-editor';

const state: {
  adminToken?: string;
  editorToken?: string;
  editorKey?: string;
  guestToken?: string;
  projectId?: string;
  build1?: string;
  build2?: string;
  runs2?: Array<{
    id: string;
    name: string;
    status: string;
    imageName: string;
    fileSignatures: Record<string, string>;
  }>;
} = {};

const record = (answer: Answer | unknown) => norm.value(answer);
const strip = (answer: Answer) => ({ status: answer.status, body: answer.body });
const byName = <T extends { name: string }>(rows: T[]) => [...rows].sort((a, b) => a.name.localeCompare(b.name));

const PAYMENT_XML = fixture('android-payment.xml');
// the second build: the fee text changed and its box repainted
const PAYMENT_XML_2 = PAYMENT_XML.replace('text="Commission 0 UAH"', 'text="Commission 5 UAH"');
const feeBox = (() => {
  const m = PAYMENT_XML.match(/text="Commission 0 UAH"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (!m) throw new Error('android-payment.xml has no fee element');
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
})();
const OFFERS_XML = fixture('android-offers.xml');
const IOS_XML = fixture('ios-payment.xml');

function plan(name: string, rows: Array<[string, Buffer, string, string, string]>): string {
  const lines = rows.map(([check, png, xml, device, os]) => {
    const pngPath = writeWork(`${name}-${check}.png`, png);
    const xmlPath = xml ? writeWork(`${name}-${check}.xml`, xml) : '';
    return [check, pngPath, xmlPath, device, os].join('|');
  });
  return writeWork(`${name}.plan`, lines.join('\n'));
}

async function sdk(planPath: string, branch: string): Promise<unknown> {
  const result = await run(
    'java',
    [
      '-cp',
      process.env.CONTROL_SDK_CLASSPATH ?? '',
      join(__dirname, 'sdk', 'ControlSdk.java'),
      API,
      state.editorKey!,
      'Control app',
      branch,
      planPath,
    ],
    {}
  );
  const line = result.stdout.split('\n').find((l) => l.startsWith('CONTROL_RESULT='));
  if (!line) throw new Error(`SDK run failed (${result.code}):\n${result.stdout}\n${result.stderr}`);
  return JSON.parse(line.slice('CONTROL_RESULT='.length));
}

const cliEnv = () => ({
  VISION_API: API,
  VISION_API_KEY: state.editorKey!,
  VISION_PROJECT: 'Control app',
  VISION_CONFIG_DIR: join(process.env.CONTROL_WORK ?? '', 'cli-config'),
});

beforeAll(async () => {
  await jira.start();
  norm.constant(API, '<api>');
  norm.constant(jira.url, '<jira>');
  norm.constant(PERSONAL_JIRA_TOKEN, '<personal-jira-token>');
  norm.constant(process.env.CONTROL_WORK ?? '', '<work>');
});

afterAll(async () => {
  await jira.stop();
});

it('01 sign-in and accounts', async () => {
  const login = await call(
    'POST',
    '/users/login',
    {},
    {
      email: process.env.CONTROL_ADMIN_EMAIL,
      password: process.env.CONTROL_ADMIN_PASSWORD,
    }
  );
  state.adminToken = login.body.token;
  const admin = { token: state.adminToken };
  const accounts = {
    enabled: strip(await call('GET', '/users/accounts/enabled')),
    oidc: strip(await call('GET', '/users/oidc/enabled')),
    editor: strip(
      await call('POST', '/users', admin, {
        email: 'editor@control.test',
        password: 'editor-password',
        role: 'editor',
        firstName: 'Eda',
        lastName: 'Editor',
      })
    ),
    guest: strip(
      await call('POST', '/users', admin, {
        email: 'guest@control.test',
        password: 'guest-password',
        role: 'guest',
        firstName: 'Gus',
        lastName: 'Guest',
      })
    ),
    duplicate: strip(
      await call('POST', '/users', admin, {
        email: 'EDITOR@control.test',
        password: 'x-password-long',
        role: 'guest',
      })
    ),
  };
  const editorLogin = await call(
    'POST',
    '/users/login',
    {},
    { email: 'editor@control.test', password: 'editor-password' }
  );
  state.editorToken = editorLogin.body.token;
  // the key is shown only when it is made (044): login answers carry its ending only
  state.editorKey = (await call<string>('GET', '/users/newApiKey', { token: state.editorToken })).body;
  state.guestToken = (
    await call('POST', '/users/login', {}, { email: 'guest@control.test', password: 'guest-password' })
  ).body.token;
  const editor = { token: state.editorToken };
  expect(
    record({
      adminLogin: strip(login),
      ...accounts,
      editorLogin: strip(editorLogin),
      wrongPassword: strip(await call('POST', '/users/login', {}, { email: 'editor@control.test', password: 'nope' })),
      me: strip(await call('GET', '/users/me', editor)),
      all: strip(await call('GET', '/users/all', admin)),
      profile: strip(
        await call('PUT', '/users', editor, { email: 'editor@control.test', firstName: 'Eda', lastName: 'Editor' })
      ),
      jira: strip(await call('PUT', '/users/jira', editor, { jiraToken: PERSONAL_JIRA_TOKEN })),
    })
  ).toMatchSnapshot();
});

it('02 project with Jira', async () => {
  const editor = { token: state.editorToken };
  const created = await call('POST', '/projects', editor, {
    name: 'Control app',
    mainBranchName: 'master',
    autoApproveFeature: false,
    imageComparison: 'pixelmatch',
    maxBuildAllowed: 100,
    maxBranchLifetime: 30,
    imageComparisonConfig: '{"threshold":0.1,"ignoreAntialiasing":true,"allowDiffDimensions":false}',
    jiraUrl: jira.url,
    jiraIssueType: '10001',
    jiraLinkType: 'Relates',
    uiTreeSettings: null,
  });
  state.projectId = created.body.id;
  expect(
    record({
      created: strip(created),
      list: strip(await call('GET', '/projects', editor)),
      devices: strip(await call('GET', `/projects/${state.projectId}/devices`, editor)),
    })
  ).toMatchSnapshot();
});

it('03 first SDK build: new screens', async () => {
  const sdkResult = await sdk(
    plan('build1', [
      ['Payment', screenFor(PAYMENT_XML, 1080, 2400), PAYMENT_XML, 'Pixel 7', 'Android 14'],
      ['Offers', screenFor(OFFERS_XML, 1080, 2400), OFFERS_XML, 'Pixel 7', 'Android 14'],
      ['Splash', screenFor('', 360, 640), '', 'Pixel 7', 'Android 14'],
    ]),
    'master'
  );
  const editor = { token: state.editorToken };
  const builds = await call('GET', `/builds?projectId=${state.projectId}&take=10&skip=0`, editor);
  state.build1 = builds.body.data[0].id;
  const runs = await call('GET', `/test-runs?buildId=${state.build1}`, editor);
  expect(
    record({ sdk: sdkResult, builds: strip(builds), runs: { status: runs.status, body: byName(runs.body) } })
  ).toMatchSnapshot();
});

it('04 approve the first build', async () => {
  const editor = { token: state.editorToken };
  const runs = (await call('GET', `/test-runs?buildId=${state.build1}`, editor)).body as Array<{ id: string }>;
  const approved = await call(
    'POST',
    '/test-runs/approve?merge=false',
    editor,
    runs.map((r) => r.id)
  );
  expect(
    record({
      approved: strip(approved),
      build: strip(await call('GET', `/builds/${state.build1}`, editor)),
      variations: { ...strip(await call('GET', `/test-variations?projectId=${state.projectId}`, editor)) },
    })
  ).toMatchSnapshot();
});

it('05 second SDK build: a changed fee, the same offers', async () => {
  const sdkResult = await sdk(
    plan('build2', [
      [
        'Payment',
        screenFor(PAYMENT_XML_2, 1080, 2400, 1, (box) => box.x === feeBox.x && box.y === feeBox.y),
        PAYMENT_XML_2,
        'Pixel 7',
        'Android 14',
      ],
      ['Offers', screenFor(OFFERS_XML, 1080, 2400), OFFERS_XML, 'Pixel 7', 'Android 14'],
      ['Splash', screenFor('', 360, 640), '', 'Pixel 7', 'Android 14'],
    ]),
    'master'
  );
  const editor = { token: state.editorToken };
  const builds = await call('GET', `/builds?projectId=${state.projectId}&take=10&skip=0`, editor);
  state.build2 = builds.body.data[0].id;
  const runs = await call('GET', `/test-runs?buildId=${state.build2}`, editor);
  state.runs2 = runs.body;
  expect(record({ sdk: sdkResult, runs: { status: runs.status, body: byName(runs.body) } })).toMatchSnapshot();
});

const runNamed = (name: string) => state.runs2!.find((r) => r.name === name)!;

it('06 review: details, structure, groups, overview', async () => {
  const editor = { token: state.editorToken };
  const payment = runNamed('Payment').id;
  expect(
    record({
      details: strip(await call('GET', `/test-runs/${payment}`, editor)),
      structure: strip(await call('GET', `/test-runs/${payment}/structure`, editor)),
      structureByKey: strip(await call('GET', `/test-runs/${payment}/structure`, { apiKey: state.editorKey })),
      matches: strip(
        await call(
          'GET',
          `/test-runs/${payment}/selector-matches?selector=${encodeURIComponent('id:com.bank.app:id/tv_fee')}`,
          editor
        )
      ),
      groups: strip(await call('GET', `/test-runs/groups?buildId=${state.build2}`, editor)),
      overview: strip(await call('GET', `/builds/${state.build2}/overview`, editor)),
      build: strip(await call('GET', `/builds/${state.build2}`, editor)),
    })
  ).toMatchSnapshot();
});

it('07 element rules and ignore areas', async () => {
  const editor = { token: state.editorToken };
  const payment = runNamed('Payment').id;
  const added = await call('POST', `/test-runs/${payment}/element-rules`, editor, {
    scope: 'screen',
    selector: 'id:com.bank.app:id/tv_fee',
    action: 'variable',
    parts: [{ text: 'Commission ' }, { pattern: '\\d+', sample: '0' }, { text: ' UAH' }],
    note: 'fee depends on the amount',
  });
  const afterRule = await call('GET', `/test-runs/${payment}`, editor);
  const ruleId = (added.body as { rules?: Array<{ id: string }>; id?: string })?.id;
  const ignore = await call('POST', '/test-runs/ignoreAreas/add', editor, {
    ids: [runNamed('Offers').id],
    ignoreAreas: [{ x: 10, y: 10, width: 100, height: 50 }],
  });
  expect(
    record({
      added: strip(added),
      afterRule: strip(afterRule),
      removed: ruleId
        ? strip(await call('POST', `/test-runs/${payment}/element-rules/remove`, editor, { scope: 'screen', ruleId }))
        : 'no rule id',
      ignore: strip(ignore),
      offers: strip(await call('GET', `/test-runs/${runNamed('Offers').id}`, editor)),
    })
  ).toMatchSnapshot();
});

it('08 reject, undo, approve', async () => {
  const editor = { token: state.editorToken };
  const payment = runNamed('Payment').id;
  const rejected = await call('POST', '/test-runs/reject', editor, [payment]);
  const afterReject = await call('GET', `/test-runs/${payment}`, editor);
  const undone = await call('POST', `/test-runs/undo/${rejected.body.decisionId}`, editor);
  const afterUndo = await call('GET', `/test-runs/${payment}`, editor);
  expect(
    record({
      rejected: strip(rejected),
      afterReject: (afterReject.body as { status: string }).status,
      undone: strip(undone),
      afterUndo: (afterUndo.body as { status: string }).status,
    })
  ).toMatchSnapshot();
});

it('09 accessibility and its bugs in Jira', async () => {
  const editor = { token: state.editorToken };
  const payment = runNamed('Payment').id;
  const a11y = await call('GET', `/test-runs/${payment}/a11y`, editor);
  const issues = ((a11y.body as { violations?: Array<{ id: string }> }).violations ?? []) as Array<{ id: string }>;
  const steps: Record<string, unknown> = { a11y: strip(a11y) };
  if (issues.length >= 3) {
    steps.ignore = strip(
      await call('POST', `/test-runs/${payment}/a11y/ignore`, editor, {
        violationId: issues[0].id,
        comment: 'by design',
      })
    );
    steps.reset = strip(await call('POST', `/test-runs/${payment}/a11y/reset`, editor, { violationId: issues[0].id }));
    steps.link = strip(
      await call('POST', `/test-runs/${payment}/a11y/link`, editor, { violationId: issues[1].id, jiraKey: 'QA-1' })
    );
    steps.prepare = strip(
      await call('POST', `/test-runs/${payment}/a11y/jira/prepare`, editor, {
        violationId: issues[2].id,
        parentKey: 'QA-1',
      })
    );
    steps.users = strip(await call('GET', `/test-runs/${payment}/a11y/jira/users?query=qa`, editor));
    steps.file = strip(
      await call('POST', `/test-runs/${payment}/a11y/jira`, editor, {
        violationId: issues[2].id,
        parentKey: 'QA-1',
        issueTypeId: '10002',
      })
    );
    steps.after = strip(await call('GET', `/test-runs/${payment}/a11y`, editor));
  } else {
    steps.note = `only ${issues.length} accessibility issues`;
  }
  expect(record(steps)).toMatchSnapshot();
});

it('10 a bug from the comparison', async () => {
  const editor = { token: state.editorToken };
  const payment = runNamed('Payment').id;
  expect(
    record({
      prepare: strip(await call('POST', `/test-runs/${payment}/bug/prepare`, editor, { parentKey: 'QA-1' })),
      file: strip(
        await call('POST', `/test-runs/${payment}/bug`, editor, {
          parentKey: 'QA-1',
          issueTypeId: '10002',
          essence: 'Fee shows 5 UAH instead of 0',
          environment: 'Pixel 7, Android 14',
          steps: '1. Open Payment\n2. Enter 100',
          actual: 'Commission 5 UAH',
          expected: 'Commission 0 UAH',
          marks: [{ ...feeBox, element: 'id:com.bank.app:id/tv_fee' }],
        })
      ),
      bugs: strip(await call('GET', `/test-runs/${payment}/bugs`, editor)),
    })
  ).toMatchSnapshot();
});

it('11 what Vision sent to Jira', async () => {
  // sorted: Vision sends some of these in parallel, and their order on arrival is not behaviour
  const calls = (record(jira.log) as unknown[]).map((call) => JSON.stringify(call));
  expect(calls.sort().map((call) => JSON.parse(call))).toMatchSnapshot();
});

it('12 report links', async () => {
  const editor = { token: state.editorToken };
  const created = await call('POST', `/builds/${state.build2}/report-links`, editor, { language: 'en' });
  const token = (created.body as { token: string }).token;
  const id = (created.body as { id: string }).id;
  const publicReport = await call('GET', `/public/reports/${token}`);
  const [shown, signature] = Object.entries<string>(publicReport.body.changes[0].fileSignatures)[0];
  const reportImage = `/images/${shown}?sig=${encodeURIComponent(signature)}`;
  expect(
    record({
      created: strip(created),
      report: strip(await call('GET', `/builds/${state.build2}/report`, editor)),
      list: strip(await call('GET', `/builds/${state.build2}/report-links`, editor)),
      publicReport: strip(publicReport),
      reportImage: (await call('GET', reportImage)).status,
      revoke: strip(await call('DELETE', `/report-links/${id}`, editor)),
      afterRevoke: strip(await call('GET', `/public/reports/${token}`)),
      // the report's images close with its link (REQ-043-06)
      reportImageAfterRevoke: (await call('GET', reportImage)).status,
    })
  ).toMatchSnapshot();
});

it('13 Insights and test variations', async () => {
  const editor = { token: state.editorToken };
  const variations = await call('GET', `/test-variations?projectId=${state.projectId}`, editor);
  const payment = (variations.body as Array<{ id: string; name: string }>).find((v) => v.name === 'Payment')!;
  expect(
    record({
      insights: strip(await call('GET', `/analytics/${state.projectId}`, editor)),
      variations: { status: variations.status, body: byName(variations.body) },
      details: strip(await call('GET', `/test-variations/details/${payment.id}`, editor)),
    })
  ).toMatchSnapshot();
});

it('14 the CLI sends checks from files, in a session', async () => {
  const png = writeWork('cli-ios.png', screenFor(IOS_XML, 1170, 2532, 3));
  const xml = writeWork('cli-ios.xml', IOS_XML);
  const env = cliEnv();
  const cli = process.env.CONTROL_CLI ?? '';
  const start = await run('python3', ['-I', cli, 'start'], env);
  const check = await run(
    'python3',
    [
      '-I',
      cli,
      'check',
      'iOS payment',
      '--png',
      png,
      '--xml',
      xml,
      '--device',
      'iPhone 15',
      '--os',
      'iOS 17',
      '--json',
    ],
    env
  );
  const finish = await run('python3', ['-I', cli, 'finish'], env);
  expect(
    record({
      start: { code: start.code, out: start.stdout, err: start.stderr },
      check: { code: check.code, out: check.code === 0 ? JSON.parse(check.stdout) : check.stdout, err: check.stderr },
      finish: { code: finish.code, out: finish.stdout, err: finish.stderr },
    })
  ).toMatchSnapshot();
});

it('15 the MCP server lists and runs its tools', async () => {
  const png = writeWork('mcp.png', screenFor(PAYMENT_XML, 1080, 2400));
  const xml = writeWork('mcp.xml', PAYMENT_XML);
  const messages = [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'control', version: '1' } },
    },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'vision_check', arguments: { name: 'MCP payment', png, xml, branch: 'master' } },
    },
  ];
  const out = await run(
    'python3',
    ['-I', process.env.CONTROL_CLI ?? '', 'mcp'],
    cliEnv(),
    messages.map((m) => JSON.stringify(m)).join('\n') + '\n'
  );
  expect(
    record({
      code: out.code,
      replies: out.stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
      err: out.stderr,
    })
  ).toMatchSnapshot();
});

it('16 images', async () => {
  // only with the signature the answers carry (043): unsigned, the same 404 as a missing file
  const payment = runNamed('Payment');
  const sig = `?sig=${encodeURIComponent(payment.fileSignatures[payment.imageName])}`;
  const other = runNamed('Offers');
  const shown = await call('GET', `/images/${payment.imageName}${sig}`);
  const download = await call('GET', `/images/${payment.imageName}/download${sig}`);
  const unsigned = await call('GET', `/images/${payment.imageName}`);
  const unsignedDownload = await call('GET', `/images/${payment.imageName}/download`);
  const anotherFilesSignature = await call(
    'GET',
    `/images/${payment.imageName}?sig=${encodeURIComponent(other.fileSignatures[other.imageName])}`
  );
  const bad = await call('GET', `/images/${encodeURIComponent('../etc/passwd')}/download${sig}`);
  const staticFile = await call('GET', `/${payment.imageName}`);
  expect(
    record({
      shown: { status: shown.status, headers: shown.headers, body: shown.body },
      download: { status: download.status, headers: download.headers, body: download.body },
      unsigned: strip(unsigned),
      unsignedDownload: strip(unsignedDownload),
      anotherFilesSignature: strip(anotherFilesSignature),
      bad: strip(bad),
      staticFile: { status: staticFile.status, headers: staticFile.headers, body: staticFile.body },
    })
  ).toMatchSnapshot();
});

it('17 who may do what', async () => {
  const guest = { token: state.guestToken };
  const payment = runNamed('Payment').id;
  expect(
    record({
      noLogin: strip(await call('GET', '/projects')),
      badKey: strip(await call('GET', `/test-runs/${payment}/structure`, { apiKey: 'WRONGKEY' })),
      guestReads: (await call('GET', '/projects', guest)).status,
      guestApproves: strip(await call('POST', '/test-runs/approve?merge=false', guest, [payment])),
      guestCreatesProject: (await call('POST', '/projects', guest, { name: 'x' })).status,
      guestUsers: (await call('GET', '/users/all', guest)).status,
      editorCreatesAccount: (
        await call(
          'POST',
          '/users',
          { token: state.editorToken },
          { email: 'x@control.test', password: 'x', role: 'admin' }
        )
      ).status,
      editorBackups: (await call('GET', '/backups', { token: state.editorToken })).status,
      guestFilesBug: (await call('POST', `/test-runs/${payment}/bug`, guest, { parentKey: 'QA-1', essence: 'x' }))
        .status,
      health: strip(await call('GET', '/health')),
    })
  ).toMatchSnapshot();
});

it('18 a build is approved as a whole and deleted', async () => {
  const editor = { token: state.editorToken };
  const approved = await call('PATCH', `/builds/${state.build2}/approve?merge=false`, editor);
  const after = await call('GET', `/test-runs?buildId=${state.build2}`, editor);
  const removed = await call('DELETE', `/builds/${state.build1}`, editor);
  const builds = await call('GET', `/builds?projectId=${state.projectId}&take=10&skip=0`, editor);
  expect(
    record({
      approved: strip(approved),
      statuses: byName(after.body as Array<{ name: string; status: string }>).map((r) => [r.name, r.status]),
      removed: strip(removed),
      builds: strip(builds),
    })
  ).toMatchSnapshot();
});

it('19 hostile UI trees', async () => {
  const key = { apiKey: state.editorKey };
  const build = await call('POST', '/builds', key, { project: state.projectId, branchName: 'hostile' });
  const png = screenFor(PAYMENT_XML, 1080, 2400).toString('base64');
  // 256 MB of one character gzip into ~250 KB; and entities that expand into each other
  const bomb = gzipSync(Buffer.alloc(256 * 1024 * 1024, 'a'), { level: 9 }).toString('base64');
  const laughs = Buffer.from(
    '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]>' +
      '<hierarchy><node text="&lol2;"/></hierarchy>'
  ).toString('base64');
  const send = (name: string, uiTree: string) =>
    call('POST', '/test-runs', key, {
      name,
      imageBase64: png,
      uiTree,
      projectId: state.projectId,
      buildId: build.body.id,
      branchName: 'hostile',
      device: 'Pixel 7',
      os: 'Android 14',
    });

  // while the bomb is taken, the server keeps answering others (REQ-040-05, SC-040-01)
  let slowest = 0;
  let done = false;
  const started = Date.now();
  const bombed = send('Bomb', bomb).finally(() => (done = true));
  while (!done) {
    const t = Date.now();
    await call('GET', '/health');
    slowest = Math.max(slowest, Date.now() - t);
  }
  const bombAnswer = await bombed;
  const took = Date.now() - started;
  const laughsAnswer = await send('Laughs', laughs);
  // the same request with a real tree keeps it: the two above lost theirs to the limits only
  const realAnswer = await send('Real', Buffer.from(PAYMENT_XML).toString('base64'));
  const hasTree = async (answer: Answer) =>
    !!(await call('GET', `/test-runs/${(answer.body as { id: string }).id}`, { token: state.editorToken })).body
      .uiTreeName;

  expect(took).toBeLessThan(2000);
  expect(slowest).toBeLessThan(1000);
  expect(
    record({
      bomb: { status: bombAnswer.status, result: bombAnswer.body.status, hasUiTree: await hasTree(bombAnswer) },
      laughs: { status: laughsAnswer.status, result: laughsAnswer.body.status, hasUiTree: await hasTree(laughsAnswer) },
      real: { status: realAnswer.status, result: realAnswer.body.status, hasUiTree: await hasTree(realAnswer) },
    })
  ).toMatchSnapshot();
});

it('20 no secret readable in the database', async () => {
  // SC-044-01: what a dump of the database gives
  const db = new Client({ connectionString: process.env.DATABASE_URL?.replace(/\?schema=.*$/, '') });
  await db.connect();
  try {
    const users = (await db.query('SELECT "apiKey", "apiKeyEnding", "jiraToken", "geminiApiKey" FROM "User"')).rows;
    const projects = (await db.query('SELECT "imageComparisonConfig", "jiraToken" FROM "Project"')).rows;
    const dump = JSON.stringify([users, projects]);
    expect(dump).not.toContain(PERSONAL_JIRA_TOKEN);
    expect(dump).not.toContain(state.editorKey);
    expect(
      record({
        apiKeys: [...new Set(users.map((user) => (/^sha256:[0-9a-f]{64}$/.test(user.apiKey) ? 'hash' : 'readable')))],
        jiraTokens: [...new Set(users.map((user) => (user.jiraToken ? user.jiraToken.slice(0, 7) : null)))].sort(),
        editorKeyEnding: users.some((user) => user.apiKeyEnding === state.editorKey!.slice(-4)),
      })
    ).toMatchSnapshot();
  } finally {
    await db.end();
  }
});

it('21 each person sees only their projects', async () => {
  // 042: an admin reaches every project; anyone else only the ones they were given
  const admin = { token: state.adminToken };
  const editor = { token: state.editorToken };
  const guest = { token: state.guestToken };
  const key = { apiKey: state.editorKey };
  const editorId = (await call('GET', '/users/me', editor)).body.id;
  const made = await call('POST', '/projects', admin, {
    name: 'Private app',
    mainBranchName: 'master',
    autoApproveFeature: false,
    imageComparison: 'pixelmatch',
    maxBuildAllowed: 100,
    maxBranchLifetime: 30,
    imageComparisonConfig: '{"threshold":0.1,"ignoreAntialiasing":true,"allowDiffDimensions":false}',
  });
  expect(made.status).toBe(201);
  const privateId = made.body.id;
  const names = async (who: { token?: string }) =>
    ((await call('GET', '/projects', who)).body as Array<{ name: string }>).map((project) => project.name).sort();
  const builds = (who: object, projectId = privateId) =>
    call('GET', `/builds?projectId=${projectId}&take=10&skip=0`, who);

  const before = {
    adminSees: await names(admin),
    editorSees: await names(editor),
    guestSees: await names(guest),
    editorReadsBuilds: strip(await builds(editor)),
    editorReadsInsights: (await call('GET', `/analytics/${privateId}`, editor)).status,
    guestReadsTheEditorsProject: strip(await builds(guest, state.projectId)),
    autotestStarts: strip(await call('POST', '/builds', key, { project: 'Private app', branchName: 'ci' })),
    buildsMade: (await builds(admin)).body.total,
  };
  const given = await call('PUT', `/projects/${privateId}/access/${editorId}`, admin);
  const whileGiven = {
    given: strip(given),
    editorSees: await names(editor),
    editorReadsBuilds: (await builds(editor)).status,
    editorAsksWhoHasAccess: (await call('GET', `/projects/${privateId}/access`, editor)).status,
  };
  const taken = await call('DELETE', `/projects/${privateId}/access/${editorId}`, admin);
  const afterTaken = {
    taken: strip(taken),
    editorSees: await names(editor),
    editorReadsBuilds: (await builds(editor)).status,
  };
  await call('DELETE', `/projects/${privateId}`, admin);
  expect(record({ before, whileGiven, afterTaken })).toMatchSnapshot();
});

it('22 the API towards browsers, errors and password guessing', async () => {
  // 045: only Vision's interface reads answers in a browser; errors say no more than needed
  const withOrigin = async (origin: string) =>
    (await fetch(`${API}/health`, { headers: { Origin: origin } })).headers.get('access-control-allow-origin');
  const health = await fetch(`${API}/health`);
  const badRequest = await call('GET', '/projects/not-a-uuid/devices', { token: state.editorToken });
  const missing = await call('GET', `/builds/${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}`, {
    token: state.editorToken,
  });
  const guess = () => call('POST', '/users/login', {}, { email: 'guest@control.test', password: 'wrong' });
  const guesses = [];
  for (let i = 0; i < 5; i++) guesses.push((await guess()).status);
  const rightAfterGuesses = await call(
    'POST',
    '/users/login',
    {},
    { email: 'guest@control.test', password: 'guest-password' }
  );
  const answers = [badRequest, missing, rightAfterGuesses];
  // SC-045-01
  expect(JSON.stringify(answers.map((answer) => answer.body))).not.toMatch(/stack|exception/i);
  expect(
    record({
      ownInterface: await withOrigin('http://vision.control.test'),
      otherSite: await withOrigin('https://evil.example'),
      headers: Object.fromEntries(
        ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'x-powered-by'].map((name) => [
          name,
          health.headers.get(name),
        ])
      ),
      apiDocumentation: (await call('GET', '/api')).status,
      badRequest: strip(badRequest),
      missing: strip(missing),
      guesses,
      rightAfterGuesses: strip(rightAfterGuesses),
    })
  ).toMatchSnapshot();
});
