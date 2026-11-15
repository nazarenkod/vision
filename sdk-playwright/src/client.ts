// Ported from Visual Regression Tracker sdk-js 5.9.0 (src/visualRegressionTracker.ts,
// src/helpers/http.helper.ts, src/helpers/dto.helper.ts), Apache-2.0; see ../NOTICE.
// The requests are the ones sdk-js sends (same endpoints, headers and fields), so the server and
// the baselines do not notice the change (spec 050, REQ-050-23). Global fetch replaces axios and
// form-data; only the image-buffer upload the Playwright agent uses is kept.
import { setTimeout as sleepFor } from 'timers/promises';
import { readConfigFromEnv, readConfigFromFile, validateConfig } from './config';
import { trackWithRetry } from './track';
import { BuildResponse, Config, TestRunBuffer, TestRunResponse, TestRunResult } from './types';

export const DEFAULT_HTTP_TIMEOUT_SECONDS = 360;
export const MAX_503_RETRIES = 3;
const MAX_RETRY_AFTER_MS = 60_000;
// what axios sends, so the server sees the same request
const ACCEPT = 'application/json, text/plain, */*';

export class ServerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage?: string
  ) {
    super(message);
    this.name = 'ServerError';
  }
}

/** A response other than 2xx, before it becomes a ServerError: 503 may be retried. */
class HttpFailure extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly data: unknown,
    readonly retryAfter?: string
  ) {
    super(`Request failed with status code ${status}`);
  }
}

const serverMessage = (data: unknown): string | undefined => {
  if (!data || typeof data !== 'object') return undefined;
  const { message } = data as { message?: unknown };
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : JSON.stringify(data);
};

const errorHint = (status: number, url: string, retryAfter?: string, serverReason?: string): string | undefined => {
  switch (status) {
    case 401:
      return 'Check apiKey.';
    case 403:
      return "Check that the apiKey's user has access to the project.";
    case 404:
      return serverReason && !/^Cannot [A-Z]+ \//.test(serverReason) ? undefined : 'Check apiUrl and project.';
    case 409:
      return 'Another change to the same build or project is in progress; try again.';
    case 413:
      if (url.endsWith('/test-runs/multipart')) {
        return "Raise MULTIPART_FILE_SIZE_LIMIT (or the proxy's body size limit) on the server.";
      }
      return 'Raise BODY_PARSER_JSON_LIMIT on the server.';
    case 422:
      return 'Track a smaller image or raise MAX_IMAGE_PIXELS on the server.';
    case 503:
      return retryAfter
        ? `The server is busy or restarting; try again after Retry-After: ${retryAfter}.`
        : 'The server is unavailable; try again later.';
  }
  return undefined;
};

export const retryAfterMs = (value: string | undefined, now = Date.now()): number | undefined => {
  const text = value?.trim();
  if (!text) return undefined;
  let ms: number;
  if (/^\d+$/.test(text)) {
    ms = Number(text) * 1000;
  } else if (/ GMT$/.test(text)) {
    ms = Date.parse(text) - now;
  } else {
    return undefined;
  }
  if (Number.isNaN(ms)) return undefined;
  return Math.min(Math.max(ms, 0), MAX_RETRY_AFTER_MS);
};

export const sendWithRetry = async <T>(
  send: () => Promise<T>,
  sleep: (ms: number) => Promise<unknown> = sleepFor
): Promise<T> => {
  for (let retry = 1; ; retry++) {
    try {
      return await send();
    } catch (error) {
      const wait = error instanceof HttpFailure && error.status === 503 ? retryAfterMs(error.retryAfter) : undefined;
      if (wait === undefined || retry > MAX_503_RETRIES) throw error;
      console.warn(`Vision: server busy (503), retrying in ${wait / 1000} s (${retry}/${MAX_503_RETRIES})`);
      await sleep(wait);
    }
  }
};

const parseBody = (text: string): unknown => {
  if (!text) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/**
 * fetch refuses a URL with user:password@, which axios sent as basic auth (a proxy in front of
 * the server): the same header, with the credentials out of the URL.
 */
export const withoutCredentials = (raw: string): { url: string; authorization?: string } => {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { url: raw };
  }
  if (!parsed.username && !parsed.password) return { url: raw };
  const user = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  return {
    url: raw.replace(/\/\/[^/@]*@/, '//'),
    authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
  };
};

