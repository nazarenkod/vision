import { createServer, IncomingMessage, Server } from 'http';
import { AddressInfo } from 'net';
import { execFile } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PNG } from 'pngjs';

export const API = process.env.CONTROL_API ?? '';
export const WORK = process.env.CONTROL_WORK ?? '';
export const FIXTURES = process.env.CONTROL_FIXTURES ?? '';

/**
 * Turns a response into what may be compared run to run: ids, times, keys, tokens and
 * file names get stable placeholders numbered in the order they first appear, so a
 * reference recorded once still matches a fresh database.
 */
export class Normalizer {
  private readonly seen = new Map<string, string>();
  private readonly counters = new Map<string, number>();
  private readonly fixed: Array<[string, string]> = [];

  /** Replaces a known value (base URLs, the personal Jira token) with a fixed label. */
  constant(value: string, label: string): void {
    if (value) this.fixed.push([value, label]);
  }

  private label(kind: string, value: string): string {
    const key = `${kind}:${value}`;
    let label = this.seen.get(key);
    if (!label) {
      const next = (this.counters.get(kind) ?? 0) + 1;
      this.counters.set(kind, next);
      label = `<${kind}${next}>`;
      this.seen.set(key, label);
    }
    return label;
  }

  text(value: string): string {
    let out = value;
    for (const [known, label] of this.fixed) out = out.split(known).join(label);
    return (
      out
        // stored files: "<apikey>.<kind>.<ext>"
        .replace(/\b[0-9A-Z]{28}\.[a-z]+\.(png|json\.gz)\b/g, (m) => this.label('file', m))
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, (m) =>
          this.label('id', m.toLowerCase())
        )
        // problem codes and group ids are hashes over ids of this run's project
        .replace(
          /\ba11y-(unlinked-)?[0-9a-f]{8}\b/g,
          (m, unlinked) => `a11y-${unlinked ?? ''}${this.label('problem', m.replace('unlinked-', ''))}`
        )
        .replace(/^[0-9a-f]{16}$/, (m) => this.label('hash', m))
        .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, '<jwt>')
        .replace(/\b[0-9A-Z]{7}-[0-9A-Z]{7}-[0-9A-Z]{7}-[0-9A-Z]{7}\b/g, (m) => this.label('apikey', m))
        .replace(/\b[0-9A-Z]{28}\b/g, (m) => this.label('apikey', m))
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, '<time>')
    );
  }

  value(input: unknown): unknown {
    if (typeof input === 'string') return this.text(input);
    if (Array.isArray(input)) return input.map((item) => this.value(item));
    if (input && typeof input === 'object') {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(input).sort()) {
        const item = (input as Record<string, unknown>)[key];
        // timings and caches say nothing about behaviour and differ every run
        if (/^(duration|elapsed|tookMs|generatedAt|computedAt|lastSeenAt|lastRunAt)$/.test(key)) {
          out[key] = item === null || item === undefined ? item : '<varies>';
        } else if (key === 'stack' && typeof item === 'string') {
          // server paths of the machine that ran it; whether a stack is sent at all stays visible
          out[key] = '<stack>';
        } else if (key === 'apiKeyEnding' && typeof item === 'string') {
          // the end of a random key: whether one is set, and that it stays the same, are what count
          out[key] = this.label('keyEnding', item);
        } else if (key === 'token' && typeof item === 'string' && /^[\w-]{40,}$/.test(item)) {
          out[key] = this.label('reportToken', item);
        } else {
          out[key] = this.value(item);
        }
      }
      return out;
    }
    return input;
  }
}

export interface Answer<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, string>;
}

export async function call<T = any>(
  method: string,
  path: string,
  auth: { token?: string; apiKey?: string } = {},
  body?: unknown
): Promise<Answer<T>> {
  const headers: Record<string, string> = {};
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  if (auth.apiKey) headers.apiKey = auth.apiKey;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // not JSON (an image, a redirect): kept as text, or its size for binaries
    parsed = response.headers.get('content-type')?.startsWith('image/') ? `<${text.length} bytes>` : text;
  }
  const kept: Record<string, string> = {};
  for (const name of ['content-type', 'location', 'cache-control', 'content-disposition']) {
    const value = response.headers.get(name);
    if (value) kept[name] = name === 'content-type' ? value.split(';')[0] : value;
  }
  return { status: response.status, body: parsed as T, headers: kept };
}

