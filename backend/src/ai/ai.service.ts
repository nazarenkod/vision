import { createHash } from 'crypto';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import z from 'zod/v3';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../compare/libs/vlm/providers/gemini/gemini.service';
import { OllamaService } from '../compare/libs/vlm/providers/ollama/ollama.service';
import { VlmConfig } from '../compare/libs/vlm/vlm.types';

export type AiProviderName = 'gemini' | 'ollama' | 'none';

const DEFAULT_MODEL: Record<Exclude<AiProviderName, 'none'>, string> = {
  // the cheapest current Gemini tier; the alias follows Google's latest release
  gemini: 'gemini-flash-lite-latest',
  // ~3 GB, runs on an Apple Silicon Mac or a small GPU
  ollama: 'gemma3:4b',
};
const DEFAULT_DAILY_LIMIT = 500;

export interface AiStatus {
  enabled: boolean;
  provider: AiProviderName;
  model: string | null;
  dailyLimit: number;
  usedToday: number;
}

export interface AiAnswer<T> {
  result: T;
  cached: boolean;
  model: string;
}

/**
 * One way in to the instance's language model, with the rules that keep it
 * cheap: answers are cached by a hash of everything they depend on (asking the
 * same thing twice costs nothing), and paid calls are capped per day.
 * Configured per instance with AI_PROVIDER, AI_MODEL, GEMINI_API_KEY and
 * OLLAMA_BASE_URL; AI_PROVIDER=none (the default) turns it off.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private configService: ConfigService,
    private prismaService: PrismaService,
    private geminiService: GeminiService,
    private ollamaService: OllamaService
  ) {}

  private get provider(): AiProviderName {
    const value = (this.configService.get<string>('AI_PROVIDER') ?? 'none').toLowerCase();
    if (value === 'gemini' && this.configService.get<string>('GEMINI_API_KEY')) return 'gemini';
    if (value === 'ollama' && this.configService.get<string>('OLLAMA_BASE_URL')) return 'ollama';
    return 'none';
  }

  private get model(): string | null {
    const provider = this.provider;
    return provider === 'none' ? null : this.configService.get<string>('AI_MODEL') || DEFAULT_MODEL[provider];
  }

  private get dailyLimit(): number {
    return Number(this.configService.get<string>('AI_DAILY_CALL_LIMIT')) || DEFAULT_DAILY_LIMIT;
  }

  private async usedToday(): Promise<number> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    return this.prismaService.aiResult.count({ where: { createdAt: { gte: since } } });
  }

  async status(): Promise<AiStatus> {
    return {
      enabled: this.provider !== 'none',
      provider: this.provider,
      model: this.model,
      dailyLimit: this.dailyLimit,
      usedToday: this.provider === 'none' ? 0 : await this.usedToday(),
    };
  }

  /**
   * Asks the model for a JSON answer that follows `schema`. `cacheParts` must
   * capture everything the answer depends on besides the prompt and images
   * (which are hashed too).
   */
  async generateJson<T>(input: {
    kind: string;
    schema: z.ZodType<T>;
    prompt: string;
    images?: Buffer[];
    cacheParts?: unknown;
  }): Promise<AiAnswer<T>> {
    const provider = this.provider;
    const model = this.model;
    if (provider === 'none' || !model) {
      throw new HttpException('AI is not configured on this instance', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const digest = createHash('sha256').update(`${input.kind}|${provider}|${model}|${input.prompt}`);
    digest.update(JSON.stringify(input.cacheParts ?? null));
    for (const image of input.images ?? []) digest.update(image);
    const cacheKey = digest.digest('hex');

    const cached = await this.prismaService.aiResult.findUnique({ where: { cacheKey } });
    if (cached) {
      return { result: input.schema.parse(JSON.parse(cached.payload)), cached: true, model: cached.model ?? model };
    }
    if ((await this.usedToday()) >= this.dailyLimit) {
      throw new HttpException(`Daily AI limit of ${this.dailyLimit} calls reached`, HttpStatus.TOO_MANY_REQUESTS);
    }

    const config: VlmConfig =
      provider === 'gemini'
        ? {
            provider: 'gemini',
            model,
            apiKey: this.configService.get<string>('GEMINI_API_KEY'),
            prompt: input.prompt,
            temperature: 0.1,
          }
        : { provider: 'ollama', model, prompt: input.prompt, temperature: 0.1 };
    const service = provider === 'gemini' ? this.geminiService : this.ollamaService;
    const response = await service.generate(
      config,
      (input.images ?? []).map((image) => new Uint8Array(image)),
      { schema: zodToJsonSchema(input.schema) }
    );
    const text = (response.content || response.thinking || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    let result: T;
    try {
      result = input.schema.parse(JSON.parse(text));
    } catch (error) {
      this.logger.warn(`AI answer for ${input.kind} did not match the schema: ${text.slice(0, 200)}`);
      throw new HttpException('The AI model returned an unusable answer, try again', HttpStatus.BAD_GATEWAY);
    }

    await this.prismaService.aiResult
      .create({ data: { kind: input.kind, cacheKey, payload: JSON.stringify(result), model } })
      .catch(() => undefined); // a parallel request stored the same answer first
    return { result, cached: false, model };
  }
}
