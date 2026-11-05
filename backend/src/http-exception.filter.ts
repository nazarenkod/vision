import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * What a failed request answers (045): its status, a message for the person and the path; for a
 * settings conflict also the fields that changed. The stack, the exception object and the text of
 * an unexpected error stay in the server's log: they show a scanner how the server is built.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const { statusCode, message, fields } = errorAnswer(exception);

    if (statusCode >= 500)
      this.logger.error(`${request.method} ${request.url}`, (exception as Error)?.stack ?? exception);
    else this.logger.warn(`${request.method} ${request.url}: ${statusCode} ${message}`);

    response.status(statusCode).json({ statusCode, message, path: request.url, ...(fields ? { fields } : {}) });
  }
}

export function errorAnswer(exception: unknown): { statusCode: number; message: string; fields?: unknown } {
  const text = (exception as Error)?.message ?? '';
  // the unique index of a row the person tried to add twice
  if (text.includes('Unique constraint failed on the fields')) {
    return { statusCode: HttpStatus.BAD_REQUEST, message: uniqueMessage(text) };
  }
  if (!(exception instanceof HttpException)) {
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
  const statusCode = exception.getStatus();
  const body = exception.getResponse();
  let message = text;
  let fields: unknown;
  if (body && typeof body === 'object') {
    const said = (body as { message?: unknown }).message;
    // validation says what is wrong in a list
    if (Array.isArray(said)) message = said.join('; ');
    else if (typeof said === 'string') message = said;
    fields = (body as { fields?: unknown }).fields;
  } else if (typeof body === 'string') {
    message = body;
  }
  if (message.includes('Forbidden resource')) message = 'You do not have permission to perform this operation.';
  return { statusCode, message, ...(fields !== undefined ? { fields } : {}) };
}

function uniqueMessage(text: string): string {
  if (text.includes('build.update()')) return 'There is already a build with this ci build id.';
  if (text.includes('project.create()')) return 'Project exists with this name.';
  if (text.includes('user.create()')) return 'This user already exists.';
  return 'This already exists.';
}
