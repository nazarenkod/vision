/**
 * Password guessing (045): five failed sign-ins for one email within 15 minutes close it for the
 * next 15, whatever password comes then. An email nobody has counts the same, so a refusal says
 * nothing about who exists. The SDK and the CLI sign with API keys and never pass here.
 *
 * Kept in the memory of the one API process Vision runs: a restart starts the count again.
 */
export const MAX_FAILED_SIGN_INS = 5;
export const SIGN_IN_WINDOW_MS = 15 * 60 * 1000;

export class SignInLimit {
  private readonly failures = new Map<string, number[]>();
  private readonly closedUntil = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  private key = (email: string) => (email ?? '').trim().toLowerCase();

  /** Until when the email is closed, or null when it may try. */
  closed(email: string): number | null {
    const until = this.closedUntil.get(this.key(email));
    if (until === undefined) return null;
    if (until > this.now()) return until;
    this.closedUntil.delete(this.key(email));
    return null;
  }

  failed(email: string): void {
    const key = this.key(email);
    const since = this.now() - SIGN_IN_WINDOW_MS;
    const recent = [...(this.failures.get(key) ?? []).filter((at) => at > since), this.now()];
    if (recent.length >= MAX_FAILED_SIGN_INS) {
      this.closedUntil.set(key, this.now() + SIGN_IN_WINDOW_MS);
      this.failures.delete(key);
    } else {
      this.failures.set(key, recent);
    }
    this.forgetOld();
  }

  succeeded(email: string): void {
    this.failures.delete(this.key(email));
  }

  // a flood of made-up emails must not grow the maps for ever
  private forgetOld(): void {
    if (this.failures.size < 10000) return;
    const since = this.now() - SIGN_IN_WINDOW_MS;
    for (const [key, times] of this.failures) if (!times.some((at) => at > since)) this.failures.delete(key);
  }
}
