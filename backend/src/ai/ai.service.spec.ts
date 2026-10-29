import z from 'zod/v3';
import { PNG } from 'pngjs';
import { AiService } from './ai.service';
import { AiFeaturesService } from './ai-features.service';
import { cropPng } from './image-crop';

const schema = z.object({ answer: z.string() }) as unknown as z.ZodType<{ answer: string }>;

function setup(env: Record<string, string>, stored: Record<string, string> = {}, usedToday = 0) {
  const configService = { get: (key: string) => env[key] };
  const prismaService = {
    aiResult: {
      findUnique: jest.fn(async ({ where }) =>
        stored[where.cacheKey] ? { payload: stored[where.cacheKey], model: 'm' } : null
      ),
      count: jest.fn().mockResolvedValue(usedToday),
      create: jest.fn(async ({ data }) => {
        stored[data.cacheKey] = data.payload;
        return data;
      }),
    },
  };
  const geminiService = { generate: jest.fn().mockResolvedValue({ content: '```json\n{"answer":"yes"}\n```' }) };
  const ollamaService = { generate: jest.fn().mockResolvedValue({ content: '{"answer":"local"}' }) };
  const service = new AiService(
    configService as never,
    prismaService as never,
    geminiService as never,
    ollamaService as never
  );
  return { service, geminiService, ollamaService, prismaService };
}

