import { ChildProcess, execFileSync, spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { mkdtempSync, rmSync } from 'fs';
import { createServer } from 'net';
import { tmpdir } from 'os';
import path from 'path';

/*
 * The API as a process, the way compose starts it (051, VIS-SEC-002): with a secret from an
 * example, a short one or one shared by both settings it stops and says why; with secrets the
 * instructions make it serves.
 */

const backend = path.join(__dirname, '..');
let dist: string;

const freePort = () =>
  new Promise<number>((resolve) => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });

function start(env: Record<string, string>): {
  process: ChildProcess;
  output: () => string;
  exit: Promise<number | null>;
} {
  let output = '';
  const child = spawn(process.execPath, [path.join(dist, 'main.js')], {
    cwd: backend,
    env: {
      PATH: process.env.PATH ?? '',
      // built outside the package: its dependencies are the package's own
      NODE_PATH: path.join(backend, 'node_modules'),
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      JWT_LIFE_TIME: '1d',
      ...env,
    },
  });
  child.stdout?.on('data', (chunk) => (output += chunk));
  child.stderr?.on('data', (chunk) => (output += chunk));
  const exit = new Promise<number | null>((resolve) => child.on('exit', (code) => resolve(code)));
  return { process: child, output: () => output, exit };
}

const strong = () => randomBytes(32).toString('base64');

describe('API start with its secrets (e2e)', () => {
  beforeAll(() => {
    dist = mkdtempSync(path.join(tmpdir(), 'vision-startup-'));
    execFileSync(
      process.execPath,
      [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.build.json', '--outDir', dist],
      {
        cwd: backend,
        stdio: 'pipe',
      }
    );
  }, 120_000);

  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  it.each([
    [
      'a secret from an example',
      { JWT_SECRET: 'change-me', VISION_SECRET_KEY: strong() },
      'JWT_SECRET is a value from an example',
    ],
    ['a short key', { JWT_SECRET: strong(), VISION_SECRET_KEY: 'short-key' }, 'VISION_SECRET_KEY is shorter than 32'],
    [
      'the same value for both',
      (() => {
        const same = strong();
        return { JWT_SECRET: same, VISION_SECRET_KEY: same };
      })(),
      'are the same',
    ],
    ['no key at all', { JWT_SECRET: strong() }, 'VISION_SECRET_KEY is not set'],
  ])(
    'does not start with %s, and says why',
    async (_, env, reason) => {
      const api = start({ ...env, APP_PORT: String(await freePort()) });
      const code = await Promise.race([
        api.exit,
        new Promise((resolve) => setTimeout(() => resolve('still running'), 20_000)),
      ]);
      api.process.kill();
      expect(code).toBe(1);
      expect(api.output()).toContain(reason);
    },
    30_000
  );

  it('serves with the secrets the instructions make', async () => {
    const port = await freePort();
    const api = start({ JWT_SECRET: strong(), VISION_SECRET_KEY: strong(), APP_PORT: String(port) });
    try {
      let status = 0;
      for (let attempt = 0; attempt < 60 && !status; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        status = await fetch(`http://127.0.0.1:${port}/health`, { headers: { connection: 'close' } }).then(
          (response) => response.status,
          () => 0
        );
      }
      expect(status).toBe(200);
    } finally {
      api.process.kill();
      await api.exit;
    }
  }, 60_000);
});
