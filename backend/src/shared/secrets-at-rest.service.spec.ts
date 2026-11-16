import { hashApiKey, isHashedApiKey } from './api-key-hash';
import { sealSecretsAtRest } from './secrets-at-rest.service';
import { decryptSecret, encryptSecret, secretKeyFrom } from './secret-box';

type Row = Record<string, unknown>;

// the few Prisma filters the service uses, over rows in memory, so a second start can be checked
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([field, condition]) => {
    if (field === 'NOT') return [condition].flat().every((part) => !matches(row, part as Row));
    const value = row[field] as string | null;
    if (condition === null || typeof condition !== 'object') return value === condition;
    const { not, startsWith, contains } = condition as Row;
    if ('not' in (condition as Row) && value === not) return false;
    if (startsWith !== undefined && !(value ?? '').startsWith(startsWith as string)) return false;
    if (contains !== undefined && !(value ?? '').includes(contains as string)) return false;
    return true;
  });
}

function table(rows: Row[]) {
  return {
    rows,
    findMany: jest.fn(async ({ where }: { where: Row }) => rows.filter((row) => matches(row, where))),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Row }) =>
      Object.assign(
        rows.find((row) => row.id === where.id),
        data
      )
    ),
  };
}

const key = secretKeyFrom('at-rest-test-key');

function database() {
  const users = table([
    { id: 'u1', jiraToken: 'jira-plain', geminiApiKey: 'AIza-plain', apiKey: 'VRTKEY1', apiKeyEnding: null },
    {
      id: 'u2',
      jiraToken: encryptSecret('already', key),
      geminiApiKey: null,
      apiKey: hashApiKey('mine'),
      apiKeyEnding: 'mine',
    },
    { id: 'u3', jiraToken: '', geminiApiKey: '', apiKey: 'VRTKEY3', apiKeyEnding: null },
  ]);
  const projects = table([
    { id: 'p1', imageComparisonConfig: JSON.stringify({ provider: 'gemini', apiKey: 'AIza-project' }) },
    { id: 'p2', imageComparisonConfig: JSON.stringify({ threshold: 0.1 }) },
  ]);
  return { users, projects, prisma: { user: users, project: projects } as never };
}

describe('sealSecretsAtRest', () => {
  it('encrypts the plain Jira tokens and Gemini keys once', async () => {
    const { users, projects, prisma } = database();

    expect(await sealSecretsAtRest(prisma, key)).toMatchObject({ tokens: 1, geminiKeys: 1, projectKeys: 1 });

    const [first, second] = users.rows;
    expect(JSON.stringify(users.rows) + JSON.stringify(projects.rows)).not.toMatch(
      /jira-plain|AIza-plain|AIza-project/
    );
    expect(decryptSecret(first.jiraToken as string, key)).toBe('jira-plain');
    expect(decryptSecret(first.geminiApiKey as string, key)).toBe('AIza-plain');
    expect(decryptSecret(second.jiraToken as string, key)).toBe('already');
    const config = JSON.parse(projects.rows[0].imageComparisonConfig as string);
    expect(decryptSecret(config.apiKey, key)).toBe('AIza-project');
    expect(projects.rows[1].imageComparisonConfig).toBe(JSON.stringify({ threshold: 0.1 }));

    users.update.mockClear();
    projects.update.mockClear();
    expect(await sealSecretsAtRest(prisma, key)).toEqual({ tokens: 0, geminiKeys: 0, projectKeys: 0, apiKeys: 0 });
    expect(users.update).not.toHaveBeenCalled();
    expect(projects.update).not.toHaveBeenCalled();
  });

  it('makes every plain API key useless once', async () => {
    const { users, prisma } = database();

    expect((await sealSecretsAtRest(prisma, key)).apiKeys).toBe(2);

    const [first, second, third] = users.rows;
    expect(isHashedApiKey(first.apiKey as string)).toBe(true);
    expect(isHashedApiKey(third.apiKey as string)).toBe(true);
    // the old key opens nothing: a request with it is looked up by its hash
    expect([first.apiKey, third.apiKey]).not.toContain(hashApiKey('VRTKEY1'));
    expect([first.apiKey, third.apiKey]).not.toContain(hashApiKey('VRTKEY3'));
    expect(first.apiKeyEnding).toBeNull();
    // a key made in Vision stays as it is
    expect(second).toMatchObject({ apiKey: hashApiKey('mine'), apiKeyEnding: 'mine' });

    const annulled = first.apiKey;
    expect((await sealSecretsAtRest(prisma, key)).apiKeys).toBe(0);
    expect(first.apiKey).toBe(annulled);
  });
});
