import { PNG } from 'pngjs';
import { VisualBugsService } from './visual-bugs.service';

// Filing against a fake Jira (fetch) and a Prisma mock, as the accessibility bug tests do.
const run = {
  id: 'run',
  projectId: 'p',
  buildId: 'b',
  name: 'Checkout. Payment sheet',
  customTags: '',
  os: 'AOS 14',
  device: 'PIXEL_4_XL',
  browser: '',
  viewport: '',
  branchName: 'release/7.4',
  featureName: null,
  imageName: 'checkpoint.png',
  baselineName: 'baseline.png',
};

const ok = (body: unknown, status = 200) =>
  ({ ok: status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as Response;
const fail = (status = 403) => ({ ok: false, status, text: async () => '{"errorMessages":["No rights"]}' }) as Response;

const severity = {
  fieldId: 'customfield_1',
  name: 'Серйозність помилки',
  required: true,
  schema: { type: 'option' },
  allowedValues: [
    { id: '1', value: 'S1' },
    { id: '4', value: 'S4' },
  ],
};
const fieldsOnScreen = (withLabels: boolean) => [
  { fieldId: 'summary', name: 'Summary', required: true, schema: { type: 'string' } },
  { fieldId: 'description', name: 'Description', required: false, schema: { type: 'string' } },
  ...(withLabels ? [{ fieldId: 'labels', name: 'Labels', required: false, schema: { type: 'array' } }] : []),
  severity,
];

function setup(options: { labelsOnScreen?: boolean; refuse?: (url: string, init: RequestInit) => boolean } = {}) {
  const created: Array<Record<string, unknown>> = [];
  const bugs: Array<Record<string, unknown>> = [];
  const calls: string[] = [];
  const auth: string[] = [];
  const attachments: string[] = [];
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    const call = `${init.method ?? 'GET'} ${url.replace('https://jira', '').split('?')[0]}`;
    calls.push(call);
    auth.push((init.headers as Record<string, string>)?.Authorization);
    if (options.refuse?.(url, init)) return fail();
    if (url.endsWith('/issue/MOB-1')) {
      return ok({ key: 'MOB-1', fields: { project: { key: 'MOB' }, summary: 'Checkout redesign', assignee: null } });
    }
    if (url.includes('/createmeta/MOB/issuetypes/'))
      return ok({ values: fieldsOnScreen(options.labelsOnScreen ?? true) });
    if (url.includes('/createmeta/MOB/issuetypes')) return ok({ values: [{ id: '1', name: 'Bug', subtask: false }] });
    if (url.includes('/issueLinkType')) return ok({ issueLinkTypes: [{ name: 'Relates' }] });
    if (init.method === 'POST' && url.endsWith('/rest/api/2/issue')) {
      created.push(JSON.parse(String(init.body)).fields);
      return ok({ key: 'MOB-77', id: '77' }, 201);
    }
    if (url.endsWith('/attachments')) {
      attachments.push(((init.body as FormData).get('file') as File).name);
    }
    return ok(undefined, 204);
  }) as never;

  const png = new PNG({ width: 360, height: 600 });
  png.data.fill(255);
  const prisma = {
    testRun: { findUnique: jest.fn().mockResolvedValue(run) },
    build: { findUnique: jest.fn().mockResolvedValue({ number: 128, branchName: 'release/7.4' }) },
    project: { findUnique: jest.fn().mockResolvedValue({ jiraUrl: 'https://jira', jiraToken: 'shared' }) },
    user: {
      findUnique: jest.fn(async ({ where }) =>
        where.id === 'with-token' ? { id: 'with-token', jiraToken: 'mine', jiraEmail: null } : { id: where.id }
      ),
    },
    visualBug: {
      create: jest.fn(async ({ data }) => bugs.push(data)),
      findMany: jest.fn(async () => bugs),
    },
  };
  const statics = {
    getImage: jest.fn().mockResolvedValue(png),
    getImageBuffer: jest.fn().mockResolvedValue(Buffer.from('baseline')),
  };
  const service = new VisualBugsService(prisma as never, statics as never);
  return { service, created, bugs, calls, auth, attachments, prisma };
}

