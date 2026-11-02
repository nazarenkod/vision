import { Injectable } from '@nestjs/common';
import { CreateAccountDto } from './dto/account-create.dto';
import { UserLoginResponseDto } from './dto/user-login-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { UserDto } from './dto/user.dto';
import { UpdateUserDto } from './dto/user-update.dto';
import { AuthService } from '../auth/auth.service';
import { UserLoginRequestDto } from './dto/user-login-request.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { UsersFactoryService } from './users.factory';
import { Users } from './users.interface';
import { OidcUsersService } from './oidc/oidcusers.service';
import { DbUsersService } from './db/dbusers.service';
import { accountEmail } from './account';

@Injectable()
export class UsersService {
  private readonly logger: Logger = new Logger(UsersService.name);
  private readonly usersService: Users;

  constructor(
    private readonly usersFactoryService: UsersFactoryService,
    private prismaService: PrismaService,
    private authService: AuthService
  ) {
    this.usersService = this.usersFactoryService.getUsersService();
  }

  // With LDAP or SSO the account appears on its first sign-in, and its email
  // belongs to the directory, so only local accounts are created here (035).
  canCreateAccounts(): boolean {
    return this.usersService instanceof DbUsersService;
  }

  // Nobody signs themselves up: an admin creates the account and hands the
  // password over (035). The admin stays signed in as themselves.
  async createAccount(dto: CreateAccountDto): Promise<UserDto> {
    if (!this.canCreateAccounts()) {
      throw new HttpException(
        'Accounts come from LDAP or SSO: they appear on the first sign-in',
        HttpStatus.BAD_REQUEST
      );
    }
    if (typeof dto.password !== 'string' || !dto.password.trim()) {
      throw new HttpException('Password is required', HttpStatus.BAD_REQUEST);
    }
    const email = accountEmail(dto.email);
    // the seeded admin keeps its email as configured, so compare without case
    const taken = await this.prismaService.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (taken) {
      throw new HttpException('This email is already taken', HttpStatus.BAD_REQUEST);
    }
    const user = await this.prismaService.user.create({
      data: {
        email,
        firstName: dto.firstName?.trim() ?? '',
        lastName: dto.lastName?.trim() ?? '',
        role: dto.role,
        apiKey: this.authService.generateApiKey(),
        password: await this.authService.encryptPassword(dto.password),
      },
    });
    return new UserDto(user);
  }

  async update(id: string, userDto: UpdateUserDto): Promise<UserLoginResponseDto> {
    return this.usersService.update(id, userDto);
  }

  async changePassword(user: User, newPassword: string): Promise<boolean> {
    return this.usersService.changePassword(user, newPassword);
  }

  // After a restore nobody but the master user has a password (backups carry none), so an
  // admin hands them out; it works the same for any local account.
  async setPassword(id: string, password: string): Promise<boolean> {
    if (typeof password !== 'string' || !password.trim()) {
      throw new HttpException('Password is required', HttpStatus.BAD_REQUEST);
    }
    await this.prismaService.user.update({
      where: { id },
      data: { password: await this.authService.encryptPassword(password) },
      select: { id: true },
    });
    return true;
  }

  async login(userLoginRequestDto: UserLoginRequestDto) {
    const result = await this.usersService.login(userLoginRequestDto);
    await this.recordSignIn(result.id);
    return result;
  }

  // For the Users page (018). Only sign-ins to the web interface pass here;
  // API-key requests are authenticated elsewhere and are not sign-ins. A failed
  // write must not keep anyone out.
  private async recordSignIn(id: string): Promise<void> {
    try {
      await this.prismaService.user.update({
        where: { id },
        data: { lastSignInAt: new Date() },
        select: { id: true },
      });
    } catch (error) {
      this.logger.warn(`Could not record the sign-in of ${id}: ${error}`);
    }
  }

  isOidcEnabled(): boolean {
    return this.usersService instanceof OidcUsersService;
  }

  async oidcGetAuthorizationUrl(): Promise<{ url: string; state: string; codeVerifier: string }> {
    return this.oidcUsersService.getAuthorizationUrl();
  }

  async oidcHandleCallback(
    params: Record<string, string>,
    checks: { state: string; codeVerifier: string }
  ): Promise<UserLoginResponseDto> {
    const result = await this.oidcUsersService.handleCallback(params, checks);
    await this.recordSignIn(result.id);
    return result;
  }

  oidcBuildFrontendRedirect(token?: string, error?: string): string {
    return this.oidcUsersService.buildFrontendRedirect(token, error);
  }

  private get oidcUsersService(): OidcUsersService {
    if (!(this.usersService instanceof OidcUsersService)) {
      throw new HttpException('OIDC is not enabled.', HttpStatus.NOT_FOUND);
    }
    return this.usersService;
  }

  async findOne(id: string): Promise<User> {
    return this.prismaService.user.findUnique({ where: { id } });
  }

  async delete(id: string): Promise<User> {
    this.logger.debug(`Removing User: ${id}`);
    return this.prismaService.user.delete({ where: { id } });
  }

  async get(id: string): Promise<UserDto> {
    const user = await this.findOne(id);
    return new UserDto(user);
  }

  async assignRole(data: AssignRoleDto): Promise<UserDto> {
    const { id, role } = data;
    this.logger.debug(`Assigning role ${role} to User: ${id}`);

    const user = await this.prismaService.user.update({
      where: { id },
      data: { role },
    });
    return new UserDto(user);
  }

  async generateNewApiKey(user: User): Promise<string> {
    const newApiKey = this.authService.generateApiKey();
    await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        apiKey: newApiKey,
      },
    });
    return newApiKey;
  }
}
