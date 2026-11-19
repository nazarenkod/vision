import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiGuard } from './api.guard';
import { JwtAuthGuard } from './auth.guard';
import { MixedGuard } from './mixed.guard';

const context = {} as ExecutionContext;

function guard(jwt: () => unknown, apiKey: () => unknown) {
  const authGuard = { canActivate: jest.fn(jwt) } as unknown as JwtAuthGuard;
  const apiGuard = { canActivate: jest.fn(apiKey) } as unknown as ApiGuard;
  return { mixed: new MixedGuard(apiGuard, authGuard), authGuard, apiGuard };
}

const refuse = () => {
  throw new UnauthorizedException();
};

describe('MixedGuard', () => {
  it('lets a signed-in person in without looking at the API key', async () => {
    const { mixed, apiGuard } = guard(
      () => Promise.resolve(true),
      () => true
    );

    await expect(mixed.canActivate(context)).resolves.toBe(true);
    expect(apiGuard.canActivate).not.toHaveBeenCalled();
  });

  it('tries the API key when the sign-in check refuses with an exception', async () => {
    const { mixed } = guard(refuse, () => Promise.resolve(true));

    await expect(mixed.canActivate(context)).resolves.toBe(true);
  });

  it('turns the request away when both checks refuse, whether by exception or by false', async () => {
    await expect(guard(refuse, refuse).mixed.canActivate(context)).resolves.toBe(false);
    await expect(
      guard(
        () => false,
        () => Promise.reject(new UnauthorizedException())
      ).mixed.canActivate(context)
    ).resolves.toBe(false);
  });
});
