import { ExecutionContext, Injectable, CanActivate, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { hashApiKey } from '../../shared/api-key-hash';

@Injectable()
export class ApiGuard implements CanActivate {
  constructor(private readonly prismaService: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    try {
      const key = request.header('apiKey');
      if (!key) return false;
      const user = await this.prismaService.user.findUnique({ where: { apiKey: hashApiKey(key) } });
      // the key's owner acts, with their access to projects (042)
      if (user) (request as Request & { user?: unknown }).user = user;
      return !!user;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
