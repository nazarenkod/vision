import { PNG } from 'pngjs';
import { Worker } from 'worker_threads';
import { DiffWorkerPool } from './diff-worker-pool';

// Opaque throughout: pixelmatch composites transparent pixels onto white, so a
// fully transparent image would read as equal to a white one.
const png = (width: number, height: number, rgb: number): Buffer => {
  const image = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    image.data[i * 4] = rgb;
    image.data[i * 4 + 1] = rgb;
    image.data[i * 4 + 2] = rgb;
    image.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(image);
};

describe('DiffWorkerPool', () => {
  let pool: DiffWorkerPool;

  beforeEach(() => {
    pool = new DiffWorkerPool();
  });

  afterEach(async () => {
    await pool.onModuleDestroy();
  });

  it('answers a diff job with the pixel mismatch it found', async () => {
    const output = await pool.run({
      kind: 'diff',
      baseline: png(10, 10, 0),
      image: png(10, 10, 255),
      ignoreAreas: [],
      threshold: 0.1,
      includeAA: false,
      allowDiffDimensions: false,
      diffTolerancePercent: 0,
      saveDiff: false,
    });

    expect(output).toMatchObject({ equal: false, pixelMisMatchCount: 100 });
  });

  it('answers a signature job with a change signature', async () => {
    const output = await pool.run({
      kind: 'signature',
      baseline: png(10, 10, 0),
      image: png(10, 10, 255),
      ignoreAreas: [],
      threshold: 0.1,
      includeAA: false,
    });

    expect(output.signature).toHaveLength(64);
    expect(output.signature.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
  });

  describe('with a job that never finishes', () => {
    // A worker that answers a job only when it is not marked stuck; a stuck one spins for good,
    // as a crafted ignore area once did (VIS-SEC-005).
    class StuckPool extends DiffWorkerPool {
      protected readonly jobTimeoutMs = 300;
      protected inline = false;
      protected createWorker(): Worker {
        return new Worker(
          `const { parentPort } = require('worker_threads');
           parentPort.on('message', (job) => {
             if (job.stuck) for (;;) {}
             parentPort.postMessage({ equal: true });
           });`,
          { eval: true }
        );
      }
    }
    let stuckPool: StuckPool;

    beforeEach(() => {
      stuckPool = new StuckPool();
    });

    afterEach(async () => {
      await stuckPool.onModuleDestroy();
    });

    it('fails the stuck job after the timeout and keeps comparing the next ones', async () => {
      const stuck = { kind: 'signature', stuck: true } as never;
      const fine = { kind: 'signature' } as never;

      await expect(stuckPool.run(stuck)).rejects.toThrow('took longer than 300 ms');
      await expect(stuckPool.run(fine)).resolves.toEqual({ equal: true });
    });
  });
});
