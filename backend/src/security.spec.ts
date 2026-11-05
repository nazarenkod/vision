import { allowOwnInterface, corsOriginOf, SECURITY_HEADERS, securityHeaders, swaggerEnabled } from './security';

describe('the API towards browsers', () => {
  it("answers browsers of Vision's own interface only", () => {
    expect(corsOriginOf({ APP_FRONTEND_URL: 'https://vision.bank.test/some/page' })).toBe('https://vision.bank.test');
    expect(corsOriginOf({})).toBe(false);
    expect(corsOriginOf({ APP_FRONTEND_URL: 'not a url' })).toBe(false);

    const before = process.env.APP_FRONTEND_URL;
    process.env.APP_FRONTEND_URL = 'http://vision.bank.test:18080';
    try {
      const decide = (origin?: string) => {
        let allowed: boolean | undefined;
        allowOwnInterface(origin, (_error, allow) => (allowed = allow));
        return allowed;
      };
      expect(decide('http://vision.bank.test:18080')).toBe(true);
      expect(decide('https://evil.example')).toBe(false);
      expect(decide('http://vision.bank.test:9999')).toBe(false);
      expect(decide(undefined)).toBe(false);
    } finally {
      process.env.APP_FRONTEND_URL = before;
    }
  });

  it('keeps the API documentation off until it is turned on', () => {
    expect(swaggerEnabled({})).toBe(false);
    expect(swaggerEnabled({ VISION_SWAGGER: 'false' })).toBe(false);
    expect(swaggerEnabled({ VISION_SWAGGER: 'TRUE' })).toBe(true);
  });

  it('sends the standard security headers', () => {
    const response = { set: jest.fn(), removeHeader: jest.fn() };
    const next = jest.fn();
    securityHeaders({} as never, response as never, next);
    expect(response.set).toHaveBeenCalledWith(SECURITY_HEADERS);
    expect(SECURITY_HEADERS).toMatchObject({ 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff' });
    expect(response.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    expect(next).toHaveBeenCalled();
  });
});
