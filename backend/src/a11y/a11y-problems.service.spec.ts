import { A11yIssuesService } from './a11y-issues.service';
import { A11yReport } from './a11y.types';

// Filing and looking up bugs against a fake Jira (fetch) and a Prisma mock
// with a real unique constraint on (projectId, key).
const report: A11yReport = {
  version: 1,
  format: 'appium-android',
  pixelsPerDp: 2.625,
  pixelsPerDpEstimated: false,
  baselineChecked: true,
  summary: { new: 1, existing: 0, fixed: 0, total: 1 },
  violations: [
    {
      id: 'touch-target|id:Адреса#PbButton',
      rule: 'touch-target',
      severity: 'warning',
      title: 'Touch target too small',
      message: 'Button is 38 × 38 dp.',
      nodeKey: 'id:Адреса#PbButton',
      resourceId: 'Адреса#PbButton',
      className: 'android.widget.Button',
      label: 'Адреса',
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      details: { widthDp: 38, heightDp: 38 },
      status: 'new',
    },
  ],
  fixed: [],
  screenTitle: 'Адреси',
  screenSelectors: ['id:Appbar#Title'],
};
const KEY = 'touch-target|c:PbButton|38x38';
const run = {
  id: 'run',
  projectId: 'p',
  buildId: 'b',
  name: 'Адреси. Екран',
  uiTreeName: 'tree',
  a11yReportName: 'report',
  imageName: null,
};

const ok = (body: unknown, status = 200) =>
  ({ ok: status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as Response;

function setup(jira: (url: string, init: RequestInit) => Response) {
  const rows: Array<Record<string, unknown>> = [];
  const unique = () => Object.assign(new Error('unique'), { code: 'P2002' });
  const byKey = (where: { projectId_key: { projectId: string; key: string } }) =>
    rows.find((row) => row.projectId === where.projectId_key.projectId && row.key === where.projectId_key.key) ?? null;
  const prisma = {
    testRun: {
      findUnique: jest.fn().mockResolvedValue(run),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    project: {
      findUnique: jest.fn().mockResolvedValue({ jiraUrl: 'https://jira', jiraToken: 't', uiTreeSettings: null }),
    },
    user: {
      findUnique: jest.fn(async ({ where }) =>
        where.id === 'with-token' ? { id: 'with-token', jiraToken: 'mine', jiraEmail: null } : { id: where.id }
      ),
    },
    a11yIssueState: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    a11yProblem: {
      findMany: jest.fn(async () => rows),
      findUnique: jest.fn(async ({ where }) => byKey(where)),
      create: jest.fn(async ({ data }) => {
        if (rows.some((row) => row.projectId === data.projectId && row.key === data.key)) throw unique();
        const row = { id: `id${rows.length}`, updatedAt: new Date(), ...data };
        rows.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }) =>
        Object.assign(
          rows.find((row) => row.id === where.id),
          data
        )
      ),
      updateMany: jest.fn(),
      deleteMany: jest.fn(async ({ where }) => {
        const index = rows.findIndex((row) => row.id === where.id && row.status === where.status);
        if (index >= 0) rows.splice(index, 1);
      }),
    },
  };
  const calls: string[] = [];
  const auth: string[] = [];
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    calls.push(`${init.method ?? 'GET'} ${url.replace('https://jira', '')}`);
    auth.push((init.headers as Record<string, string>)?.Authorization);
    return jira(url, init);
  }) as never;
  const service = new A11yIssuesService(
    prisma as never,
    { getImage: jest.fn().mockResolvedValue(null) } as never,
    { loadReport: jest.fn().mockResolvedValue(report), load: jest.fn() } as never,
    { testRunUpdated: jest.fn() } as never
  );
  return { service, rows, calls, auth };
}

const task = { key: 'MOB-1', fields: { project: { key: 'MOB' }, summary: 'Task', assignee: null } };
const fakeJira =
  (found: unknown[] = []) =>
  (url: string, init: RequestInit) => {
    if (url.includes('/search')) return ok({ issues: found });
    if (url.endsWith('/issue/MOB-1')) return ok(task);
    if (url.includes('/createmeta/MOB/issuetypes/')) return ok({ values: [] });
    if (url.includes('/createmeta/MOB/issuetypes')) return ok({ values: [{ id: '1', name: 'Bug', subtask: false }] });
    if (init.method === 'POST' && url.endsWith('/rest/api/2/issue')) return ok({ key: 'MOB-77', id: '77' }, 201);
    return ok(undefined, 201);
  };

