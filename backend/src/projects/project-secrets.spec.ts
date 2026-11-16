import { hideConfigSecrets, keepConfigSecrets, openConfigSecrets } from './project-secrets';

const seal = (plain: string) => `enc:v1:${plain}`;

const gemini = (extra: object = {}) => JSON.stringify({ provider: 'gemini', model: 'gemini-2.5-flash', ...extra });

describe('comparison settings secrets', () => {
  it('never sends the Gemini key back, only that one is saved', () => {
    const shown = hideConfigSecrets(gemini({ apiKey: 'AIza-secret' }));
    expect(shown.apiKeySet).toBe(true);
    expect(shown.config).not.toContain('AIza-secret');
    expect(JSON.parse(shown.config as string)).toEqual({ provider: 'gemini', model: 'gemini-2.5-flash' });
    expect(hideConfigSecrets(JSON.stringify({ threshold: 0.1 }))).toEqual({
      config: JSON.stringify({ threshold: 0.1 }),
      apiKeySet: false,
    });
    expect(hideConfigSecrets(null)).toEqual({ config: null, apiKeySet: false });
  });

  it('keeps, replaces or removes the stored key on save', () => {
    const stored = gemini({ apiKey: 'old' });
    expect(JSON.parse(keepConfigSecrets(gemini(), stored, seal) as string).apiKey).toBe('old');
    expect(JSON.parse(keepConfigSecrets(gemini({ apiKey: 'new' }), stored, seal) as string).apiKey).toBe('enc:v1:new');
    expect(JSON.parse(keepConfigSecrets(gemini({ apiKey: '' }), stored, seal) as string)).not.toHaveProperty('apiKey');
    // another engine's settings do not inherit the key
    expect(keepConfigSecrets(JSON.stringify({ threshold: 0.1 }), stored, seal)).toBe(
      JSON.stringify({ threshold: 0.1 })
    );
  });

  it('seals a new key once and opens it only for the comparison', () => {
    const saved = keepConfigSecrets(gemini({ apiKey: 'AIza-new' }), null, seal) as string;
    expect(saved).not.toContain('"AIza-new"');
    // a sealed key sent back as it is stays sealed once
    expect(keepConfigSecrets(saved, null, seal)).toBe(saved);
    const open = (stored: string) => stored.replace('enc:v1:', '');
    expect(JSON.parse(openConfigSecrets(saved, open)).apiKey).toBe('AIza-new');
    expect(JSON.parse(openConfigSecrets(saved, () => null)).apiKey).toBe('');
  });
});
