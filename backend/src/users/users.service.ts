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
import { accountEmail, passwordProblem } from './account';
import { LdapUsersService } from './ldap/ldapusers.service';
import { SignInLimit } from './sign-in-limit';
import { EventsGateway } from '../shared/events/events.gateway';

@Injectable()
export class UsersService {
  private readonly logger: Logger = new Logger(UsersService.name);
  private readonly usersService: Users;
  // local accounts sign in beside LDAP and SSO (045)
  private readonly localUsers: DbUsersService;
  private readonly signInLimit = new SignInLimit();

  constructor(
    private readonly usersFactoryService: UsersFactoryService,
    private prismaService: PrismaService,
    private authService: AuthService,
    private eventsGateway: EventsGateway
  ) {
    this.usersService = this.usersFactoryService.getUsersService();
    this.localUsers =
      this.usersService instanceof DbUsersService
        ? this.usersService
        : new DbUsersService(this.prismaService, this.authService);
  }

  // A local account works beside LDAP and SSO, for people the directory does not have (045);
  // directory and SSO accounts still appear on their first sign-in.
  canCreateAccounts(): boolean {
    return true;
  }

  // Nobody signs themselves up: an admin creates the account and hands the
  // password over (035). The admin stays signed in as themselves.
  async createAccount(dto: CreateAccountDto): Promise<UserDto> {
    const problem = passwordProblem(dto.password);
    if (problem) throw new HttpException(problem, HttpStatus.BAD_REQUEST);
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
        apiKey: this.authService.unknownApiKey(),
        password: await this.authService.encryptPassword(dto.password),
      },
    });
    return new UserDto(user);
  }

  async update(id: string, userDto: UpdateUserDto, sessionId?: string): Promise<UserLoginResponseDto> {
    return this.usersService.update(id, userDto, sessionId);
  }

  /**
   * A new password ends every other sign-in of the person (REQ-052-02): whoever has an old token
   * of theirs is out. The sign-in that changed it, `sessionId`, stays.
   */
  async changePassword(user: User, newPassword: string, sessionId?: string): Promise<boolean> {
    const problem = passwordProblem(newPassword);
    if (problem) throw new HttpException(problem, HttpStatus.BAD_REQUEST);
    // a local account beside LDAP changes its own password; the directory's people change theirs there
    const ldap = this.usersService instanceof LdapUsersService;
    const local = ldap && !(await (this.usersService as LdapUsersService).isInDirectory(user.email));
    const changed = local
      ? await this.localUsers.changePassword(user, newPassword)
      : await this.usersService.changePassword(user, newPassword);
    // the directory's people change their password in the directory: here nothing changed, so
    // their other sign-ins stay (LDAP answers true and stores nothing)
    if (changed && (!ldap || local)) {
      await this.authService.endSessions(user.id, sessionId);
      await this.eventsGateway.endSessions(user.id, { keep: sessionId });
    }
    return changed;
  }

  /** Signing out ends this sign-in only (REQ-052-01): its token and its events socket. */
  async logout(user: User, sessionId: string | undefined): Promise<void> {
    await this.authService.endSession(user.id, sessionId);
    await this.eventsGateway.endSessions(user.id, { only: sessionId ?? null });
  }

  // After a restore nobody but the master user has a password (backups carry none), so an
  // admin hands them out; it works the same for any local account.
  async setPassword(id: string, password: string): Promise<boolean> {
    const problem = passwordProblem(password);
    if (problem) throw new HttpException(problem, HttpStatus.BAD_REQUEST);
    await this.prismaService.user.update({
      where: { id },
      data: { password: await this.authService.encryptPassword(password) },
      select: { id: true },
    });
    // a password an admin gave ends every sign-in of the person (REQ-052-03)
    await this.authService.endSessions(id);
    await this.eventsGateway.endSessions(id);
    return true;
  }

  async login(userLoginRequestDto: UserLoginRequestDto) {
    const email = userLoginRequestDto?.email ?? '';
    if (this.signInLimit.closed(email)) {
      throw new HttpException('Too many attempts: try again in 15 minutes', HttpStatus.TOO_MANY_REQUESTS);
    }
    let result: UserLoginResponseDto;
    try {
      result = await this.signIn(userLoginRequestDto);
    } catch (error) {
      // a wrong email or password counts; a directory that is down does not
      if (error instanceof HttpException && error.getStatus() === HttpStatus.BAD_REQUEST)
        this.signInLimit.failed(email);
      throw error;
    }
    this.signInLimit.succeeded(email);
    await this.recordSignIn(result.id);
    return result;
  }

  /**
   * The directory decides for the people it has; everyone else signs in with a local password
   * (045). With SSO the form is for local accounts only: SSO's people have no password anyone knows.
   */
  private async signIn(dto: UserLoginRequestDto): Promise<UserLoginResponseDto> {
    if (this.usersService instanceof LdapUsersService && !(await this.usersService.isInDirectory(dto.email))) {
      return this.localUsers.login(dto);
    }
    if (this.usersService instanceof OidcUsersService) return this.localUsers.login(dto);
    return this.usersService.login(dto);
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
    // the sign-in may have changed the role: open sockets follow only what it still reaches (052)
    await this.eventsGateway.recheckAccess(result.id);
    return result;
  }

  oidcBuildStartPage(): string {
    return this.oidcUsersService.buildStartPage();
  }

  oidcBuildFrontendRedirect(token?: string, error?: string, nonce?: string | null): string {
    return this.oidcUsersService.buildFrontendRedirect(token, error, nonce);
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
    const deleted = await this.prismaService.user.delete({ where: { id } });
    // the sessions go with the account; its sockets close now, not when their tokens expire (REQ-052-04)
    await this.eventsGateway.endSessions(id);
    return deleted;
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
    // a project the new role does not reach sends the person no more events (REQ-052-06)
    await this.eventsGateway.recheckAccess(id);
    return new UserDto(user);
  }

  // the key is returned this once; the database keeps only its hash and ending (044)
  async generateNewApiKey(user: User): Promise<string> {
    const { key, stored } = this.authService.generateApiKey();
    await this.prismaService.user.update({ where: { id: user.id }, data: stored });
    return key;
  }
}
