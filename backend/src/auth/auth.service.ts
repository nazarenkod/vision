import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { newRandomKey } from '../shared/random-key';
import { apiKeyEnding, hashApiKey } from '../shared/api-key-hash';
import { compare, genSalt, hash } from 'bcryptjs';
import { JwtPayload } from './jwt-payload.model';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

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

  signToken(user: User): string {
    const payload: JwtPayload = {
      email: user.email,
    };

    const token = this.jwtService.sign(payload);
    return token;
  }

  // Same secret and expiry check as JwtStrategy, for callers outside an HTTP
  // request (the events socket). Rejects when the token is not valid.
  verifyToken(token: string): Promise<JwtPayload & { exp?: number }> {
    return this.jwtService.verifyAsync(token);
  }
}
