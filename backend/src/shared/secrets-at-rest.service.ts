import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HASHED_API_KEY_PREFIX, hashApiKey } from './api-key-hash';
import { newRandomKey } from './random-key';
import { encryptSecret, serverSecretKey } from './secret-box';

const SEALED = 'enc:v1:';

type Prisma = Pick<PrismaService, 'user' | 'project'>;

export interface SealedAtRest {
  tokens: number;
  geminiKeys: number;
  projectKeys: number;
  apiKeys: number;
}

/**
 * What an older version or a copy of VRT left readable in the database (044): Jira tokens and
 * Gemini keys get sealed, so nobody enters them again; API keys stored as they are become hashes of
 * keys nobody knows, so a key that leaked from VRT opens nothing here. The formats tell what is
 * done, so a second start changes nothing and a fresh copy from VRT is cleaned again.
 */
export async function sealSecretsAtRest(prisma: Prisma, key: Buffer): Promise<SealedAtRest> {
  const plain = (column: 'jiraToken' | 'geminiApiKey') => ({
    [column]: { not: null },
    NOT: [{ [column]: '' }, { [column]: { startsWith: SEALED } }],
  });

  const withToken = await prisma.user.findMany({ where: plain('jiraToken'), select: { id: true, jiraToken: true } });
  for (const user of withToken) {
    await prisma.user.update({ where: { id: user.id }, data: { jiraToken: encryptSecret(user.jiraToken, key) } });
  }

  const withGemini = await prisma.user.findMany({
    where: plain('geminiApiKey'),
    select: { id: true, geminiApiKey: true },
  });
  for (const user of withGemini) {
    await prisma.user.update({
      where: { id: user.id },
      data: { geminiApiKey: encryptSecret(user.geminiApiKey, key) },
    });
  }

  const projects = await prisma.project.findMany({
    where: { imageComparisonConfig: { contains: '"apiKey"' } },
    select: { id: true, imageComparisonConfig: true },
  });
  let projectKeys = 0;
  for (const project of projects) {
    const config = parseObject(project.imageComparisonConfig);
    if (typeof config?.apiKey !== 'string' || !config.apiKey || config.apiKey.startsWith(SEALED)) continue;
    await prisma.project.update({
      where: { id: project.id },
      data: { imageComparisonConfig: JSON.stringify({ ...config, apiKey: encryptSecret(config.apiKey, key) }) },
    });
    projectKeys++;
  }

  const readableKeys = await prisma.user.findMany({
    where: { NOT: { apiKey: { startsWith: HASHED_API_KEY_PREFIX } } },
    select: { id: true },
  });
  for (const user of readableKeys) {
    await prisma.user.update({
      where: { id: user.id },
      data: { apiKey: hashApiKey(newRandomKey()), apiKeyEnding: null },
    });
  }

  return {
    tokens: withToken.length,
    geminiKeys: withGemini.length,
    projectKeys,
    apiKeys: readableKeys.length,
  };
}

function parseObject(json: string | null): Record<string, unknown> | null {
  try {
    const value = json ? JSON.parse(json) : null;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Runs before the API takes requests: Nest waits for it, and a failure stops the start, so no
 * readable secret outlives the first start of this version.
 */
@Injectable()
export class SecretsAtRestService implements OnModuleInit {
  private readonly logger = new Logger(SecretsAtRestService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const done = await sealSecretsAtRest(this.prismaService, serverSecretKey());
    if (done.tokens + done.geminiKeys + done.projectKeys + done.apiKeys) {
      this.logger.log(
        `Sealed ${done.tokens} Jira token(s), ${done.geminiKeys} personal and ${done.projectKeys} project Gemini key(s); ` +
          `${done.apiKeys} API key(s) stored readable no longer work, people make new ones in the profile`
      );
    }
  }
}
