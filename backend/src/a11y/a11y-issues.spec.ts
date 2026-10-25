import { A11yIssueState, A11yProblem } from '@prisma/client';
import { PNG } from 'pngjs';
import { reviewReport, ReviewContext } from './a11y-issues';
import { facetsOf, problemCode } from './a11y-problems';
import { A11yReport, A11yViolation } from './a11y.types';
import { JiraClient, JiraError } from './jira.client';
import { outlineElement } from './a11y-issues.service';

const violation = (id: string, overrides: Partial<A11yViolation> = {}): A11yViolation => ({
  id,
  rule: 'missing-label',
  severity: 'error',
  title: 'Control has no label',
  message: 'ImageButton (id/btn_scan_qr) has nothing for TalkBack to read out.',
  nodeKey: id.split('|')[1],
  resourceId: 'com.bank.app:id/btn_scan_qr',
  className: 'android.widget.ImageButton',
  label: '',
  bounds: { x: 10, y: 20, width: 30, height: 40 },
  ...overrides,
});

const report = (violations: A11yReport['violations']): A11yReport => ({
  version: 1,
  format: 'appium-android',
  pixelsPerDp: 2.625,
  pixelsPerDpEstimated: false,
  baselineChecked: true,
  summary: { new: 0, existing: 0, fixed: 2, total: 0 },
  violations,
  fixed: [],
});

