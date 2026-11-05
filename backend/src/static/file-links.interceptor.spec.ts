import { Controller, Get, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { serverFileLinkKey, signFile } from './file-links';
import { FileLinksInterceptor } from './file-links.interceptor';

@Controller()
class Routes {
  @Get('runs')
  @UseGuards(JwtAuthGuard)
  guarded() {}

  @Get('public')
  open() {}
}

@UseGuards(JwtAuthGuard)
@Controller()
class GuardedRoutes {
  @Get('all')
  inside() {}
}

const run = { id: 'run', imageName: 'a.png', diffName: 'd.png' };

const answer = (handler: () => void, routes: object, body: unknown = [run]) =>
  lastValueFrom(
    new FileLinksInterceptor(new Reflector()).intercept(
      { getHandler: () => handler, getClass: () => routes, getType: () => 'http' } as never,
      { handle: () => of(body) }
    )
  );

describe('FileLinksInterceptor', () => {
  it('signs the files of an answer only for a guarded route', async () => {
    const key = serverFileLinkKey();
    const signatures = { 'a.png': signFile('a.png', key), 'd.png': signFile('d.png', key) };

    expect(await answer(Routes.prototype.guarded, Routes)).toEqual([{ ...run, fileSignatures: signatures }]);
    // a guard on the controller counts for its routes
    expect(await answer(GuardedRoutes.prototype.inside, GuardedRoutes, run)).toEqual({
      ...run,
      fileSignatures: signatures,
    });
    // no guard, no signatures: the images of that answer stay closed
    expect(await answer(Routes.prototype.open, Routes)).toEqual([run]);
  });
});
