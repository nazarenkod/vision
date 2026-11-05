import { SIGN_IN_WINDOW_MS, SignInLimit } from './sign-in-limit';

describe('SignInLimit', () => {
  it('refuses an email for 15 minutes after 5 failed attempts', () => {
    let now = 0;
    const limit = new SignInLimit(() => now);
    for (let i = 0; i < 4; i++) limit.failed('QA@bank.test');
    expect(limit.closed('qa@bank.test')).toBeNull();

    limit.failed(' qa@bank.test ');
    expect(limit.closed('qa@bank.test')).toBe(SIGN_IN_WINDOW_MS);
    // another email is not touched
    expect(limit.closed('lead@bank.test')).toBeNull();

    now = SIGN_IN_WINDOW_MS - 1;
    expect(limit.closed('qa@bank.test')).not.toBeNull();
    now = SIGN_IN_WINDOW_MS;
    expect(limit.closed('qa@bank.test')).toBeNull();
  });

  it('counts only the last 15 minutes and forgets after a success', () => {
    let now = 0;
    const limit = new SignInLimit(() => now);
    for (let i = 0; i < 4; i++) limit.failed('qa@bank.test');
    now = SIGN_IN_WINDOW_MS + 1;
    limit.failed('qa@bank.test');
    expect(limit.closed('qa@bank.test')).toBeNull();

    for (let i = 0; i < 3; i++) limit.failed('qa@bank.test');
    limit.succeeded('qa@bank.test');
    limit.failed('qa@bank.test');
    expect(limit.closed('qa@bank.test')).toBeNull();
  });
});