const state = (violationId: string, status: string, jiraKey: string = null): A11yIssueState => ({
  id: violationId,
  projectId: 'p',
  screenName: 'Payment',
  violationId,
  status,
  jiraKey,
  jiraUrl: jiraKey ? `https://jira/browse/${jiraKey}` : null,
  comment: null,
  userId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const ctx = (states: A11yIssueState[] = [], problems: A11yProblem[] = []): ReviewContext => ({
  projectId: 'p',
  screenName: 'Payment',
  screen: 'Оплата',
  states,
  problems,
});

describe('reviewReport', () => {
  const stored = report([
    { ...violation('missing-label|a'), status: 'new' },
    { ...violation('touch-target|b', { severity: 'warning' }), status: 'new' },
    { ...violation('low-contrast|c', { severity: 'warning' }), status: 'existing' },
    { ...violation('redundant-role|d', { severity: 'info' }), status: 'new' },
  ]);

  it('counts everything nobody acted on when there are no decisions', () => {
    expect(reviewReport(stored, ctx()).summary).toEqual({
      new: 2,
      existing: 1,
      reported: 0,
      ignored: 0,
      fixed: 2,
      total: 3,
    });
  });

  it('takes filed bugs out of the new count and false positives out of every count', () => {
    const reviewed = reviewReport(
      stored,
      ctx([state('missing-label|a', 'reported', 'MOB-1'), state('touch-target|b', 'ignored')])
    );

    expect(reviewed.summary).toEqual({ new: 0, existing: 1, reported: 1, ignored: 1, fixed: 2, total: 2 });
    expect(reviewed.violations.find((v) => v.id === 'missing-label|a').issue).toMatchObject({
      status: 'reported',
      jiraKey: 'MOB-1',
    });
    expect(reviewed.ignored.map((v) => v.id)).toEqual(['touch-target|b']);
  });

  it('lists filed bugs whose issue is gone as resolved', () => {
    const reviewed = reviewReport(
      stored,
      ctx([state('missing-label|gone', 'reported', 'MOB-7'), state('x|ignored', 'ignored')])
    );

    expect(reviewed.resolved).toEqual([
      { violationId: 'missing-label|gone', jiraKey: 'MOB-7', jiraUrl: 'https://jira/browse/MOB-7' },
    ]);
  });
});

describe('JiraClient', () => {
  const ok = (body: unknown, status = 200) =>
    ({ ok: status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as Response;
  const client = (fetchMock: jest.Mock, email?: string) =>
    new JiraClient({ url: 'https://jira.example.com/', token: 'pat', email }, fetchMock);

  it('reads a task with its project, assignee and every field', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      ok({
        key: 'MOB-1200',
        fields: {
          project: { key: 'MOB' },
          summary: 'Payments',
          assignee: { name: 'den', displayName: 'Den' },
          customfield_1: 'x',
        },
      })
    );
    const issue = await client(fetchMock).getIssue('MOB-1200');
    expect(issue).toMatchObject({ key: 'MOB-1200', projectKey: 'MOB', summary: 'Payments', assignee: { name: 'den' } });
    expect(issue.fields.customfield_1).toBe('x');
    expect(fetchMock.mock.calls[0][0]).toBe('https://jira.example.com/rest/api/2/issue/MOB-1200');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer pat');
  });

  it('searches with the Jira Cloud search/jql endpoint, else the classic one, and tells open from done', async () => {
    const issues = {
      issues: [
        { key: 'MOB-1', fields: { summary: 'x [a11y-1]', status: { name: 'Open', statusCategory: { key: 'new' } } } },
        {
          key: 'MOB-2',
          fields: { summary: 'y', labels: ['a11y-1'], status: { name: 'Done', statusCategory: { key: 'done' } } },
        },
      ],
    };
    const cloud = jest.fn().mockResolvedValue(ok(issues));
    const found = await client(cloud).search('labels = "a11y-1"', 5);
    expect(cloud.mock.calls[0][0]).toContain('/rest/api/2/search/jql?jql=labels%20%3D%20%22a11y-1%22&maxResults=5');
    expect(found).toEqual([
      {
        key: 'MOB-1',
        url: 'https://jira.example.com/browse/MOB-1',
        summary: 'x [a11y-1]',
        status: 'Open',
        done: false,
        labels: [],
      },
      {
        key: 'MOB-2',
        url: 'https://jira.example.com/browse/MOB-2',
        summary: 'y',
        status: 'Done',
        done: true,
        labels: ['a11y-1'],
      },
    ]);

    const dataCenter = jest
      .fn()
      .mockResolvedValueOnce(ok({ errorMessages: ['nope'] }, 404))
      .mockResolvedValueOnce(ok(issues));
    expect(await client(dataCenter).search('x')).toHaveLength(2);
    expect(dataCenter.mock.calls[1][0]).toContain('/rest/api/2/search?jql=');
  });

  it('reads issue types and create fields from the Jira 9 endpoints', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        ok({
          values: [
            { id: '10', name: 'Помилка', subtask: true },
            { id: '1', name: 'Task' },
          ],
        })
      )
      .mockResolvedValueOnce(
        ok({ values: [{ fieldId: 'summary', name: 'Summary', required: true, schema: { type: 'string' } }] })
      );
    const jira = client(fetchMock);
    expect(await jira.issueTypes('MOB')).toEqual([
      { id: '10', name: 'Помилка', subtask: true },
      { id: '1', name: 'Task', subtask: false },
    ]);
    expect((await jira.createFields('MOB', '10'))[0]).toMatchObject({ id: 'summary', required: true });
    expect(fetchMock.mock.calls[1][0]).toContain('/rest/api/2/issue/createmeta/MOB/issuetypes/10');
  });

  it('reads Jira Cloud pages: issueTypes and fields lists, paged by total', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        ok({ issueTypes: [{ id: '10', name: 'Помилка', subtask: true }], startAt: 0, maxResults: 1, total: 2 })
      )
      .mockResolvedValueOnce(
        ok({ issueTypes: [{ id: '1', name: 'Task', subtask: false }], startAt: 1, maxResults: 1, total: 2 })
      )
      .mockResolvedValueOnce(
        ok({
          fields: [
            {
              fieldId: 'customfield_9',
              key: 'customfield_9',
              name: 'Замовник',
              required: true,
              schema: { type: 'user' },
            },
          ],
          startAt: 0,
          maxResults: 200,
          total: 1,
        })
      );
    const jira = client(fetchMock);
    expect((await jira.issueTypes('P24MOB')).map((type) => type.name)).toEqual(['Помилка', 'Task']);
    expect(fetchMock.mock.calls[0][0]).toContain('/issuetypes?startAt=0&maxResults=200');
    expect(fetchMock.mock.calls[1][0]).toContain('/issuetypes?startAt=1&maxResults=200');
    expect(await jira.createFields('P24MOB', '10')).toEqual([
      expect.objectContaining({ id: 'customfield_9', name: 'Замовник', required: true }),
    ]);
  });

  it('finds people for user fields with the user picker', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        ok({ users: [{ accountId: 'abc', displayName: 'Андрєєв Костянтин', html: '<b>А</b>' }], total: 1 })
      );
    expect(await client(fetchMock).findUsers('андр')).toEqual([
      { accountId: 'abc', displayName: 'Андрєєв Костянтин', name: undefined, key: undefined },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://jira.example.com/rest/api/2/user/picker?query=%D0%B0%D0%BD%D0%B4%D1%80&maxResults=20'
    );
  });

  it('falls back to the old createmeta call on Jira 8', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(ok({ errorMessages: ['Not found'] }, 404))
      .mockResolvedValueOnce(ok({ projects: [{ issuetypes: [{ id: '5', name: 'Bug', subtask: false }] }] }))
      .mockResolvedValueOnce(ok({ errorMessages: ['Not found'] }, 404))
      .mockResolvedValueOnce(
        ok({
          projects: [
            {
              issuetypes: [
                { fields: { customfield_7: { name: 'Severity', required: true, schema: { type: 'option' } } } },
              ],
            },
          ],
        })
      );
    const jira = client(fetchMock);
    expect(await jira.issueTypes('MOB')).toEqual([{ id: '5', name: 'Bug', subtask: false }]);
    expect(await jira.createFields('MOB', '5')).toEqual([
      { id: 'customfield_7', name: 'Severity', required: true, schema: { type: 'option' } },
    ]);
    expect(fetchMock.mock.calls[3][0]).toContain('expand=projects.issuetypes.fields');
  });

  it('creates, links, assigns and attaches with the calls Jira expects', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(ok({ key: 'MOB-1301' }, 201))
      .mockResolvedValueOnce(ok(undefined, 201))
      .mockResolvedValueOnce(ok(undefined, 204))
      .mockResolvedValueOnce(ok([{ id: '1' }]));
    const jira = client(fetchMock);
    expect(await jira.createIssue({ summary: 'S' })).toEqual({
      key: 'MOB-1301',
      url: 'https://jira.example.com/browse/MOB-1301',
    });
    await jira.link('Relates', 'MOB-1301', 'MOB-1200');
    await jira.assign('MOB-1301', { name: 'den' });
    await jira.attach('MOB-1301', { fileName: 'a.png', content: Buffer.from([1, 2]), contentType: 'image/png' });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ fields: { summary: 'S' } });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      type: { name: 'Relates' },
      inwardIssue: { key: 'MOB-1301' },
      outwardIssue: { key: 'MOB-1200' },
    });
    expect(fetchMock.mock.calls[2][0]).toBe('https://jira.example.com/rest/api/2/issue/MOB-1301/assignee');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ name: 'den' });
    expect(fetchMock.mock.calls[3][1].headers['X-Atlassian-Token']).toBe('no-check');
  });

  it('uses basic auth when an email is set (Jira Cloud)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(ok({ key: 'A-1', fields: { project: { key: 'A' }, summary: '' } }));
    await client(fetchMock, 'me@x.com').getIssue('A-1');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      `Basic ${Buffer.from('me@x.com:pat').toString('base64')}`
    );
  });

  it('turns Jira error bodies into readable errors', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        ok({ errors: { parent: 'Issue type is a sub-task but parent issue key or id not specified.' } }, 400)
      );
    await expect(client(fetchMock).createIssue({})).rejects.toThrow(
      new JiraError(
        'Jira POST /rest/api/2/issue failed (400): Issue type is a sub-task but parent issue key or id not specified.'
      )
    );
  });
});