const filing = {
  parentKey: 'MOB-1',
  essence: 'кнопка «Pay» обрізана знизу',
  steps: '1. Відкрити Checkout',
  actual: 'Кнопка обрізана.',
  expected: 'Кнопка видна.',
  fieldValues: { customfield_1: { id: '4' } },
  marks: [{ x: 10, y: 500, width: 300, height: 60, element: 'id:pay' }],
};

describe('VisualBugsService', () => {
  it('asks for severity without choosing one and hides nothing else it filled', async () => {
    const { service } = setup();
    const prep = await service.prepare('run', { parentKey: 'MOB-1' });
    expect(prep.prefix).toBe('[Automation] [Checkout]');
    // the device and its OS, no build or branch (REQ-025-21)
    expect(prep.environment).toBe(
      'Проблема виявлена на PIXEL_4_XL (AOS 14) і потенційно відтворюється на всіх девайсах.'
    );
    expect(prep.inputs).toEqual([expect.objectContaining({ role: 'severity', required: true })]);
    expect(prep.inputs[0].value).toBeUndefined();
  });

  it('files under the task as the person with their own token', async () => {
    const { service, created, auth } = setup();
    const result = await service.file('run', filing, 'with-token');

    expect(result.jiraKey).toBe('MOB-77');
    expect(created[0]).toMatchObject({
      project: { key: 'MOB' },
      summary: '[Automation] [Checkout] кнопка «Pay» обрізана знизу',
      customfield_1: { id: '4' },
    });
    expect(String(created[0].description)).toContain('h3. Оточення');
    expect(auth.every((header) => header === 'Bearer mine')).toBe(true);
  });

  it('refuses to file while severity is not chosen', async () => {
    const { service, created } = setup();
    await expect(service.file('run', { ...filing, fieldValues: {} })).rejects.toThrow(/Серйозність помилки/);
    expect(created).toHaveLength(0);
  });

  it('attaches the marked checkpoint and the plain baseline', async () => {
    const { service, attachments } = setup();
    await service.file('run', filing);
    expect(attachments).toEqual(['checkpoint.png', 'baseline.png']);
  });

  it('labels the bug vision, on the create screen or right after', async () => {
    const onScreen = setup();
    await onScreen.service.file('run', filing);
    expect(onScreen.created[0].labels).toEqual(['vision']);

    const after = setup({ labelsOnScreen: false });
    await after.service.file('run', filing);
    expect(after.created[0].labels).toBeUndefined();
    expect(after.calls).toContain('PUT /rest/api/2/issue/MOB-77');
  });

  it('keeps the bug and warns when linking or attaching fails', async () => {
    const { service, bugs } = setup({
      refuse: (url) => url.includes('/issueLink') || url.endsWith('/attachments'),
    });
    const result = await service.file('run', filing);

    expect(result.jiraKey).toBe('MOB-77');
    expect(result.warnings).toEqual([
      expect.stringContaining('Not linked to MOB-1'),
      expect.stringContaining('checkpoint.png not attached'),
      expect.stringContaining('baseline.png not attached'),
    ]);
    expect(bugs).toHaveLength(1);
  });

  it('lists the check’s bugs on every device and build', async () => {
    const { service, prisma } = setup();
    await service.file('run', filing);
    const [bug] = await service.forCheck('run');

    expect(prisma.visualBug.findMany).toHaveBeenCalledWith({
      where: { projectId: 'p', checkName: 'Checkout. Payment sheet', customTags: '' },
      orderBy: { createdAt: 'desc' },
    });
    expect(bug).toMatchObject({ jiraKey: 'MOB-77', sameDevice: true });
    expect(bug.marks).toEqual([{ n: 1, x: 10, y: 500, width: 300, height: 60, element: 'id:pay' }]);
  });
});
