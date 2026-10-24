import { A11yIssueState } from '@prisma/client';
import { PNG } from 'pngjs';
import { jiraDescription, reviewReport } from './a11y-issues';
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

describe('reviewReport', () => {
  const stored = report([
    { ...violation('missing-label|a'), status: 'new' },
    { ...violation('touch-target|b', { severity: 'warning' }), status: 'new' },
    { ...violation('low-contrast|c', { severity: 'warning' }), status: 'existing' },
    { ...violation('redundant-role|d', { severity: 'info' }), status: 'new' },
  ]);

  it('counts everything nobody acted on when there are no decisions', () => {
    expect(reviewReport(stored, []).summary).toEqual({
      new: 2,
      existing: 1,
      reported: 0,
      ignored: 0,
      fixed: 2,
      total: 3,
    });
  });

  it('takes filed bugs out of the new count and false positives out of every count', () => {
    const reviewed = reviewReport(stored, [
      state('missing-label|a', 'reported', 'MOB-1'),
      state('touch-target|b', 'ignored'),
    ]);

    expect(reviewed.summary).toEqual({ new: 0, existing: 1, reported: 1, ignored: 1, fixed: 2, total: 2 });
    expect(reviewed.violations.find((v) => v.id === 'missing-label|a').issue).toMatchObject({
      status: 'reported',
      jiraKey: 'MOB-1',
    });
    expect(reviewed.ignored.map((v) => v.id)).toEqual(['touch-target|b']);
  });

  it('lists filed bugs whose issue is gone as resolved', () => {
    const reviewed = reviewReport(stored, [
      state('missing-label|gone', 'reported', 'MOB-7'),
      state('x|ignored', 'ignored'),
    ]);

    expect(reviewed.resolved).toEqual([
      { violationId: 'missing-label|gone', jiraKey: 'MOB-7', jiraUrl: 'https://jira/browse/MOB-7' },
    ]);
  });
});

describe('jiraDescription', () => {
  it('describes the screen, device, element and rule in wiki markup', () => {
    const text = jiraDescription({
      violation: violation('missing-label|a', { details: { widthDp: 34 } }),
      screenName: 'Payment',
      device: 'Pixel 7 · Android 15',
      url: 'https://vrt/p?buildId=b&testId=t',
    });

    expect(text).toContain('||Screen|Payment|');
    expect(text).toContain('||Device|Pixel 7 · Android 15|');
    expect(text).toContain('||Resource id|com.bank.app:id/btn_scan_qr|');
    expect(text).toContain('||Announced as|nothing|');
    expect(text).toContain('* widthDp: 34');
    expect(text).toContain('[Open in Visual Regression Tracker|https://vrt/p?buildId=b&testId=t]');
  });
});

describe('JiraClient', () => {
  const ok = (body: unknown, status = 200) =>
    ({ ok: status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as Response;

  it('files a bug in the task’s project, links it and attaches the screenshot', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(ok({ key: 'MOB-1200', fields: { project: { key: 'MOB' }, summary: 'Payments' } }))
      .mockResolvedValueOnce(ok({ key: 'MOB-1301' }, 201))
      .mockResolvedValueOnce(ok(undefined, 201))
      .mockResolvedValueOnce(ok([{ id: '1' }]));
    const client = new JiraClient({ url: 'https://jira.example.com/', token: 'pat' }, fetchMock);

    const result = await client.createLinkedIssue('MOB-1200', {
      summary: 'S',
      description: 'D',
      labels: ['accessibility'],
      attachment: { fileName: 'a.png', content: Buffer.from([1, 2]), contentType: 'image/png' },
    });

    expect(result).toEqual({ key: 'MOB-1301', url: 'https://jira.example.com/browse/MOB-1301', warnings: [] });
    const [getUrl, getInit] = fetchMock.mock.calls[0];
    expect(getUrl).toBe('https://jira.example.com/rest/api/2/issue/MOB-1200?fields=project,summary');
    expect(getInit.headers.Authorization).toBe('Bearer pat');
    const created = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(created.fields).toMatchObject({ project: { key: 'MOB' }, issuetype: { name: 'Bug' }, summary: 'S' });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      type: { name: 'Relates' },
      inwardIssue: { key: 'MOB-1301' },
      outwardIssue: { key: 'MOB-1200' },
    });
    expect(fetchMock.mock.calls[3][0]).toBe('https://jira.example.com/rest/api/2/issue/MOB-1301/attachments');
    expect(fetchMock.mock.calls[3][1].headers['X-Atlassian-Token']).toBe('no-check');
  });

  it('uses basic auth when an email is set (Jira Cloud)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(ok({ key: 'A-1', fields: { project: { key: 'A' }, summary: '' } }));
    await new JiraClient({ url: 'https://x.atlassian.net', token: 't', email: 'me@x.com' }, fetchMock).getIssue('A-1');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      `Basic ${Buffer.from('me@x.com:t').toString('base64')}`
    );
  });

  it('keeps the bug when linking fails and reports a warning', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(ok({ key: 'MOB-1', fields: { project: { key: 'MOB' }, summary: '' } }))
      .mockResolvedValueOnce(ok({ key: 'MOB-2' }, 201))
      .mockResolvedValueOnce(ok({ errorMessages: ['No link type named Relates'] }, 404));
    const result = await new JiraClient({ url: 'https://j', token: 't' }, fetchMock).createLinkedIssue('MOB-1', {
      summary: 'S',
      description: 'D',
      labels: [],
    });
    expect(result.key).toBe('MOB-2');
    expect(result.warnings[0]).toContain('No link type named Relates');
  });

  it('turns Jira error bodies into readable errors', async () => {
    const fetchMock = jest.fn().mockResolvedValue(ok({ errorMessages: ['Issue does not exist'] }, 404));
    await expect(new JiraClient({ url: 'https://j', token: 't' }, fetchMock).getIssue('NOPE-1')).rejects.toThrow(
      new JiraError('Jira GET /rest/api/2/issue/NOPE-1?fields=project,summary failed (404): Issue does not exist')
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
