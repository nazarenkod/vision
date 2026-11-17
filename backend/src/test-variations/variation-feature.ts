// The feature of a baseline (067): the test names it with every snapshot, and the
// baselines page groups by it. It is not part of the check's identity.

/**
 * The feature a baseline keeps after a snapshot: a name the test sent replaces
 * the stored one, and a snapshot without one (an older SDK, a test that does
 * not say) leaves the stored one in place.
 */
export function featureToKeep(stored: string | null | undefined, sent: string | null | undefined): string | null {
  return sent?.trim() || stored || null;
}
