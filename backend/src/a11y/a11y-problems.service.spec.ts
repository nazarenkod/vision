import { BadRequestException } from '@nestjs/common';
import { PNG } from 'pngjs';
import { sealSecret } from '../shared/secret-box';
import { A11yIssuesService } from './a11y-issues.service';
import { facetsOf } from './a11y-problems';
import { parseUiTreeSettings } from '../ui-tree/comparison-inputs';
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

function setup(jira: (url: string, init: RequestInit) => Response, project: Record<string, unknown> = {}) {
  const rows: Array<Record<string, unknown>> = [];
  const decisions: Array<Record<string, unknown>> = [];
  // decisions kept per issue and screen before problems existed (A11yIssueState)
  const states: Array<Record<string, unknown>> = [];
  const isState = (row: Record<string, unknown>, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([field, value]) =>
      value && typeof value === 'object' && 'in' in value
        ? (value as { in: unknown[] }).in.includes(row[field])
        : row[field] === value
    );
  let version = 1;
  const unique = () => Object.assign(new Error('unique'), { code: 'P2002' });
  const byKey = (where: { projectId_key: { projectId: string; key: string } }) =>
    rows.find((row) => row.projectId === where.projectId_key.projectId && row.key === where.projectId_key.key) ?? null;
  const prisma = {
    testRun: {
      findUnique: jest.fn().mockResolvedValue(run),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(run),
      update: jest.fn(),
    },
    project: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ jiraUrl: 'https://jira', jiraToken: 'shared', uiTreeSettings: null, ...project }),
    },
    user: {
      findUnique: jest.fn(async ({ where }) =>
        where.id === 'with-token'
          ? { id: 'with-token', jiraToken: sealSecret('mine'), jiraEmail: null }
          : where.id === 'reviewer'
            ? { id: 'reviewer', jiraToken: sealSecret('t'), jiraEmail: null }
            : { id: where.id }
      ),
    },
    a11yIssueState: {
      findMany: jest.fn(async ({ where } = {}) => states.filter((row) => isState(row, where))),
      deleteMany: jest.fn(async ({ where }) => {
        const keep = states.filter((row) => !isState(row, where));
        states.splice(0, states.length, ...keep);
      }),
      delete: jest.fn(
        async ({ where }) =>
          states.splice(
            states.findIndex((row) => row.id === where.id),
            1
          )[0]
      ),
    },
    a11yDecision: {
      create: jest.fn(async ({ data }) => decisions.push(data)),
      // newest first, as the service orders them
      findMany: jest.fn(async ({ where }) =>
        decisions
          .filter(
            (item) =>
              item.projectId === where.projectId &&
              where.jiraKey.in.includes(item.jiraKey) &&
              where.action.in.includes(item.action)
          )
          .reverse()
      ),
    },
    a11yProblem: {
      aggregate: jest.fn(async () => ({
        _count: { _all: rows.length },
        _max: { updatedAt: new Date(version++) },
      })),
      findMany: jest.fn(async () => rows),
      findUnique: jest.fn(async ({ where }) => byKey(where)),
      create: jest.fn(async ({ data }) => {
        if (rows.some((row) => row.projectId === data.projectId && row.key === data.key)) throw unique();
        const row = { id: `id${rows.length}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        rows.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }) =>
        Object.assign(
          rows.find((row) => row.id === where.id),
          data
        )
      ),
      upsert: jest.fn(async ({ where, create, update }) => {
        const found = byKey(where);
        if (found) return Object.assign(found, update);
        const row = { id: `id${rows.length}`, createdAt: new Date(), updatedAt: new Date(), ...create };
        rows.push(row);
        return row;
      }),
      updateMany: jest.fn(),
      deleteMany: jest.fn(async ({ where }) => {
        const index = rows.findIndex(
          (row) => row.id === where.id && (where.status === undefined || row.status === where.status)
        );
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
  return { service, rows, calls, auth, decisions, states };
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
    service.fileBug('run', [report.violations[0].id], { parentKey: 'MOB-1' }, 'reviewer');

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
    rows.push({
      id: 'x',
      projectId: 'p',
      key: KEY,
      code: 'a11y-x',
      status: 'filing',
      screenName: 'Інший',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(file(service)).rejects.toThrow(/being filed right now/);
  });

  it('links an open bug Jira already has with the problem id, and frees the claim when Jira fails', async () => {
    const status = { name: 'Open', statusCategory: { key: 'new' } };
    // filed by hand or by another Vision, with the problem's markers but another id
    const open = {
      key: 'MOB-5',
      fields: { summary: 's', status, labels: ['a11y-touch-target', 'a11y-component-PbButton', 'a11y-value-38x38'] },
    };
    // a search hit without the id or every marker is not the problem's bug
    const noise = { key: 'MOB-4', fields: { summary: 's', status, labels: ['a11y-touch-target'] } };
    const linked = setup(fakeJira([noise, open]));
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
      code = /labels = "(a11y-[0-9a-f]{8})"/.exec(jql)[1];
      return ok({
        issues: [{ key: 'MOB-9', fields: { summary: `x [${code}]`, status: { statusCategory: { key: 'new' } } } }],
      });
    });
    const reviewed = await service.getReviewedReport('run', 'reviewer');
    expect(reviewed.violations[0].issue).toMatchObject({ status: 'reported', jiraKey: 'MOB-9' });
    expect(rows).toEqual([expect.objectContaining({ key: KEY, code, jiraKey: 'MOB-9' })]);

    rows.length = 0;
    await service.getReviewedReport('run', 'reviewer');
    expect(calls.filter((call) => call.includes('/search'))).toHaveLength(1);
  });
});

describe('A11yIssuesService: personal Jira tokens', () => {
  it("files as the person with their own token, never with the project's shared one", async () => {
    const own = setup(fakeJira());
    await own.service.fileBug('run', [report.violations[0].id], { parentKey: 'MOB-1' }, 'with-token');
    expect(new Set(own.auth)).toEqual(new Set(['Bearer mine']));

    const shared = setup(fakeJira());
    await expect(
      shared.service.fileBug('run', [report.violations[0].id], { parentKey: 'MOB-1' }, 'without-token')
    ).rejects.toThrow('Add your Jira token in your profile');
    expect(shared.auth).toEqual([]);
  });
});

describe('A11yIssuesService: unlinking', () => {
  it("takes Vision's markers off the bug, marks it unlinked and never links it again by itself", async () => {
    const edits: string[] = [];
    let code = '';
    const { service, rows, decisions } = setup((url, init) => {
      if (init.method === 'PUT') edits.push(String(init.body));
      if (url.includes('/search')) {
        const jql = decodeURIComponent(url);
        if (jql.includes('key = "MOB-77"')) {
          return ok({
            issues: [{ key: 'MOB-77', fields: { summary: 's', labels: ['accessibility', code, 'a11y-touch-target'] } }],
          });
        }
        // the bug still has the id in its summary
        return ok({
          issues: [
            {
              key: 'MOB-77',
              fields: { summary: `x [${code}]`, status: { statusCategory: { key: 'new' } }, labels: [] },
            },
          ],
        });
      }
      return fakeJira()(url, init);
    });
    const filed = await service.fileBug('run', [report.violations[0].id], { parentKey: 'MOB-1' }, 'reviewer');
    code = filed.code;
    edits.length = 0;

    expect(await service.reset('run', [report.violations[0].id], 'reviewer')).toEqual({ warnings: [] });
    expect(rows).toEqual([]);
    expect(JSON.parse(edits[0]).update.labels).toEqual(
      expect.arrayContaining([
        { remove: code },
        { remove: 'a11y-touch-target' },
        { add: code.replace('a11y-', 'a11y-unlinked-') },
      ])
    );
    // labels of others stay
    expect(edits[0]).not.toContain('accessibility');
    expect(decisions.map((item) => item.action)).toEqual(['filed', 'unlinked']);

    // the review finds the bug by the id in its summary, and leaves it alone
    const reviewed = await service.getReviewedReport('run', 'reviewer');
    expect(reviewed.violations[0].issue).toBeUndefined();
    expect(rows).toEqual([]);
  });
});

describe('A11yIssuesService: problems decided under another grouping', () => {
  it('forgets only the part that is unlinked; the rest keeps the bug', async () => {
    const { service, rows, decisions } = setup(fakeJira());
    const other = {
      ...report.violations[0],
      id: 'touch-target|id:Інша#PbButton',
      nodeKey: 'id:Інша#PbButton',
      details: { widthDp: 38, heightDp: 40 },
    };
    // one problem filed for PbButton of any size, as an "any values" mode of old saw it
    rows.push({
      id: 'p',
      projectId: 'p',
      key: 'touch-target|c:PbButton|',
      code: 'a11y-aaaaaaaa',
      status: 'reported',
      jiraKey: 'MOB-3',
      screenName: 'Адреси. Екран',
      createdAt: new Date(),
      updatedAt: new Date(),
      facets: [facetsOf(report.violations[0], 'Адреси'), facetsOf(other, 'Платежі')],
    });
    // 38 × 38 and 38 × 40 are two problems now: unlinking the first leaves the second with the bug
    await service.reset('run', [report.violations[0].id], 'reviewer');
    expect(rows).toHaveLength(1);
    expect((rows[0].facets as Array<{ screen: string }>).map((item) => item.screen)).toEqual(['Платежі']);
    expect(decisions[0]).toMatchObject({ action: 'unlinked', jiraKey: 'MOB-3' });
  });

  it('groups by the fixed rule whatever grouping the project saved before', async () => {
    const { service, rows } = setup(fakeJira());
    // a project that once told tap areas apart per screen and ignored every PbButton
    const saved = parseUiTreeSettings(
      JSON.stringify({
        a11yDuplicates: { 'touch-target': 'screen' },
        a11yClasses: [{ id: 'c', name: 'Buttons', match: '*#PbButton', action: 'ignore' }],
      })
    );
    (service as unknown as { settingsFor: () => unknown }).settingsFor = async () => saved;

    const reviewed = await service.getReviewedReport('run', 'reviewer');
    expect(reviewed.violations.map((v) => v.group)).toEqual([KEY]);
    expect(reviewed.ignored).toEqual([]);
    expect(reviewed.summary).toMatchObject({ new: 1, ignored: 0 });

    // what the class ignored is filed as any other problem
    const filed = await service.fileBug('run', [report.violations[0].id], { parentKey: 'MOB-1' }, 'reviewer');
    expect(filed).toMatchObject({ jiraKey: 'MOB-77', alreadyFiled: false });
    expect(rows[0]).toMatchObject({ key: KEY, jiraKey: 'MOB-77' });
  });
});

describe("A11yIssuesService: the project's norms", () => {
  // the team agreed on 38 dp: the 38 × 38 button received at 48 dp passes now
  const at38 = { jiraUrl: 'https://jira', uiTreeSettings: '{"a11yNorms":{"touchTargetAndroid":38}}' };

  const prismaOf = (service: A11yIssuesService) =>
    (service as unknown as { prismaService: Record<string, Record<string, jest.Mock>> }).prismaService;

  it("reviews a received report by the project's current norms", async () => {
    const { service } = setup(fakeJira());
    expect((await service.getReviewedReport('run', 'reviewer')).violations).toHaveLength(1);

    prismaOf(service).project.findUnique = jest.fn().mockResolvedValue(at38);
    const reviewed = await service.getReviewedReport('run', 'reviewer');
    expect(reviewed.violations).toHaveLength(0);
    expect(reviewed.summary).toMatchObject({ new: 0, total: 0 });
  });

  it('recounts the latest builds after the settings change', async () => {
    const { service } = setup(fakeJira());
    const prisma = prismaOf(service);
    prisma.project.findUnique = jest.fn().mockResolvedValue(at38);
    prisma.build = { findMany: jest.fn().mockResolvedValue([{ id: 'b' }]) };
    prisma.testRun.findMany = jest.fn().mockResolvedValue([{ ...run, a11yNewCount: 1, a11yTotalCount: 1 }]);
    prisma.testRun.update = jest.fn().mockResolvedValue(run);

    await service.recountLatestBuilds('p');

    expect(prisma.build.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 'p' }, take: 5 }));
    expect(prisma.testRun.update).toHaveBeenCalledWith({
      where: { id: 'run' },
      data: { a11yNewCount: 0, a11yTotalCount: 0 },
    });
  });
});

// Jira answering one path its own way, the rest as the default fake
const jiraWith =
  (override: (url: string, init: RequestInit) => Response | undefined, found: unknown[] = []) =>
  (url: string, init: RequestInit) =>
    override(url, init) ?? fakeJira(found)(url, init);

/*
 * Filing a bug, as a decision table over what Vision and Jira already know. Each row is a branch
 * a reviewer reaches in practice; the one rule across all of them: a failed filing frees the
 * problem (no row left 'filing'), and a bug Jira created is recorded even if the extras fail.
 */
describe('A11yIssuesService: filing against what Jira answers', () => {
  const file = (service: A11yIssuesService, options: Record<string, unknown> = {}) =>
    service.fileBug('run', [report.violations[0].id], { parentKey: 'MOB-1', ...options }, 'reviewer');
  const creates = (calls: string[]) => calls.filter((call) => call === 'POST /rest/api/2/issue').length;
  const status = (key: string) => ({ name: key, statusCategory: { key } });
  const markers = ['a11y-touch-target', 'a11y-component-PbButton', 'a11y-value-38x38'];
  const fields = (values: unknown[]) => (url: string) =>
    /\/createmeta\/MOB\/issuetypes\/[^/?]+/.test(url) ? ok({ values, isLast: true }) : undefined;
  const types = (values: unknown[]) => (url: string) =>
    /\/createmeta\/MOB\/issuetypes\?/.test(url) ? ok({ values, isLast: true }) : undefined;

  it('refuses to file a problem marked as a false positive, without asking Jira', async () => {
    const { service, rows, calls } = setup(fakeJira());
    rows.push({ id: 'x', projectId: 'p', key: KEY, code: 'a11y-x', status: 'ignored', screenName: 'Інший' });

    await expect(file(service)).rejects.toThrow(/false positive on screen “Інший”/);
    expect(calls).toEqual([]);
  });

  it('files a new bug when Jira has only done ones, and names them', async () => {
    // a fixed bug that came back is a new bug, not a reopened one
    const done = { key: 'MOB-3', fields: { summary: 's', status: status('done'), labels: markers } };
    const { service, rows, calls } = setup(fakeJira([done]));

    const result = await file(service);

    expect(result).toMatchObject({ jiraKey: 'MOB-77', alreadyFiled: false });
    expect(result.warnings).toContainEqual(expect.stringMatching(/filed before as MOB-3 \(done\)/));
    expect(creates(calls)).toBe(1);
    expect(rows).toEqual([expect.objectContaining({ status: 'reported', jiraKey: 'MOB-77' })]);
  });

  it('still files when the Jira search fails, and says the duplicate check was skipped', async () => {
    const { service, calls } = setup(
      jiraWith((url) => (url.includes('/search') ? ok({ errorMessages: ['JQL down'] }, 500) : undefined))
    );

    const result = await file(service);

    expect(result.jiraKey).toBe('MOB-77');
    expect(result.warnings).toContainEqual(expect.stringMatching(/^Could not check Jira for a11y-/));
    expect(creates(calls)).toBe(1);
  });

  it('names the required fields left empty, files nothing and lets the reviewer try again', async () => {
    const team = { fieldId: 'customfield_7', name: 'Team', required: true, schema: { type: 'string' } };
    const { service, rows, calls } = setup(jiraWith(fields([team])));

    await expect(file(service)).rejects.toThrow(/still empty for "Bug": Team/);
    expect(creates(calls)).toBe(0);
    // no claim left behind: otherwise the next try reads "being filed right now"
    expect(rows).toEqual([]);

    const retried = await file(service, { fieldValues: { customfield_7: 'Mobile' } });
    expect(retried).toMatchObject({ jiraKey: 'MOB-77', alreadyFiled: false });
  });

  it('refuses when the Jira project offers no issue type to create, and frees the problem', async () => {
    const { service, rows } = setup(jiraWith(types([])));

    await expect(file(service)).rejects.toThrow(/offers no issue type to create/);
    expect(rows).toEqual([]);
  });

  it('files under the issue type the reviewer chose, not the default', async () => {
    const { service, calls } = setup(
      jiraWith(
        types([
          { id: '1', name: 'Bug', subtask: false },
          { id: '5', name: 'Defect', subtask: false },
        ])
      )
    );

    await file(service, { issueTypeId: '5' });

    expect(calls).toContainEqual(expect.stringContaining('/createmeta/MOB/issuetypes/5'));
    expect(calls).not.toContainEqual(expect.stringContaining('/createmeta/MOB/issuetypes/1'));
  });

  it('links a bug to its task, but not a sub-task, which Jira already ties to its parent', async () => {
    const bug = setup(fakeJira());
    await file(bug.service);
    expect(bug.calls).toContain('POST /rest/api/2/issueLink');

    const subtask = setup(jiraWith(types([{ id: '9', name: 'Sub-task', subtask: true }])));
    await file(subtask.service);
    expect(subtask.calls).not.toContain('POST /rest/api/2/issueLink');
  });

  it('keeps a created bug when labels, the link and the screenshot fail, and warns about each', async () => {
    // Jira created the bug: failing here would leave a bug Vision does not know about, filed twice next time
    const { service, rows } = setup(
      jiraWith((url, init) =>
        (init.method === 'PUT' && url.endsWith('/issue/MOB-77')) ||
        url.endsWith('/issueLink') ||
        url.endsWith('/MOB-77/attachments')
          ? ok({ errorMessages: ['nope'] }, 403)
          : undefined
      )
    );
    const png = new PNG({ width: 20, height: 20 });
    (service as unknown as { staticService: { getImage: jest.Mock } }).staticService.getImage = jest
      .fn()
      .mockResolvedValue(png);

    const result = await file(service);

    expect(result).toMatchObject({ jiraKey: 'MOB-77', alreadyFiled: false });
    expect(result.warnings).toEqual([
      expect.stringMatching(/^Labels not set/),
      expect.stringMatching(/^Not linked to MOB-1/),
      expect.stringMatching(/^Screenshot not attached/),
    ]);
    expect(rows).toEqual([expect.objectContaining({ status: 'reported', jiraKey: 'MOB-77' })]);
  });

  it('files without a screenshot when the image cannot be read', async () => {
    const { service, calls } = setup(fakeJira());
    (service as unknown as { staticService: { getImage: jest.Mock } }).staticService.getImage = jest
      .fn()
      .mockRejectedValue(new Error('disk'));

    await expect(file(service)).resolves.toMatchObject({ jiraKey: 'MOB-77', warnings: [] });
    expect(calls.some((call) => call.endsWith('/attachments'))).toBe(false);
  });

  it('frees the problem when the parent task does not exist', async () => {
    const { service, rows, calls } = setup(
      jiraWith((url) =>
        url.endsWith('/issue/MOB-404') ? ok({ errorMessages: ['Issue does not exist'] }, 404) : undefined
      )
    );

    await expect(file(service, { parentKey: ' mob-404 ' })).rejects.toThrow(/does not exist/);
    expect(rows).toEqual([]);
    expect(creates(calls)).toBe(0);
  });
});

describe('A11yIssuesService: linking an existing bug', () => {
  const link = (service: A11yIssuesService, key: string) =>
    service.link('run', [report.violations[0].id], key, 'reviewer');

  it("records the bug under Jira's own key and address, whatever case it was typed in", async () => {
    const { service, rows } = setup(
      jiraWith((url) => (url.endsWith('/issue/MOB-5') ? ok({ ...task, key: 'MOB-5' }) : undefined))
    );

    const result = await link(service, '  mob-5 ');

    expect(result).toMatchObject({ jiraKey: 'MOB-5', jiraUrl: 'https://jira/browse/MOB-5' });
    expect(rows).toEqual([expect.objectContaining({ status: 'reported', jiraKey: 'MOB-5' })]);
  });

  it('refuses a key Jira does not know, and records nothing', async () => {
    const { service, rows } = setup(
      jiraWith((url) =>
        url.endsWith('/issue/MOB-6') ? ok({ errorMessages: ['Issue does not exist'] }, 404) : undefined
      )
    );

    await expect(link(service, 'MOB-6')).rejects.toThrow(BadRequestException);
    expect(rows).toEqual([]);
  });

  it('keeps the key as typed when the project has no Jira', async () => {
    const { service, rows, calls } = setup(fakeJira());
    (service as unknown as { prismaService: { project: { findUnique: jest.Mock } } }).prismaService.project.findUnique =
      jest.fn().mockResolvedValue({ jiraUrl: null, uiTreeSettings: null });

    const result = await link(service, 'mob-8');

    expect(result).toMatchObject({ jiraKey: 'MOB-8', jiraUrl: null, warnings: [] });
    expect(rows).toEqual([expect.objectContaining({ status: 'reported', jiraKey: 'MOB-8' })]);
    expect(calls).toEqual([]);
  });
});

/*
 * Decisions kept per issue and screen before problems existed. Every decision on a problem replaces
 * the screen's own old one for those issues, and only that one: the same issue on another screen, in
 * another project or another issue of the screen keeps its old decision until decided there.
 */
describe('A11yIssuesService: old per-screen decisions', () => {
  const id = report.violations[0].id;
  const oldDecisions = () => [
    { id: 'this', projectId: 'p', screenName: run.name, violationId: id },
    { id: 'other-issue', projectId: 'p', screenName: run.name, violationId: 'contrast|id:Title' },
    { id: 'other-screen', projectId: 'p', screenName: 'Платежі', violationId: id },
    { id: 'other-project', projectId: 'q', screenName: run.name, violationId: id },
  ];
  const filedAs = (status: string) => (rows: Array<Record<string, unknown>>) =>
    rows.push({
      id: 'filed',
      projectId: 'p',
      key: KEY,
      code: 'a11y-aaaaaaaa',
      status,
      jiraKey: status === 'reported' ? 'MOB-3' : null,
      screenName: run.name,
      facets: [facetsOf(report.violations[0], 'Адреси')],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  it.each([
    ['ignoring', (s: A11yIssuesService) => s.ignore('run', [id], 'by design', 'reviewer'), undefined],
    ['linking', (s: A11yIssuesService) => s.link('run', [id], 'MOB-1', 'reviewer'), undefined],
    ['filing', (s: A11yIssuesService) => s.fileBug('run', [id], { parentKey: 'MOB-1' }, 'reviewer'), undefined],
    ['restoring', (s: A11yIssuesService) => s.reset('run', [id], 'reviewer'), filedAs('ignored')],
  ])('%s replaces only the old decision of this screen and issue', async (_case, act, before) => {
    const { service, states, rows } = setup(fakeJira());
    states.push(...oldDecisions());
    before?.(rows);

    await act(service);

    expect(states.map((state) => state.id)).toEqual(['other-issue', 'other-screen', 'other-project']);
  });

  it('moves an old decision to a problem that covers every screen, and records where it came from', async () => {
    const { service, states, rows, decisions } = setup(fakeJira());
    states.push({
      id: 'old',
      projectId: 'p',
      screenName: run.name,
      violationId: id,
      status: 'reported',
      jiraKey: 'MOB-3',
      jiraUrl: 'https://jira/browse/MOB-3',
      comment: null,
      userId: 'anna',
    });

    expect(await service.moveIssueStates()).toBe(1);

    expect(rows).toEqual([
      expect.objectContaining({ projectId: 'p', key: KEY, status: 'reported', jiraKey: 'MOB-3', userId: 'anna' }),
    ]);
    expect(decisions).toEqual([
      expect.objectContaining({ action: 'linked', jiraKey: 'MOB-3', screenName: run.name, userId: 'anna' }),
    ]);
    expect(states).toEqual([]);
  });

  it('moves an old false positive as ignored, and keeps the problem a colleague already decided', async () => {
    const { service, states, rows, decisions } = setup(fakeJira());
    states.push({ id: 'old', projectId: 'p', screenName: run.name, violationId: id, status: 'ignored', comment: 'ok' });
    expect(await service.moveIssueStates()).toBe(1);
    expect(rows[0]).toMatchObject({ status: 'ignored', comment: 'ok' });
    expect(decisions[0]).toMatchObject({ action: 'ignored' });

    // the same issue decided on the screen once more: the problem exists, the old decision just goes
    states.push({ id: 'again', projectId: 'p', screenName: run.name, violationId: id, status: 'reported' });
    expect(await service.moveIssueStates()).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'ignored' });
    expect(decisions).toHaveLength(1);
    expect(states).toEqual([]);
  });

  it('leaves an old decision whose issue the latest report no longer has, so it keeps applying on its screen', async () => {
    const { service, states, rows } = setup(fakeJira());
    states.push({ id: 'gone', projectId: 'p', screenName: run.name, violationId: 'touch-target|id:Removed' });

    expect(await service.moveIssueStates()).toBe(0);

    expect(states.map((state) => state.id)).toEqual(['gone']);
    expect(rows).toEqual([]);
  });
});

describe('A11yIssuesService: false positives', () => {
  const id = report.violations[0].id;

  it('marks the problem ignored for the whole project with the reason, and restoring it touches no Jira', async () => {
    const { service, rows, decisions, calls } = setup(fakeJira());

    const ignored = await service.ignore('run', [id], 'decorative', 'reviewer');

    expect(ignored.problems).toEqual([rows[0].code]);
    expect(rows[0]).toMatchObject({ key: KEY, status: 'ignored', comment: 'decorative', jiraKey: null });
    expect(decisions).toEqual([expect.objectContaining({ action: 'ignored', comment: 'decorative' })]);

    expect(await service.reset('run', [id], 'reviewer')).toEqual({ warnings: [] });
    expect(rows).toEqual([]);
    expect(decisions.map((item) => item.action)).toEqual(['ignored', 'restored']);
    expect(calls).toEqual([]);
  });
});

describe('A11yIssuesService: Vision markers on linked bugs', () => {
  const id = report.violations[0].id;
  const labelEdits = (calls: Array<{ url: string; body: string }>) =>
    calls.filter((call) => call.url.endsWith('/issue/MOB-5')).map((call) => JSON.parse(call.body).update.labels);

  it("puts the problem's markers on a bug linked by hand and lifts its unlinked mark", async () => {
    const puts: Array<{ url: string; body: string }> = [];
    const { service } = setup((url, init) => {
      if (init.method === 'PUT') puts.push({ url, body: String(init.body) });
      if (url.endsWith('/issue/MOB-5')) return ok({ key: 'MOB-5', fields: { project: { key: 'MOB' } } });
      return fakeJira()(url, init);
    });

    const linked = await service.link('run', [id], 'mob-5', 'reviewer');

    const code = linked.problems[0];
    expect(labelEdits(puts)).toEqual([
      expect.arrayContaining([
        { add: code },
        { add: 'a11y-touch-target' },
        { remove: code.replace('a11y-', 'a11y-unlinked-') },
      ]),
    ]);
    expect(linked.warnings).toEqual([]);
  });

  it('keeps the link when Jira refuses the markers, and says which bug lacks them', async () => {
    const { service, rows } = setup((url, init) => {
      if (init.method === 'PUT') return ok({ errorMessages: ['no permission'] }, 403);
      if (url.endsWith('/issue/MOB-5')) return ok({ key: 'MOB-5', fields: { project: { key: 'MOB' } } });
      return fakeJira()(url, init);
    });

    const linked = await service.link('run', [id], 'MOB-5', 'reviewer');

    expect(rows[0]).toMatchObject({ status: 'reported', jiraKey: 'MOB-5' });
    expect(linked.warnings).toEqual([expect.stringContaining('MOB-5')]);
  });

  it('forgets an unlinked bug in Vision even when Jira refuses to take the markers off, and says so', async () => {
    const { service, rows } = setup((url, init) =>
      init.method === 'PUT' ? ok({ errorMessages: ['no permission'] }, 403) : fakeJira()(url, init)
    );
    await service.link('run', [id], 'MOB-1', 'reviewer');

    const { warnings } = await service.reset('run', [id], 'reviewer');

    expect(rows).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining('MOB-1')]);
  });
});

describe('A11yIssuesService: what the review links by itself', () => {
  const foundUnderItsId = (key: string) => (url: string) => {
    if (!url.includes('/search')) return ok({});
    const code = /labels = "(a11y-[0-9a-f]{8})"/.exec(decodeURIComponent(url))[1];
    return ok({ issues: [{ key, fields: { summary: `x [${code}]`, status: { statusCategory: { key: 'new' } } } }] });
  };

  it('links a bug that another project unlinked: an unlink holds in its own project only', async () => {
    const { service, rows, decisions } = setup(foundUnderItsId('MOB-9'));
    decisions.push({ projectId: 'q', jiraKey: 'MOB-9', action: 'unlinked' });

    const reviewed = await service.getReviewedReport('run', 'reviewer');

    expect(reviewed.violations[0].issue).toMatchObject({ jiraKey: 'MOB-9' });
    expect(rows).toHaveLength(1);
  });

  it.each(['filed', 'linked', 'found'])('links a bug again once it was %s after unlinking', async (action) => {
    const { service, rows, decisions } = setup(foundUnderItsId('MOB-9'));
    decisions.push(
      { projectId: 'p', jiraKey: 'MOB-9', action: 'unlinked' },
      { projectId: 'p', jiraKey: 'MOB-9', action }
    );

    await service.getReviewedReport('run', 'reviewer');

    expect(rows).toEqual([expect.objectContaining({ jiraKey: 'MOB-9' })]);
  });

  it('leaves a bug alone while its latest decision in this project is an unlink', async () => {
    const { service, rows, decisions } = setup(foundUnderItsId('MOB-9'));
    decisions.push(
      { projectId: 'p', jiraKey: 'MOB-9', action: 'linked' },
      { projectId: 'p', jiraKey: 'MOB-9', action: 'unlinked' }
    );

    await service.getReviewedReport('run', 'reviewer');

    expect(rows).toEqual([]);
  });
});

describe('A11yIssuesService: how a new bug is tied to its task', () => {
  const linkTypeOf = async (chosen: string | undefined, project: Record<string, unknown>) => {
    const links: string[] = [];
    const { service } = setup((url, init) => {
      if (url.endsWith('/issueLink')) links.push(JSON.parse(String(init.body)).type.name);
      return fakeJira()(url, init);
    }, project);
    await service.fileBug('run', [report.violations[0].id], { parentKey: 'MOB-1', linkType: chosen }, 'reviewer');
    return links;
  };

  // decision table: the reviewer's choice, else the project's, else Relates
  it.each([
    ['the reviewer chose one', 'Blocks', { jiraLinkType: 'Clones' }, 'Blocks'],
    ['only the project set one', undefined, { jiraLinkType: 'Clones' }, 'Clones'],
    ['nobody set one', undefined, {}, 'Relates'],
  ])('links with the right type when %s', async (_case, chosen, project, expected) => {
    expect(await linkTypeOf(chosen, project)).toEqual([expected]);
  });
});

describe('A11yIssuesService: preparing a bug', () => {
  const id = report.violations[0].id;
  const prepare = (jira: (url: string, init: RequestInit) => Response, project = {}) => {
    const all = setup(jira, project);
    return { ...all, result: all.service.prepareBug('run', [id], ' mob-1 ', undefined, undefined, 'reviewer') };
  };
  const withLinkTypes = (names: string[]) =>
    jiraWith((url) =>
      url.endsWith('/issueLinkType') ? ok({ issueLinkTypes: names.map((name) => ({ name })) }) : undefined
    );

  it('offers what filing would do and changes nothing, in Vision or in Jira', async () => {
    const { result, rows, calls } = prepare(fakeJira());
    const prepared = await result;

    expect(prepared).toMatchObject({
      parent: { key: 'MOB-1', projectKey: 'MOB', assignee: null },
      issueTypeId: '1',
      existing: null,
      inJira: [],
    });
    expect(prepared.summary).toContain(prepared.problem.code);
    // the markers are the problem's own, not the labels every Vision bug gets
    expect(prepared.markers).toEqual(expect.arrayContaining([prepared.problem.code, 'a11y-touch-target']));
    expect(prepared.markers).not.toEqual(expect.arrayContaining(['accessibility']));
    expect(rows).toEqual([]);
    expect(calls.filter((call) => !call.startsWith('GET'))).toEqual([]);
  });

  // decision table for the link type offered first
  it.each([
    ["the project's type, in any case", ['Blocks', 'Relates', 'Clones'], { jiraLinkType: 'clones' }, 'Clones'],
    ['a "relates" type when the project has none', ['Blocks', 'Relates'], {}, 'Relates'],
    ['the Ukrainian one too', ['Блокує', "Пов'язано з"], {}, "Пов'язано з"],
    ['the first type when none relates', ['Blocks', 'Clones'], {}, 'Blocks'],
    ['nothing when Jira has no types', [], {}, null],
  ])('offers %s first', async (_case, names, project, expected) => {
    const { result } = prepare(withLinkTypes(names as string[]), project);
    expect((await result).linkType).toBe(expected);
  });

  it('shows who filed the problem already instead of offering a duplicate', async () => {
    const { service, rows } = setup(fakeJira());
    rows.push({
      id: 'filed',
      projectId: 'p',
      key: KEY,
      code: 'a11y-aaaaaaaa',
      status: 'reported',
      jiraKey: 'MOB-3',
      jiraUrl: 'https://jira/browse/MOB-3',
      screenName: 'Платежі',
      facets: [facetsOf(report.violations[0], 'Платежі')],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const prepared = await service.prepareBug('run', [id], 'MOB-1', undefined, undefined, 'reviewer');

    expect(prepared.existing).toMatchObject({ status: 'reported', jiraKey: 'MOB-3', screenName: 'Платежі' });
  });
});
