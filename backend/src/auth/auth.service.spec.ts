import { PrismaService } from '../prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('never accepts a password against a restored placeholder', async () => {
    // vision-restore.sh leaves this instead of a hash for everyone but the master user
    expect(await service.compare('', '!restored')).toBe(false);
    expect(await service.compare('!restored', '!restored')).toBe(false);
  });
});

describe('AuthService.renewToken (VIS-SEC-059)', () => {
  const jwt = new JwtService({ secret: 'a-test-secret-of-32-characters-or-more', signOptions: { expiresIn: '1d' } });
  const user = { id: 'u1', email: 'ann@example.com' } as never;
  const prisma = (updated: number) => ({
    session: {
      updateMany: jest.fn(async () => ({ count: updated })),
      deleteMany: jest.fn(async () => ({ count: 0 })),
      create: jest.fn(async () => ({})),
    },
  });
  const sidOf = (token: string) => (jwt.decode(token) as { sid: string }).sid;

  it('keeps the sign-in of the request and moves its expiry to the new token', async () => {
    const db = prisma(1);
    const token = await new AuthService(jwt, db as never).renewToken(user, 'this-sign-in');

    expect(sidOf(token)).toBe('this-sign-in');
    expect(db.session.updateMany).toHaveBeenCalledWith({
      where: { id: 'this-sign-in', userId: 'u1', endedAt: null },
      data: { expiresAt: new Date((jwt.decode(token) as { exp: number }).exp * 1000) },
    });
    expect(db.session.create).not.toHaveBeenCalled();
  });

  // a token from before 052 has no sign-in to keep, and a sign-in of someone else or one that ended is none
  it('opens a sign-in of its own when the request has no live one of this person', async () => {
    for (const [sid, updated] of [
      [undefined, 0],
      ['ended-or-someone-else', 0],
    ] as const) {
      const db = prisma(updated);
      const token = await new AuthService(jwt, db as never).renewToken(user, sid);
      expect(sidOf(token)).not.toBe(sid);
      expect(db.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ id: sidOf(token), userId: 'u1' }),
      });
    }
  });
});
