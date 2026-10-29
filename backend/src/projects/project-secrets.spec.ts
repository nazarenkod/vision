import { hideConfigSecrets, keepConfigSecrets } from './project-secrets';

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
    expect(JSON.parse(keepConfigSecrets(gemini(), stored) as string).apiKey).toBe('old');
    expect(JSON.parse(keepConfigSecrets(gemini({ apiKey: 'new' }), stored) as string).apiKey).toBe('new');
    expect(JSON.parse(keepConfigSecrets(gemini({ apiKey: '' }), stored) as string)).not.toHaveProperty('apiKey');
    // another engine's settings do not inherit the key
    expect(keepConfigSecrets(JSON.stringify({ threshold: 0.1 }), stored)).toBe(JSON.stringify({ threshold: 0.1 }));
  });
});
