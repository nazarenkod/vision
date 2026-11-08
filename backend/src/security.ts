import { NextFunction, Request, Response } from 'express';

/**
 * How the API faces browsers (045). Only Vision's own interface may read answers in a script,
 * the documentation is off unless turned on, and every answer carries the standard headers a
 * security scan of the bank looks for. The SDK and the CLI are no browsers: CORS does not touch them.
 */

/** The origin of Vision's interface, from APP_FRONTEND_URL; false lets no other site read answers. */
export function corsOriginOf(env: NodeJS.ProcessEnv = process.env): string | false {
  try {
    return env.APP_FRONTEND_URL ? new URL(env.APP_FRONTEND_URL).origin : false;
  } catch {
    return false;
  }
}

/**
 * For CORS settings made before the environment is read (decorators run at import, before the
 * configuration loads .env): decides per request.
 */
export function allowOwnInterface(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void
): void {
  const own = corsOriginOf();
  callback(null, !!origin && !!own && origin === own);
}

export const swaggerEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  (env.VISION_SWAGGER ?? '').trim().toLowerCase() === 'true';

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/**
 * The API answers JSON and images: a page that renders one runs nothing and frames nothing
 * (052). The API documentation, when it is on, is a page with its own scripts and styles.
 */
export const API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";

const isDocumentation = (path: string | undefined) =>
  !!path && (path === '/api' || path.startsWith('/api/') || path.startsWith('/api-json'));

/**
 * Whether a request came over https: to the API itself, or to a proxy in front that says so in
 * X-Forwarded-Proto (the first one, when proxies are chained). Only then HSTS (REQ-052-09): over
 * plain http a browser ignores it, and Vision works without a certificate (REQ-052-10).
 */
export function cameOverHttps(request: Pick<Request, 'secure' | 'headers'>): boolean {
  if (request?.secure) return true;
  const forwarded = request?.headers?.['x-forwarded-proto'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim().toLowerCase();
  return first === 'https';
}

export const HSTS = 'max-age=31536000';

export function securityHeaders(request: Request, response: Response, next: NextFunction): void {
  response.set(SECURITY_HEADERS);
  if (!(swaggerEnabled() && isDocumentation(request?.path))) {
    response.set('Content-Security-Policy', API_CONTENT_SECURITY_POLICY);
  }
  if (cameOverHttps(request)) response.set('Strict-Transport-Security', HSTS);
  // the framework's name helps nobody but a scanner
  response.removeHeader('X-Powered-By');
  next();
}
