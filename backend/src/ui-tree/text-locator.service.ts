import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PNG } from 'pngjs';
import { createWorker, OEM, Worker } from 'tesseract.js';
import { StaticService } from '../static/static.service';
import { LocateCandidate, Located, locatedKey } from './comparison-inputs';
import { cropPng, placeAreas, RecognisedWord, shrinkMask, textMask } from './text-locate';
import { Rect } from './ui-tree.types';

// how long the marked pieces of one element may be looked for, both screenshots together (REQ-071-07)
export const LOCATE_TIMEOUT_MS = 5000;
// how many elements of one screenshot are looked in (REQ-071-08)
export const MAX_LOCATED_ELEMENTS = 20;
// screenshots never change under a name, so what was found stays true; a reopened run need not look again
const CACHE_SIZE = 500;
// widest picture recognition gets: a 1440 px row is halved, its text still ~20 px tall, read 3× sooner
const MAX_WIDTH = 720;

const LANGUAGES = ['ukr', 'eng'];

/**
 * One folder with the models of both languages, as the worker reads them: the
 * npm packages keep each in its own. Copied from node_modules, never fetched (ADR-0031).
 */
function modelsDir(): string {
  const dir = path.join(tmpdir(), 'vision-ocr-models');
  mkdirSync(dir, { recursive: true });
  for (const code of LANGUAGES) {
    const target = path.join(dir, `${code}.traineddata.gz`);
    if (!existsSync(target)) {
      copyFileSync(require.resolve(`@tesseract.js-data/${code}/4.0.0_best_int/${code}.traineddata.gz`), target);
    }
  }
  return dir;
}

type SideResult = { areas: Rect[] } | { missing: string };

class TimedOut extends Error {}

/**
 * Finds on the screenshots where the marked places of a variable text are drawn,
 * for elements whose text the UI tree does not lay out (spec 071, ADR-0031).
 * One recognition worker, made when first needed, with the language models
 * read from node_modules: nothing goes to the network. Elements go one at a time.
 */
@Injectable()
export class TextLocatorService implements OnModuleDestroy {
  private readonly logger = new Logger(TextLocatorService.name);
  private worker: Promise<Worker> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly cache = new Map<string, SideResult>();
  protected timeoutMs = LOCATE_TIMEOUT_MS;

  constructor(private readonly staticService: StaticService) {}

  async onModuleDestroy(): Promise<void> {
    await this.stopWorker();
  }

  /** Where the pieces of each candidate are on both screenshots, or why the whole element stays out. */
  async locate(
    candidates: LocateCandidate[],
    images: { current: string; baseline: string }
  ): Promise<Map<string, Located>> {
    const result = new Map<string, Located>();
    const pictures = new Map<string, Promise<PNG>>();
    const picture = (name: string) => {
      if (!pictures.has(name)) pictures.set(name, this.staticService.getImage(name));
      return pictures.get(name);
    };
    for (const [n, candidate] of candidates.entries()) {
      const key = locatedKey(candidate.ruleId, candidate.key);
      if (n >= MAX_LOCATED_ELEMENTS) {
        result.set(key, { reason: 'timeout' });
        continue;
      }
      // the time spent recognising both screenshots of this element, not waiting for others
      const budget = { left: this.timeoutMs };
      try {
        const now = await this.side(images.current, candidate.current, picture, budget);
        if ('missing' in now) {
          result.set(key, { reason: 'not-found-current', missing: now.missing });
          continue;
        }
        const then = await this.side(images.baseline, candidate.baseline, picture, budget);
        result.set(
          key,
          'missing' in then
            ? { reason: 'not-found-baseline', missing: then.missing }
            : { current: now.areas, baseline: then.areas }
        );
      } catch (error) {
        if (!(error instanceof TimedOut)) this.logger.warn(`Could not look for variable text: ${error}`);
        result.set(key, { reason: 'timeout' });
      }
    }
    return result;
  }

  private async side(
    imageName: string,
    element: LocateCandidate['current'],
    picture: (name: string) => Promise<PNG>,
    budget: { left: number }
  ): Promise<SideResult> {
    const { bounds } = element;
    const cacheKey = JSON.stringify([imageName, bounds, element.text, element.places]);
    const known = this.cache.get(cacheKey);
    if (known) return known;
    if (budget.left <= 0) throw new TimedOut();
    const crop = cropPng(await picture(imageName), bounds);
    // a phone screenshot's text is far taller than recognition needs: smaller reads as well, much sooner
    const scale = Math.min(1, MAX_WIDTH / crop.width);
    const mask = shrinkMask(textMask(crop), scale);
    // a mask of black and white needs no compression; deflating it took longer than reading it
    const { words, ms } = await this.run(PNG.sync.write(mask, { deflateLevel: 0, filterType: 0 }), budget.left);
    budget.left -= ms;
    const back = (value: number) => Math.round(value / scale);
    const found = placeAreas(
      element.text,
      element.places,
      words.map((word) => ({
        text: word.text,
        bbox: {
          x0: back(word.bbox.x0) + bounds.x,
          y0: back(word.bbox.y0) + bounds.y,
          x1: back(word.bbox.x1) + bounds.x,
          y1: back(word.bbox.y1) + bounds.y,
        },
      }))
    );
    if (this.cache.size >= CACHE_SIZE) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(cacheKey, found);
    return found;
  }

  /**
   * One recognition at a time, timed from when it starts: waiting behind the
   * other runs of a build, or for the worker to start, is not this element's time.
   */
  private run(png: Buffer, limitMs: number): Promise<{ words: RecognisedWord[]; ms: number }> {
    const job = this.queue.then(async () => {
      await this.ready();
      const started = Date.now();
      const words = await this.inTime(this.recognize(png), started + limitMs);
      return { words, ms: Date.now() - started };
    });
    this.queue = job.catch(() => undefined);
    return job;
  }

  private async inTime<T>(work: Promise<T>, deadline: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const late = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimedOut()), Math.max(0, deadline - Date.now()));
    });
    try {
      return await Promise.race([work, late]);
    } catch (error) {
      // a recognition that ran over cannot be stopped inside: the worker goes, the next one starts clean
      if (error instanceof TimedOut) await this.stopWorker();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /** The worker, started if it is not yet. */
  protected ready(): Promise<unknown> {
    return this.startWorker();
  }

  /** The words recognition finds in a picture, with their bounds in it. */
  protected async recognize(png: Buffer): Promise<RecognisedWord[]> {
    const worker = await this.startWorker();
    const { data } = await worker.recognize(png, {}, { blocks: true });
    return (data.blocks ?? []).flatMap((block) =>
      block.paragraphs.flatMap((paragraph) =>
        paragraph.lines.flatMap((line) => line.words.map(({ text, bbox }) => ({ text, bbox })))
      )
    );
  }

  private startWorker(): Promise<Worker> {
    if (!this.worker) {
      this.worker = createWorker(LANGUAGES.join('+'), OEM.LSTM_ONLY, {
        langPath: modelsDir(),
        // the models stay as shipped; nothing is unpacked next to the app
        cacheMethod: 'none',
      });
      this.worker.catch(() => (this.worker = null));
    }
    return this.worker;
  }

  private async stopWorker(): Promise<void> {
    const worker = this.worker;
    this.worker = null;
    this.queue = Promise.resolve();
    await (await worker?.catch(() => null))?.terminate();
  }
}
