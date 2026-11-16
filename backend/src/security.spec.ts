import {
  API_CONTENT_SECURITY_POLICY,
  cameOverHttps,
  HSTS,
  allowOwnInterface,
  corsOriginOf,
  SECURITY_HEADERS,
  securityHeaders,
  swaggerEnabled,
} from './security';

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

  describe('content security policy and HSTS (052)', () => {
    const respond = (request: Record<string, unknown>) => {
      const set = jest.fn();
      securityHeaders(request as never, { set, removeHeader: jest.fn() } as never, jest.fn());
      return Object.assign(
        {},
        ...set.mock.calls.map(([name, value]) => (typeof name === 'string' ? { [name]: value } : name))
      );
    };
    const swagger = process.env.VISION_SWAGGER;
    afterEach(() => {
      if (swagger === undefined) delete process.env.VISION_SWAGGER;
      else process.env.VISION_SWAGGER = swagger;
    });

    it('answers with a content security policy', () => {
      expect(respond({ path: '/projects', headers: {} })['Content-Security-Policy']).toBe(API_CONTENT_SECURITY_POLICY);
      // the documentation is a page with scripts of its own, when it is on
      process.env.VISION_SWAGGER = 'true';
      expect(respond({ path: '/api', headers: {} })['Content-Security-Policy']).toBeUndefined();
      expect(respond({ path: '/projects', headers: {} })['Content-Security-Policy']).toBe(API_CONTENT_SECURITY_POLICY);
      process.env.VISION_SWAGGER = 'false';
      expect(respond({ path: '/api', headers: {} })['Content-Security-Policy']).toBe(API_CONTENT_SECURITY_POLICY);
    });

    it('asks for https only on a request that came over https', () => {
      expect(respond({ secure: true, headers: {} })['Strict-Transport-Security']).toBe(HSTS);
      expect(respond({ headers: { 'x-forwarded-proto': 'https' } })['Strict-Transport-Security']).toBe(HSTS);
      expect(respond({ headers: { 'x-forwarded-proto': 'HTTPS, http' } })['Strict-Transport-Security']).toBe(HSTS);
      expect(cameOverHttps({ secure: false, headers: { 'x-forwarded-proto': ['https'] } } as never)).toBe(true);
    });

    it('sends no HSTS over http', () => {
      expect(respond({ headers: {} })['Strict-Transport-Security']).toBeUndefined();
      expect(respond({ headers: { 'x-forwarded-proto': 'http' } })['Strict-Transport-Security']).toBeUndefined();
      expect(respond({ headers: { 'x-forwarded-proto': 'http, https' } })['Strict-Transport-Security']).toBeUndefined();
    });
  });
});
