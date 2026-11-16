import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { serverFileLinkKey, signFile, withFileSignatures } from './file-links';

/**
 * Signatures for the images an answer names (043). Only a route behind a guard gets them: the
 * caller signed in or brought an API key, and sees only rows it may see, so a signature goes to
 * nobody who could not read the row anyway. A route without a guard (the public report signs
 * with its own token) gets none, and its images stay closed.
 */
@Injectable()
export class FileLinksInterceptor implements NestInterceptor {
  private readonly key = serverFileLinkKey();

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const guards = this.reflector.getAllAndMerge<unknown[]>(GUARDS_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (context.getType() !== 'http' || !guards.length) return next.handle();
    return next.handle().pipe(map((body) => withFileSignatures(body, (name) => signFile(name, this.key))));
  }
}