/** A minimal Jira Data Center: what Vision needs to file and find bugs, and a log of what it sent. */
export class FakeJira {
  readonly log: Array<{ method: string; path: string; auth: string; body?: unknown }> = [];
  private server?: Server;
  private next = 100;
  private readonly issues = new Map<string, { summary: string; labels: string[] }>();
  url = '';

  async start(): Promise<void> {
    this.issues.set('QA-1', { summary: 'Payments release', labels: [] });
    this.server = createServer((request, response) => {
      void this.handle(request).then(([status, body]) => {
        response.writeHead(status, { 'Content-Type': 'application/json' });
        response.end(body === undefined ? '' : JSON.stringify(body));
      });
    });
    // the API in a container reaches the host as host.docker.internal: then all interfaces
    const host = process.env.CONTROL_JIRA_HOST || '127.0.0.1';
    await new Promise<void>((resolve) => this.server!.listen(0, host === '127.0.0.1' ? host : '0.0.0.0', resolve));
    this.url = `http://${host}:${(this.server!.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }

  private async read(request: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  private async handle(request: IncomingMessage): Promise<[number, unknown]> {
    const raw = await this.read(request);
    const url = new URL(request.url ?? '/', 'http://jira');
    const path = url.pathname;
    const method = request.method ?? 'GET';
    let body: unknown;
    if ((request.headers['content-type'] ?? '').startsWith('application/json') && raw.length) {
      body = JSON.parse(raw.toString('utf8'));
    } else if ((request.headers['content-type'] ?? '').startsWith('multipart/form-data')) {
      body = describeMultipart(raw);
    }
    // decoded: JQL reads as written, and the codes in it get their placeholders
    this.log.push({
      method,
      path: decodeURIComponent(path + url.search),
      auth: String(request.headers.authorization ?? ''),
      body,
    });

    const issue = path.match(/^\/rest\/api\/2\/issue\/([A-Z]+-\d+)$/);
    if (issue && method === 'GET') {
      const found = this.issues.get(issue[1]);
      return found
        ? [200, { key: issue[1], fields: { summary: found.summary, project: { key: 'QA' }, labels: found.labels } }]
        : [404, { errorMessages: ['Issue does not exist'] }];
    }
    if (issue && method === 'PUT') return [204, undefined];
    if (path === '/rest/api/2/issue/createmeta/QA/issuetypes') {
      return [
        200,
        {
          values: [
            { id: '10001', name: 'Bug', subtask: false },
            { id: '10002', name: 'Sub-bug', subtask: true },
          ],
          isLast: true,
        },
      ];
    }
    if (/^\/rest\/api\/2\/issue\/createmeta\/QA\/issuetypes\/\d+$/.test(path)) {
      return [
        200,
        {
          values: [
            { fieldId: 'summary', name: 'Summary', required: true, schema: { type: 'string' } },
            { fieldId: 'description', name: 'Description', required: false, schema: { type: 'string' } },
            { fieldId: 'labels', name: 'Labels', required: false, schema: { type: 'array', items: 'string' } },
            { fieldId: 'parent', name: 'Parent', required: true, schema: { type: 'issuelink' } },
          ],
          isLast: true,
        },
      ];
    }
    if (path === '/rest/api/2/user/picker') {
      return [200, { users: [{ name: 'qa.engineer', key: 'qa.engineer', displayName: 'QA Engineer' }] }];
    }
    if (path === '/rest/api/2/search/jql' || path === '/rest/api/2/search') {
      return [200, { issues: [] }];
    }
    if (path === '/rest/api/2/issueLinkType') {
      return [200, { issueLinkTypes: [{ id: '1', name: 'Relates', inward: 'relates to', outward: 'relates to' }] }];
    }
    if (path === '/rest/api/2/issue' && method === 'POST') {
      const key = `QA-${this.next++}`;
      const fields = (body as { fields: { summary?: string; labels?: string[] } }).fields ?? {};
      this.issues.set(key, { summary: fields.summary ?? '', labels: fields.labels ?? [] });
      return [201, { id: String(this.next), key }];
    }
    if (path === '/rest/api/2/issueLink' || /\/assignee$/.test(path)) return [201, undefined];
    if (/\/attachments$/.test(path)) return [200, [{ id: '1' }]];
    return [404, { errorMessages: [`fake Jira has no ${method} ${path}`] }];
  }
}

/** What an upload carried: file names, types and, for PNGs, their size in pixels. */
function describeMultipart(raw: Buffer): unknown {
  const text = raw.toString('latin1');
  const parts: unknown[] = [];
  for (const match of text.matchAll(/filename="([^"]*)"\r\nContent-Type: ([^\r]*)\r\n\r\n/g)) {
    const start = (match.index ?? 0) + match[0].length;
    const png = raw.subarray(start, start + 24);
    const isPng = png.subarray(1, 4).toString('latin1') === 'PNG';
    parts.push({
      fileName: match[1],
      contentType: match[2],
      pixels: isPng ? `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}` : undefined,
    });
  }
  return { files: parts };
}

type Box = { x: number; y: number; w: number; h: number };

/** Element boxes of an Appium tree, in the tree's own units (px on Android, points on iOS). */
export function boxesOf(xml: string): Box[] {
  const boxes: Box[] = [];
  for (const m of xml.matchAll(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)) {
    const [x1, y1, x2, y2] = m.slice(1).map(Number);
    boxes.push({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
  }
  for (const m of xml.matchAll(/ x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)) {
    const [x, y, w, h] = m.slice(1).map(Number);
    boxes.push({ x, y, w, h });
  }
  return boxes;
}

/**
 * A synthetic screen for a tree: every element a flat box in its own shade, so the
 * picture is deterministic, matches the tree and carries no third-party content.
 * `changed` repaints the boxes it picks, which is how a visual change is made.
 */
export function screenFor(
  xml: string,
  width: number,
  height: number,
  scale = 1,
  changed: (box: Box) => boolean = () => false
): Buffer {
  const png = new PNG({ width, height });
  png.data.fill(255);
  boxesOf(xml).forEach((box, index) => {
    const shade = 40 + ((index * 37) % 180);
    const color = changed(box) ? [220, 40, 40] : [shade, shade, 255 - shade];
    const x1 = Math.round(box.x * scale);
    const y1 = Math.round(box.y * scale);
    const x2 = Math.min(width, Math.round((box.x + box.w) * scale));
    const y2 = Math.min(height, Math.round((box.y + box.h) * scale));
    if (x2 <= x1 || y2 <= y1) return;
    // one painted row, copied down the box; the top row and left column stay white,
    // so nested boxes stay visible
    const row = Buffer.alloc((x2 - x1) * 4, 255);
    for (let x = 1; x < x2 - x1; x++) row.set([color[0], color[1], color[2], 255], x * 4);
    const top = Buffer.alloc((x2 - x1) * 4, 255);
    png.data.set(top, (y1 * width + x1) * 4);
    for (let y = y1 + 1; y < y2; y++) png.data.set(row, (y * width + x1) * 4);
  });
  // no adaptive filter: inside Jest it takes ~10 s a frame, and the pixels are the same
  return PNG.sync.write(png, { filterType: 0 });
}

export function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

export function writeWork(name: string, content: Buffer | string): string {
  mkdirSync(join(WORK, 'files'), { recursive: true });
  const path = join(WORK, 'files', name);
  writeFileSync(path, content);
  return path;
}

export function run(
  command: string,
  args: string[],
  env: Record<string, string>,
  input?: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = execFile(
      command,
      args,
      { env: { PATH: process.env.PATH ?? '', HOME: WORK, ...env }, maxBuffer: 50 * 1024 * 1024, timeout: 180000 },
      (error, stdout, stderr) =>
        resolve({
          code: error ? ((error as { code?: number }).code ?? 1) : 0,
          stdout: String(stdout),
          stderr: String(stderr),
        })
    );
    if (input !== undefined) {
      child.stdin?.write(input);
      child.stdin?.end();
    }
  });
}