describe('AiService', () => {
  const gemini = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'key' };

  it('is off unless a provider and its credentials are set', async () => {
    expect((await setup({}).service.status()).enabled).toBe(false);
    expect((await setup({ AI_PROVIDER: 'gemini' }).service.status()).enabled).toBe(false);
    expect(await setup(gemini).service.status()).toMatchObject({
      enabled: true,
      provider: 'gemini',
      model: 'gemini-flash-lite-latest',
    });
    await expect(setup({}).service.generateJson({ kind: 'k', schema, prompt: 'p' })).rejects.toThrow(
      'AI is not configured'
    );
  });

  it('calls the model once and serves the same question from the cache', async () => {
    const { service, geminiService } = setup(gemini);

    const first = await service.generateJson({ kind: 'k', schema, prompt: 'p', images: [Buffer.from([1])] });
    const second = await service.generateJson({ kind: 'k', schema, prompt: 'p', images: [Buffer.from([1])] });

    expect(first).toEqual({ result: { answer: 'yes' }, cached: false, model: 'gemini-flash-lite-latest' });
    expect(second.cached).toBe(true);
    expect(geminiService.generate).toHaveBeenCalledTimes(1);
    const [config, images, options] = geminiService.generate.mock.calls[0];
    expect(config).toMatchObject({ provider: 'gemini', apiKey: 'key', prompt: 'p' });
    expect(images).toHaveLength(1);
    expect(options.schema).toMatchObject({ type: 'object' });
  });

  it('asks again when the images differ', async () => {
    const { service, geminiService } = setup(gemini);
    await service.generateJson({ kind: 'k', schema, prompt: 'p', images: [Buffer.from([1])] });
    await service.generateJson({ kind: 'k', schema, prompt: 'p', images: [Buffer.from([2])] });
    expect(geminiService.generate).toHaveBeenCalledTimes(2);
  });

  it('stops paid calls at the daily limit', async () => {
    const { service } = setup({ ...gemini, AI_DAILY_CALL_LIMIT: '10' }, {}, 10);
    await expect(service.generateJson({ kind: 'k', schema, prompt: 'p' })).rejects.toThrow('Daily AI limit');
  });

  it('uses a local Ollama model when configured', async () => {
    const { service, ollamaService } = setup({ AI_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://x' });
    expect((await service.generateJson({ kind: 'k', schema, prompt: 'p' })).result).toEqual({ answer: 'local' });
    expect(ollamaService.generate.mock.calls[0][0]).toMatchObject({ provider: 'ollama', model: 'gemma3:4b' });
  });
});

describe('AiFeaturesService', () => {
  const group = (overrides = {}) => ({
    id: 'g1',
    kind: 'structural',
    title: 'Button "Send"',
    screens: ['Payment', 'Transfer'],
    testRuns: [{ id: 'a' }, { id: 'b' }],
    changes: [{ kind: 'text', element: 'Button "Send" (id/btn_pay)', before: 'Pay', after: 'Send' }],
    noise: null,
    fingerprint: 'struct:abc',
    ...overrides,
  });

  function features(groups: unknown[], aiAnswer: unknown = { summary: 's', verdict: 'intended', confidence: 0.8 }) {
    const aiService = { generateJson: jest.fn().mockResolvedValue({ result: aiAnswer, cached: false, model: 'm' }) };
    const service = new AiFeaturesService(
      aiService as never,
      { testRun: { findUnique: jest.fn() } } as never,
      {} as never,
      { getGroups: jest.fn().mockResolvedValue(groups) } as never,
      {} as never,
      {} as never
    );
    return { service, aiService };
  }

  it('answers noise groups from the rules without calling the model', async () => {
    const { service, aiService } = features([
      group({ noise: { kind: 'status-bar', message: 'Only the status bar changed.' } }),
    ]);
    expect(await service.summarizeGroup('b', 'g1')).toMatchObject({ verdict: 'noise', source: 'rules' });
    expect(aiService.generateJson).not.toHaveBeenCalled();
  });

  it('describes structural groups from text alone, keyed by the change', async () => {
    const { service, aiService } = features([group()]);

    const summary = await service.summarizeGroup('b', 'g1');

    expect(summary).toMatchObject({ summary: 's', verdict: 'intended', source: 'ai' });
    const request = aiService.generateJson.mock.calls[0][0];
    expect(request.images).toBeUndefined();
    expect(request.cacheParts).toBe('struct:abc');
    expect(request.prompt).toContain('- text: Button "Send" (id/btn_pay): "Pay" → "Send"');
    expect(request.prompt).toContain('2 screenshots (screens: Payment, Transfer)');
  });

  it('refuses unknown groups and new screenshots', async () => {
    await expect(features([]).service.summarizeGroup('b', 'nope')).rejects.toThrow('Change group not found');
    await expect(features([group({ kind: 'new' })]).service.summarizeGroup('b', 'g1')).rejects.toThrow(
      'no change to describe'
    );
  });
});

describe('cropPng', () => {
  it('crops with padding and shrinks to the size limit', () => {
    const image = new PNG({ width: 1000, height: 1000 });
    const crop = PNG.sync.read(
      cropPng(image, { x: 100, y: 100, width: 600, height: 300 }, { padding: 50, maxSide: 350 })
    );
    expect([crop.width, crop.height]).toEqual([350, 200]);
  });
});

describe('AiFeaturesService: bug drafts', () => {
  const draft = { essence: 'кнопка обрізана', steps: ['Відкрити Checkout'], actual: 'Обрізана.', expected: 'Видна.' };
  const run = {
    id: 'run',
    name: 'Checkout. Payment sheet',
    featureName: null,
    imageName: 'i',
    baselineName: 'b',
    diffRegions: null,
  };

  function drafts(
    env: Record<string, string>,
    options: { key?: string | null; usedToday?: number; generate?: jest.Mock } = {}
  ) {
    const { service: aiService, geminiService, ollamaService } = setup(env, {}, options.usedToday ?? 0);
    if (options.generate) geminiService.generate = options.generate;
    else geminiService.generate.mockResolvedValue({ content: JSON.stringify(draft) });
    const image = new PNG({ width: 100, height: 200 });
    const key = options.key === undefined ? 'personal-key' : options.key;
    const service = new AiFeaturesService(
      aiService,
      {
        testRun: { findUnique: jest.fn().mockResolvedValue(run) },
        user: { findUnique: jest.fn().mockResolvedValue({ geminiApiKey: key }) },
      } as never,
      { getImage: jest.fn().mockResolvedValue(image) } as never,
      {} as never,
      {} as never,
      {} as never
    );
    return { service, geminiService, ollamaService };
  }
  const request = {
    testRunId: 'run',
    note: 'кнопка оплати обрізана',
    marks: [{ x: 0, y: 150, width: 100, height: 40 }],
  };

  it('refuses a bug draft without the person’s own Gemini key', async () => {
    const { service, geminiService } = drafts({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'instance' }, { key: null });
    await expect(service.draftBug(request, 'u1')).rejects.toThrow('Add your Gemini API key');
    expect(geminiService.generate).not.toHaveBeenCalled();
  });

  it('drafts on the person’s own key whatever the instance runs, outside its daily limit', async () => {
    const { service, geminiService, ollamaService } = drafts(
      { AI_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://ollama' },
      { usedToday: 9999 }
    );
    await service.draftBug(request, 'u1');
    expect(ollamaService.generate).not.toHaveBeenCalled();
    expect(geminiService.generate.mock.calls[0][0]).toMatchObject({ provider: 'gemini', apiKey: 'personal-key' });
  });

  it('asks again instead of answering from the cache on a new attempt', async () => {
    const { service, geminiService } = drafts({});

    const first = await service.draftBug({ ...request, attempt: 1 }, 'u1');
    await service.draftBug({ ...request, attempt: 1 }, 'u1');
    await service.draftBug({ ...request, attempt: 2 }, 'u1');

    expect(first).toEqual({
      essence: 'кнопка обрізана',
      steps: '1. Відкрити Checkout',
      actual: 'Обрізана.',
      expected: 'Видна.',
      cached: false,
    });
    expect(geminiService.generate).toHaveBeenCalledTimes(2);
    // a baseline and a checkpoint crop of the one mark, not the whole screenshots
    const images = geminiService.generate.mock.calls[0][1];
    expect(images).toHaveLength(2);
  });

  it('gives up on a bug draft after 30 seconds', async () => {
    jest.useFakeTimers();
    try {
      const { service } = drafts({}, { generate: jest.fn(() => new Promise(() => undefined)) });
      const answer = service.draftBug(request, 'u1');
      const settled = expect(answer).rejects.toThrow('did not answer in 30 s');
      await jest.advanceTimersByTimeAsync(30_000);
      await settled;
    } finally {
      jest.useRealTimers();
    }
  });
});
