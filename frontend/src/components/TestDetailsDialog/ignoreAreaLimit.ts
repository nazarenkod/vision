// The server takes at most this many ignore areas on a screen (spec 051, MAX_IGNORE_AREAS in
// backend/src/test-runs/dto/ignore-area.dto.ts): saving more would only bring its refusal.
export const MAX_IGNORE_AREAS = 20;

/** How many areas are over the limit, or null when they can be saved. */
export function ignoreAreasOverLimit(count: number): number | null {
  return count > MAX_IGNORE_AREAS ? count - MAX_IGNORE_AREAS : null;
}
