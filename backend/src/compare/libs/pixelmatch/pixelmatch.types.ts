export interface PixelmatchConfig {
  allowDiffDimensions?: boolean;
  ignoreAntialiasing: boolean;
  threshold: number;
}

/**
 * pixelmatch's `includeAA: true` means "count anti-aliased pixels as changes",
 * the opposite of the project setting, which asks for them to be ignored.
 * Passing the setting straight through (as the code inherited from VRT did)
 * made the default flag edge noise as differences. Every place that hands the
 * setting to pixelmatch, or stamps a signature with it, goes through here.
 */
export function includeAAFor(config: Pick<PixelmatchConfig, 'ignoreAntialiasing'>): boolean {
  return !config.ignoreAntialiasing;
}
