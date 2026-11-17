import { readFileSync } from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { StaticService } from '../static/static.service';
import { LocateCandidate, locatedKey } from './comparison-inputs';
import { RecognisedWord } from './text-locate';
import { MAX_LOCATED_ELEMENTS, TextLocatorService } from './text-locator.service';
import { placesOf, TextPart } from './variable-text';

// a history row drawn in a browser like the bank's (no real screenshot in the repository)
const row = PNG.sync.read(readFileSync(path.join(__dirname, '__fixtures__', 'variable-text-row.png')));
const text = 'Зі своєї картки *1051 +12.50 UAH 17 серпня, 09:05';
const parts: TextPart[] = [
  { text: 'Зі своєї картки *' },
  { pattern: '\\d+', sample: '1050' },
  { text: ' ' },
  { pattern: '[+\\-−]?\\d+\\.\\d{2}', sample: '+1.01' },
  { text: ' UAH 17 серпня, ' },
  { pattern: '\\d+:\\d{2}', sample: '13:59' },
];
const side = (bounds = { x: 0, y: 0, width: row.width, height: row.height }) => ({ bounds, ...placesOf(parts, text) });
const candidate = (key = 'row', bounds?: { x: number; y: number; width: number; height: number }): LocateCandidate => ({
  ruleId: 'v',
  key,
  current: side(bounds),
  baseline: side(bounds),
});
const images = { current: 'now.png', baseline: 'was.png' };
const staticService = { getImage: jest.fn().mockResolvedValue(row) } as unknown as StaticService;

describe('TextLocatorService', () => {
  it('finds the pieces of a rendered history row offline, the same each time', async () => {
    const runs = [];
    for (let i = 0; i < 2; i++) {
      // a new service each time: nothing remembered between the two
      const locator = new TextLocatorService(staticService);
      runs.push((await locator.locate([candidate()], images)).get(locatedKey('v', 'row')));
      await locator.onModuleDestroy();
    }
    const found = runs[0] as { current: Array<{ x: number; y: number; width: number; height: number }> };
    expect(found.current).toHaveLength(3);
    // "*1051" on the first line left of the middle, "+12.50" right, "09:05" on the second line
    const [number, sum, time] = found.current;
    expect(number.x).toBeLessThan(row.width / 2);
    expect(sum.x).toBeGreaterThan(row.width / 2);
    expect(time.y).toBeGreaterThan(sum.y + sum.height / 2);
    expect(runs[1]).toEqual(runs[0]);
  }, 60_000);

  it('finds a word inside the frame of a button, read with Latin letters', async () => {
    const button = PNG.sync.read(readFileSync(path.join(__dirname, '__fixtures__', 'variable-text-button.png')));
    const words: TextPart[] = [{ pattern: '\\p{L}+', sample: 'Історія' }];
    const bounds = { x: 0, y: 0, width: button.width, height: button.height };
    const place = { bounds, ...placesOf(words, 'Історія') };
    const locator = new TextLocatorService({ getImage: async () => button } as unknown as StaticService);
    const found = await locator.locate([{ ruleId: 'v', key: 'history', current: place, baseline: place }], images);
    await locator.onModuleDestroy();
    const areas = (found.get(locatedKey('v', 'history')) as { current: Array<{ x: number; width: number }> }).current;
    // the word, right of the clock icon, not the whole button
    expect(areas).toHaveLength(1);
    expect(areas[0].x).toBeGreaterThan(button.width / 4);
    expect(areas[0].width).toBeLessThan(button.width * 0.75);
  }, 60_000);

  class Stubbed extends TextLocatorService {
    calls = 0;
    constructor(private readonly words: () => Promise<RecognisedWord[]>) {
      super(staticService);
      this.timeoutMs = 50;
    }
    protected ready(): Promise<unknown> {
      return Promise.resolve();
    }
    protected recognize(): Promise<RecognisedWord[]> {
      this.calls++;
      return this.words();
    }
  }

  it('times an element from when its recognition starts, not while it waits behind others', async () => {
    const slow = () => new Promise<RecognisedWord[]>((resolve) => setTimeout(() => resolve([]), 30));
    const locator = new Stubbed(slow);
    // three runs at once, 30 ms each against a 50 ms limit: the last waits 60 ms in the queue
    const runs = await Promise.all(
      [0, 1, 2].map((i) => locator.locate([candidate(`row${i}`, { x: 0, y: i, width: 10, height: 10 })], images))
    );
    expect(runs.map((found, i) => found.get(locatedKey('v', `row${i}`)))).toEqual(
      [0, 1, 2].map(() => ({ reason: 'not-found-current', missing: '1051' }))
    );
  });

  it('gives up on an element after five seconds', async () => {
    const locator = new Stubbed(() => new Promise(() => undefined));
    const found = await locator.locate([candidate()], images);
    expect(found.get(locatedKey('v', 'row'))).toEqual({ reason: 'timeout' });
  });

  it('looks in at most twenty elements of a screenshot', async () => {
    const locator = new Stubbed(async () => []);
    const many = Array.from({ length: MAX_LOCATED_ELEMENTS + 1 }, (_, i) =>
      candidate(`row${i}`, { x: 0, y: i, width: row.width, height: row.height - i })
    );
    const found = await locator.locate(many, images);
    // nothing recognised, so each is not found on the snapshot and the baseline is not looked at
    expect(locator.calls).toBe(MAX_LOCATED_ELEMENTS);
    expect(found.get(locatedKey('v', 'row0'))).toEqual({ reason: 'not-found-current', missing: '1051' });
    expect(found.get(locatedKey('v', `row${MAX_LOCATED_ELEMENTS}`))).toEqual({ reason: 'timeout' });
  });
});
