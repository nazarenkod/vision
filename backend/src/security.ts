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

export function securityHeaders(_request: Request, response: Response, next: NextFunction): void {
  response.set(SECURITY_HEADERS);
  // the framework's name helps nobody but a scanner
  response.removeHeader('X-Powered-By');
  next();
}
