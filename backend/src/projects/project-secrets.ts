// The Gemini API key lives inside the comparison settings JSON. Like the Jira
// token, it is written but never read back (rule 7, REQ-018-50): the API
// returns the settings without it and says only whether one is saved.

const parse = (json: string | null | undefined): Record<string, unknown> | null => {
  if (!json) return null;
  try {
    const value = JSON.parse(json);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

/** The settings to show, and whether a key is stored. */
export function hideConfigSecrets(json: string | null | undefined): { config: string | null; apiKeySet: boolean } {
  const config = parse(json);
  if (!config || !('apiKey' in config)) return { config: json ?? null, apiKeySet: false };
  const { apiKey, ...rest } = config;
  return { config: JSON.stringify(rest), apiKeySet: !!apiKey };
}

/**
 * The settings to store: a key left out keeps the stored one, an empty key
 * removes it, any other key replaces it.
 */
export function keepConfigSecrets(
  incoming: string | null | undefined,
  stored: string | null | undefined
): string | null | undefined {
  const next = parse(incoming);
  if (!next) return incoming;
  if ('apiKey' in next) {
    if (next.apiKey === '') delete next.apiKey;
    return JSON.stringify(next);
  }
  const before = parse(stored);
  if (before?.apiKey && next.provider === before.provider) next.apiKey = before.apiKey;
  return JSON.stringify(next);
}
