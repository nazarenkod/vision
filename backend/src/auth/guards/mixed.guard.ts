import { ExecutionContext, Injectable, CanActivate } from '@nestjs/common';
import { ApiGuard } from './api.guard';
import { JwtAuthGuard } from './auth.guard';

// A guard that turns a request away throws; here that only means "try the other way in".
async function passes(check: () => unknown): Promise<boolean> {
  try {
    return Boolean(await check());
  } catch {
    return false;
  }
}

@Injectable()
export class MixedGuard implements CanActivate {
  constructor(
    private readonly apiGuard: ApiGuard,
    private readonly authGuard: JwtAuthGuard
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // signed in: that person acts, whatever key the request also carries
    if (await passes(() => this.authGuard.canActivate(context))) return true;
    return passes(() => this.apiGuard.canActivate(context));
  }
}
