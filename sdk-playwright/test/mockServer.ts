import { createServer, IncomingHttpHeaders, Server } from 'http';
import { AddressInfo } from 'net';
import { gunzipSync } from 'zlib';

export interface Received {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  json?: unknown;
  /** the multipart fields in the order they came; the image as its size and type */
  form?: [string, string][];
  image?: { name: string; type: string; size: number };
}

/** A stand-in for the Vision API that records what the SDK sends. */
export class MockVision {
  readonly received: Received[] = [];
  statuses: string[] = ['ok'];
  private server: Server;

  constructor() {
    this.server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = Buffer.concat(chunks);
      const got: Received = { method: req.method!, url: req.url!, headers: req.headers };
      const type = req.headers['content-type'] ?? '';
      if (type.startsWith('application/json')) got.json = JSON.parse(body.toString());
      if (type.startsWith('multipart/form-data')) {
        const form = await new Response(body, { headers: { 'content-type': type } }).formData();
        got.form = [];
        for (const [key, value] of form.entries()) {
          if (typeof value === 'string') got.form.push([key, value]);
          else got.image = { name: (value as File).name, type: value.type, size: value.size };
        }
      }
      this.received.push(got);
      res.setHeader('content-type', 'application/json');
      if (req.url === '/builds') return res.end(JSON.stringify({ id: 'build-1', projectId: 'project-1' }));
      if (req.url?.startsWith('/builds/')) return res.end(JSON.stringify({ id: 'build-1', isRunning: false }));
      const status = this.statuses.length > 1 ? this.statuses.shift()! : this.statuses[0];
      res.end(
        JSON.stringify({
          id: 'run-1',
          imageName: 'image.png',
          diffPercent: 0,
          status,
          url: 'http://vision/run-1',
          merge: false,
        })
      );
    });
  }

  async listen(): Promise<string> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  testRuns(): Received[] {
    return this.received.filter((r) => r.url === '/test-runs/multipart');
  }
}

export const field = (got: Received, name: string): string | undefined => got.form?.find(([key]) => key === name)?.[1];

export const unpackTree = (packed: string): string => gunzipSync(Buffer.from(packed, 'base64')).toString('utf8');