/** The multipart form of sdk-js's bufferDtoToFormData, field for field, plus Vision's fields. */
export const testRunForm = (
  dto: TestRunBuffer & { buildId: string; projectId: string; branchName: string; sourceBranch?: string }
): FormData => {
  const data = new FormData();
  data.append('buildId', dto.buildId);
  data.append('projectId', dto.projectId);
  data.append('branchName', dto.branchName);
  dto.sourceBranch && data.append('sourceBranch', dto.sourceBranch);
  data.append('name', dto.name);
  data.append('image', new Blob([new Uint8Array(dto.imageBuffer)], { type: 'image/png' }), 'image.png');
  dto.os && data.append('os', dto.os);
  dto.browser && data.append('browser', dto.browser);
  dto.viewport && data.append('viewport', dto.viewport);
  dto.device && data.append('device', dto.device);
  dto.customTags && data.append('customTags', dto.customTags);
  dto.ignoreAreas && data.append('ignoreAreas', JSON.stringify(dto.ignoreAreas));
  dto.diffTollerancePercent && data.append('diffTollerancePercent', String(dto.diffTollerancePercent));
  dto.comment && data.append('comment', dto.comment);
  dto.merge !== undefined && data.append('merge', String(dto.merge));
  // Vision: after the fields sdk-js sends, and only when there is something to send
  dto.uiTree && data.append('uiTree', dto.uiTree);
  dto.uiTree && dto.uiTreeFormat && data.append('uiTreeFormat', dto.uiTreeFormat);
  dto.featureName && data.append('featureName', dto.featureName);
  dto.browserVersion && data.append('browserVersion', dto.browserVersion);
  return data;
};

/** The client of the Vision API: sdk-js's VisualRegressionTracker, under Vision's names. */
export class VisionClient {
  readonly config: Config;
  private buildId = '';
  private projectId = '';

  constructor(explicitConfig?: Config) {
    let config: Config = { apiUrl: '', apiKey: '', project: '', branchName: '' };
    if (explicitConfig) {
      config = { ...explicitConfig };
    } else {
      config = readConfigFromEnv(readConfigFromFile(config));
    }
    validateConfig(config);
    this.config = config;
  }

  isStarted(): boolean {
    return !!this.buildId && !!this.projectId;
  }

  async start(): Promise<BuildResponse> {
    const data = {
      branchName: this.config.branchName,
      project: this.config.project,
      ciBuildId: this.config.ciBuildId,
    };
    const build = await this.send<BuildResponse>('POST', '/builds', data);
    this.buildId = build.id;
    this.projectId = build.projectId;
    return build;
  }

  async stop(): Promise<void> {
    if (!this.isStarted()) throw new Error('Vision has not been started');
    await this.send('PATCH', `/builds/${this.buildId}`, { isRunning: false });
  }

  /**
   * Submits a screenshot; retries while it is "unresolved", as sdk-js does.
   *
   * @param retryCount Retry count, default is 2
   */
  async track(test: TestRunBuffer, retryCount = 2): Promise<TestRunResult> {
    if (!this.isStarted()) throw new Error('Vision has not been started');
    const response = await trackWithRetry(
      () =>
        this.send<TestRunResponse>(
          'POST',
          '/test-runs/multipart',
          testRunForm({
            buildId: this.buildId,
            projectId: this.projectId,
            branchName: this.config.branchName,
            sourceBranch: this.config.sourceBranch,
            ...test,
          })
        ),
      retryCount,
      this.config.enableSoftAssert
    );
    return new TestRunResult(response, this.config.apiUrl);
  }

  private async send<T>(method: string, path: string, body: object | FormData): Promise<T> {
    const { url, authorization } = withoutCredentials(`${this.config.apiUrl}${path}`);
    // secrets never go into a message: neither URL credentials nor headers
    const request = `${method} ${url}`;
    const timeout = (this.config.httpTimeoutInSeconds ?? DEFAULT_HTTP_TIMEOUT_SECONDS) * 1000;
    const isForm = body instanceof FormData;
    // fetch sets the multipart type itself, with its boundary
    const headers: Record<string, string> = {
      Accept: ACCEPT,
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      apiKey: this.config.apiKey,
      project: this.config.project,
    };
    if (authorization) headers.Authorization = authorization;

    const once = async (): Promise<T> => {
      let response: Response;
      let text: string;
      try {
        response = await fetch(url, {
          method,
          headers,
          body: isForm ? body : JSON.stringify(body),
          signal: timeout > 0 ? AbortSignal.timeout(timeout) : undefined,
        });
        text = await response.text();
      } catch (error) {
        const err = error as Error & { cause?: { code?: string; message?: string } };
        const code = err.cause?.code ?? (err.name === 'TimeoutError' ? 'ETIMEDOUT' : undefined);
        const reason = err.cause?.message ?? err.message;
        throw new Error(`No response from server for ${request}${code ? ` (${code})` : ''}: ${reason}`, {
          cause: err.cause,
        });
      }
      const data = parseBody(text);
      if (!response.ok) {
        throw new HttpFailure(
          response.status,
          response.statusText,
          data,
          response.headers.get('retry-after') ?? undefined
        );
      }
      return data as T;
    };

    try {
      return await sendWithRetry(once);
    } catch (error) {
      if (!(error instanceof HttpFailure)) throw error;
      const fromServer = serverMessage(error.data);
      const detail = fromServer || error.statusText || error.message;
      const hint = errorHint(error.status, url, error.retryAfter, fromServer);
      const text = hint ? `${detail.replace(/\.$/, '')}. ${hint}` : detail;
      throw new ServerError(`${request} returned ${error.status}: ${text}`, error.status, fromServer);
    }
  }
}