describe('A11yIssuesService: no duplicate bugs', () => {
  const file = (service: A11yIssuesService) =>
    service.fileBug('run', [report.violations[0].id], { parentKey: 'MOB-1' });

  it('files one bug per problem, with its id, and records it for the project', async () => {
    const { service, rows, calls } = setup(fakeJira());
    const result = await file(service);
    expect(result).toMatchObject({ jiraKey: 'MOB-77', alreadyFiled: false, code: expect.stringMatching(/^a11y-/) });
    expect(rows).toEqual([expect.objectContaining({ key: KEY, status: 'reported', jiraKey: 'MOB-77' })]);
    // looked for the id in the task's project before creating
    expect(calls.find((call) => call.includes('/search'))).toContain(encodeURIComponent(result.code));
    // the create screen has no labels here, so they are added by editing the bug
    expect(calls).toContain('PUT /rest/api/2/issue/MOB-77');
  });

  it('links instead of filing when someone filed the problem already', async () => {
    const { service, calls } = setup(fakeJira());
    await file(service);
    const creates = () => calls.filter((call) => call === 'POST /rest/api/2/issue').length;
    expect(creates()).toBe(1);
    const second = await file(service);
    expect(second).toMatchObject({ jiraKey: 'MOB-77', alreadyFiled: true });
    expect(creates()).toBe(1);
  });

  it('refuses while a colleague is filing the same problem', async () => {
    const { service, rows } = setup(fakeJira());
    rows.push({ id: 'x', projectId: 'p', key: KEY, status: 'filing', screenName: 'Інший', updatedAt: new Date() });
    await expect(file(service)).rejects.toThrow(/being filed right now/);
  });

  it('links an open bug Jira already has with the problem id, and frees the claim when Jira fails', async () => {
    const open = { key: 'MOB-5', fields: { summary: 's', status: { name: 'Open', statusCategory: { key: 'new' } } } };
    const linked = setup(fakeJira([open]));
    expect(await file(linked.service)).toMatchObject({ jiraKey: 'MOB-5', alreadyFiled: true });
    expect(linked.calls).not.toContain('POST /rest/api/2/issue');

    const failing = setup((url, init) =>
      init.method === 'POST' && url.endsWith('/rest/api/2/issue')
        ? ok({ errors: { summary: 'bad' } }, 400)
        : fakeJira()(url, init)
    );
    await expect(file(failing.service)).rejects.toThrow(/bad/);
    expect(failing.rows).toEqual([]);
  });
});

describe('A11yIssuesService: review asks Jira', () => {
  it('marks a problem filed in Jira under its id as filed, once per while', async () => {
    let code = '';
    const { service, rows, calls } = setup((url) => {
      if (!url.includes('/search')) return ok({});
      const jql = decodeURIComponent(url);
      code = /labels in \("([^"]+)"\)/.exec(jql)[1];
      return ok({
        issues: [{ key: 'MOB-9', fields: { summary: `x [${code}]`, status: { statusCategory: { key: 'new' } } } }],
      });
    });
    const reviewed = await service.getReviewedReport('run');
    expect(reviewed.violations[0].issue).toMatchObject({ status: 'reported', jiraKey: 'MOB-9' });
    expect(rows).toEqual([expect.objectContaining({ key: KEY, code, jiraKey: 'MOB-9' })]);

    rows.length = 0;
    await service.getReviewedReport('run');
    expect(calls.filter((call) => call.includes('/search'))).toHaveLength(1);
  });
});

describe('A11yIssuesService: personal Jira tokens', () => {
  it("files as the person with their own token, else with the project's shared one", async () => {
    const own = setup(fakeJira());
    await own.service.fileBug('run', [report.violations[0].id], { parentKey: 'MOB-1' }, 'with-token');
    expect(new Set(own.auth)).toEqual(new Set(['Bearer mine']));

    const shared = setup(fakeJira());
    await shared.service.fileBug('run', [report.violations[0].id], { parentKey: 'MOB-1' }, 'without-token');
    expect(new Set(shared.auth)).toEqual(new Set(['Bearer t']));
  });
});