describe('outlineElement', () => {
  it('draws a frame around the element and leaves the rest of the screenshot alone', () => {
    const image = new PNG({ width: 100, height: 100 });
    image.data.fill(255);
    const out = PNG.sync.read(outlineElement(image, { x: 40, y: 40, width: 20, height: 20 }));
    const at = (x: number, y: number) => Array.from(out.data.subarray((y * 100 + x) * 4, (y * 100 + x) * 4 + 3));
    expect(at(34, 50)).toEqual([255, 0, 128]);
    expect(at(50, 50)).toEqual([255, 255, 255]);
    expect(at(5, 5)).toEqual([255, 255, 255]);
  });
});

describe('reviewReport with problems decided on other screens', () => {
  const touch = (id: string, width: number) =>
    ({
      ...violation(`touch-target|${id}`, {
        rule: 'touch-target',
        severity: 'warning',
        details: { widthDp: width, heightDp: 38 },
      }),
      status: 'new',
    }) as A11yReport['violations'][number];
  const problem = (key: string, fields: Partial<A11yProblem> = {}): A11yProblem => ({
    id: key,
    projectId: 'p',
    key,
    code: problemCode('p', key),
    rule: null,
    facets: null,
    status: 'reported',
    jiraKey: 'P24MOB-20691',
    jiraUrl: 'u',
    comment: null,
    screenName: 'Адреси проживання',
    screenTitle: 'Адреси',
    userId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...fields,
  });

  it('covers the same component problem with the bug filed on another screen', () => {
    const stored = report([
      touch('id:Адреса реєстрації#PbButton', 38),
      touch('id:Адреса роботи#PbButton', 38.2),
      // the same component with another tap area is another problem
      touch('id:Інше#PbButton', 40),
    ]);
    const reviewed = reviewReport(stored, ctx([], [problem('touch-target|c:PbButton|38x38')]));

    expect(reviewed.violations.map((v) => v.group)).toEqual([
      'touch-target|c:PbButton|38x38',
      'touch-target|c:PbButton|38x38',
      'touch-target|c:PbButton|40x38',
    ]);
    expect(reviewed.violations[0].issue).toEqual({
      status: 'reported',
      jiraKey: 'P24MOB-20691',
      jiraUrl: 'u',
      comment: null,
      screenName: 'Адреси проживання',
      screenTitle: 'Адреси',
    });
    expect(reviewed.violations[0].problemCode).toMatch(/^a11y-[0-9a-f]{8}$/);
    expect(reviewed.violations[2].issue).toBeUndefined();
    expect(reviewed.summary).toMatchObject({ new: 1, reported: 2, total: 3 });
  });

  it('applies a false positive on a component everywhere, and a claim in progress counts as tracked', () => {
    const stored = report([touch('id:com.bank:id/tab', 38), touch('id:com.bank:id/pay', 38)]);
    const reviewed = reviewReport(
      stored,
      ctx(
        [],
        [
          problem('touch-target|c:tab|38x38', { status: 'ignored', jiraKey: null }),
          problem('touch-target|c:pay|38x38', { status: 'filing', jiraKey: null }),
        ]
      )
    );
    expect(reviewed.ignored.map((v) => v.id)).toEqual(['touch-target|id:com.bank:id/tab']);
    expect(reviewed.violations[0].issue.status).toBe('filing');
    expect(reviewed.summary).toMatchObject({ new: 0, reported: 1, ignored: 1 });
  });

  it('keeps ids and bugs when the settings change what is one problem', () => {
    // two bugs filed under the default settings, one per tab
    const facts = (index: number) => [facetsOf(touch(`id:com.bank:id/tab_${index}`, 38), 'Оплата')];
    const tab0 = problem('touch-target|c:tab_0|38x38', {
      id: 'p0',
      code: 'a11y-00000000',
      jiraKey: 'MOB-1',
      facets: facts(0) as never,
    });
    const tab1 = problem('touch-target|c:tab_1|38x38', {
      id: 'p1',
      code: 'a11y-11111111',
      jiraKey: 'MOB-2',
      facets: facts(1) as never,
      createdAt: new Date(Date.now() + 1000),
    });
    const stored = report([touch('id:com.bank:id/tab_0', 38), touch('id:com.bank:id/tab_1', 38)]);

    const before = reviewReport(stored, { ...ctx([], [tab0, tab1]) });
    expect(before.violations.map((v) => v.problemCode)).toEqual(['a11y-00000000', 'a11y-11111111']);

    // a class now sees the whole tab bar as one problem: the ids stay, both bugs are shown
    const tabs = {
      id: 't',
      name: 'Tab bar',
      when: { element: ['/^.*:id\\/(tab)_\\d+$/'] },
      groupBy: 'component' as const,
    };
    const after = reviewReport(stored, { ...ctx([], [tab0, tab1]), settings: { classes: [tabs] } });
    expect(after.violations.map((v) => v.group)).toEqual(['touch-target|c:tab|', 'touch-target|c:tab|']);
    expect(after.violations[0]).toMatchObject({ problemCode: 'a11y-00000000', issue: { jiraKey: 'MOB-1' } });
    expect(after.violations[0].issue.related).toEqual([{ code: 'a11y-11111111', jiraKey: 'MOB-2', jiraUrl: 'u' }]);
    expect(after.summary).toMatchObject({ new: 0, reported: 2 });
  });

  it('lists what a project class ignores with the false positives, never counted', () => {
    const stored = report([touch('id:com.bank:id/decor_1', 30)]);
    const reviewed = reviewReport(stored, {
      ...ctx(),
      settings: { classes: [{ id: 'c', name: 'Decor', match: '*decor_*', action: 'ignore' as const }] },
    });
    expect(reviewed.violations).toEqual([]);
    expect(reviewed.ignored[0]).toMatchObject({
      problemClass: 'Decor',
      issue: { status: 'ignored', byClass: 'Decor' },
    });
    expect(reviewed.summary).toMatchObject({ new: 0, total: 0, ignored: 1 });
  });

  it('lists a problem filed from this screen that the screen no longer has as resolved', () => {
    const gone = problem('missing-label|c:scan|', { screenName: 'Payment', jiraKey: 'MOB-9' });
    const reviewed = reviewReport(report([]), ctx([], [gone]));
    expect(reviewed.resolved).toEqual([{ violationId: gone.code, jiraKey: 'MOB-9', jiraUrl: 'u' }]);
  });
});
