import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { newRandomKey } from '../shared/random-key';
import { apiKeyEnding, hashApiKey } from '../shared/api-key-hash';
import { compare, genSalt, hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { JwtPayload } from './jwt-payload.model';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sessionExpiry, sessionProblem, SessionProblem } from './sessions';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prismaService: PrismaService
  ) {}

  async encryptPassword(password): Promise<string> {
    const salt = await genSalt(10);
    return hash(password, salt);
  }

  /** A new key, and what is stored of it: its hash and its last characters (044). */
  generateApiKey(): { key: string; stored: { apiKey: string; apiKeyEnding: string } } {
    const key = newRandomKey();
    return { key, stored: { apiKey: hashApiKey(key), apiKeyEnding: apiKeyEnding(key) } };
  }

  /** What a new account gets: the hash of a key nobody was shown; they make their own in the profile. */
  unknownApiKey(): string {
    return hashApiKey(newRandomKey());
  }

  async compare(password: string, hashedPassword: string): Promise<boolean> {
    return await compare(password, hashedPassword);
  }

  /** The token of a new sign-in, with a session of its own that signing out ends (052). */
  async signToken(user: User): Promise<string> {
    const now = new Date();
    const sid = randomUUID();
    const payload: JwtPayload = { email: user.email, sid };
    const token = this.jwtService.sign(payload);
    const { exp } = (this.jwtService.decode(token) ?? {}) as { exp?: number };
    // rows of sign-ins whose tokens expired go as the person signs in again: no job needed
    await this.prismaService.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: now } } });
    await this.prismaService.session.create({ data: { id: sid, userId: user.id, expiresAt: sessionExpiry(exp, now) } });
    return token;
  }

  // Same secret and expiry check as JwtStrategy, for callers outside an HTTP
  // request (the events socket). Rejects when the token is not valid.
  verifyToken(token: string): Promise<JwtPayload & { exp?: number; iat?: number }> {
    return this.jwtService.verifyAsync(token);
  }

  /** The person a verified token signs in, or why it signs in nobody: gone, signed out (052). */
  async userForToken(payload: JwtPayload & { iat?: number }): Promise<{ user: User } | { problem: SessionProblem }> {
    const [user, session] = await Promise.all([
      this.prismaService.user.findUnique({ where: { email: payload.email } }),
      payload.sid
        ? this.prismaService.session.findUnique({ where: { id: payload.sid }, select: { userId: true, endedAt: true } })
        : null,
    ]);
    const problem = sessionProblem(payload, user, session);
    return problem ? { problem } : { user };
  }

  /** The session a request's own token names; undefined for a token from before sessions. */
  sessionIdOf(authorization: string | undefined): string | undefined {
    const token = /^Bearer\s+(.+)$/i.exec(authorization ?? '')?.[1];
    const payload = token ? (this.jwtService.decode(token) as JwtPayload | null) : null;
    return typeof payload?.sid === 'string' ? payload.sid : undefined;
  }

  /** Signing out: this sign-in only, or, for a token from before sessions, the old tokens of the person. */
  async endSession(userId: string, sid: string | undefined): Promise<void> {
    if (sid) {
      await this.prismaService.session.updateMany({
        where: { id: sid, userId, endedAt: null },
        data: { endedAt: new Date() },
      });
    } else {
      await this.prismaService.user.update({
        where: { id: userId },
        data: { tokensValidAfter: new Date() },
        select: { id: true },
      });
    }
  }

  /** A new password: every sign-in of the person ends, but the one named to keep (052). */
  async endSessions(userId: string, keep?: string): Promise<void> {
    const now = new Date();
    await this.prismaService.session.updateMany({
      where: { userId, endedAt: null, ...(keep ? { id: { not: keep } } : {}) },
      data: { endedAt: now },
    });
    // tokens from before sessions have no row: the moment ends them
    await this.prismaService.user.update({
      where: { id: userId },
      data: { tokensValidAfter: now },
      select: { id: true },
    });
  }
}
