import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Put,
  Delete,
  Patch,
  Req,
  Res,
  HttpStatus,
  HttpCode,
  Param,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { UsersService } from './users.service';
import { ApiOkResponse, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserLoginResponseDto } from './dto/user-login-response.dto';
import { CreateAccountDto } from './dto/account-create.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { UserDto } from './dto/user.dto';
import { UpdateUserDto } from './dto/user-update.dto';
import { UserGeminiDto, UserJiraDto } from './dto/user-jira.dto';
import { UserLoginRequestDto } from './dto/user-login-request.dto';
import { CurrentUser } from '../shared/current-user.decorator';
import { Role, User } from '@prisma/client';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../shared/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { sealSecret } from '../shared/secret-box';
import { AssignRoleDto } from './dto/assign-role.dto';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NoProjectData } from '../projects/project-access';
import { AuthService } from '../auth/auth.service';
import { browserNonce, readStateCookie, stateCookieValue } from './oidc/oidc-browser';

const OIDC_STATE_COOKIE = 'oidc_state';

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

@Controller('users')
@ApiTags('users')
export class UsersController {
  private readonly logger: Logger = new Logger(UsersController.name);

  constructor(
    private usersService: UsersService,
    private prismaService: PrismaService,
    private configService: ConfigService,
    private authService: AuthService
  ) {}

  // There is no self sign-up (035): accounts come from an admin, or from the
  // first sign-in through LDAP or SSO.
  @NoProjectData()
  @Post()
  @ApiOkResponse({ type: UserDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin)
  createAccount(@Body() dto: CreateAccountDto): Promise<UserDto> {
    return this.usersService.createAccount(dto);
  }

  @NoProjectData()
  @Get('accounts/enabled')
  @ApiOkResponse({ type: Boolean })
  accountsEnabled(): boolean {
    return this.usersService.canCreateAccounts();
  }

  @NoProjectData()
  @Post('login')
  @ApiOkResponse({ type: UserLoginResponseDto })
  async login(@Body() userLoginRequestDto: UserLoginRequestDto): Promise<UserLoginResponseDto> {
    return this.usersService.login(userLoginRequestDto);
  }

  @NoProjectData()
  @Get('oidc/enabled')
  @ApiOkResponse({ type: Boolean })
  oidcEnabled(): boolean {
    return this.usersService.isOidcEnabled();
  }

  @NoProjectData()
  @Get('oidc/login')
  async oidcLogin(@Res() res: Response, @Query('nonce') nonce?: string): Promise<void> {
    if (!this.usersService.isOidcEnabled()) {
      res.status(HttpStatus.NOT_FOUND).send('OIDC is not enabled.');
      return;
    }

    // Started outside Vision's page (a tile of the identity provider, a bookmark): no tab holds a
    // value for it. The page starts it again with one, so the token comes back to a tab that
    // takes it (REQ-052-07) and such links keep working.
    const tab = browserNonce(nonce);
    if (!tab) {
      res.redirect(this.usersService.oidcBuildStartPage());
      return;
    }

    let authorization: { url: string; state: string; codeVerifier: string };
    try {
      authorization = await this.usersService.oidcGetAuthorizationUrl();
    } catch (e) {
      // The browser navigated here directly, so send it back to the login page
      // instead of showing a raw JSON error (e.g. when discovery fails).
      this.logger.warn(`OIDC login failed: ${e?.message ?? e}`);
      res.redirect(this.usersService.oidcBuildFrontendRedirect(undefined, 'oidc_login_failed'));
      return;
    }
    const { url, state, codeVerifier } = authorization;
    // the tab's value rides in the cookie and comes back with the token (REQ-052-07)
    res.cookie(OIDC_STATE_COOKIE, stateCookieValue({ state, codeVerifier, nonce: tab }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.get<string>('OIDC_REDIRECT_URI', '').startsWith('https'),
      maxAge: 10 * 60 * 1000,
      path: '/',
    });
    res.redirect(url);
  }

  @NoProjectData()
  @Get('oidc/callback')
  async oidcCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!this.usersService.isOidcEnabled()) {
      res.status(HttpStatus.NOT_FOUND).send('OIDC is not enabled.');
      return;
    }

    let target = this.usersService.oidcBuildFrontendRedirect(undefined, 'oidc_login_failed');
    try {
      // Inside the try: decodeURIComponent throws on a malformed cookie value.
      const started = readStateCookie(readCookie(req, OIDC_STATE_COOKIE));
      if (!started) {
        throw new Error('Missing or malformed OIDC state cookie.');
      }
      const { state, codeVerifier } = started;
      // Repeated query keys produce arrays; keep only scalar strings so the
      // callback sees a plain parameter map.
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          params[key] = value;
        }
      }
      const { token } = await this.usersService.oidcHandleCallback(params, {
        state,
        codeVerifier,
      });
      target = this.usersService.oidcBuildFrontendRedirect(token, undefined, started.nonce);
    } catch (e) {
      this.logger.warn(`OIDC callback failed: ${e?.message ?? e}`);
    } finally {
      res.clearCookie(OIDC_STATE_COOKIE, { path: '/' });
    }
    res.redirect(target);
  }

  @NoProjectData()
  @Get('me')
  @ApiOkResponse({ type: UserDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User): UserDto {
    return new UserDto(user);
  }

  @NoProjectData()
  @Get('newApiKey')
  @ApiOkResponse({ type: String })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  generateNewApiKey(@CurrentUser() user: User): Promise<string> {
    return this.usersService.generateNewApiKey(user);
  }

  @NoProjectData()
  @Put('password')
  @ApiOkResponse({ type: Boolean })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: User,
    @Body('password') password: string,
    @Req() request: Request
  ): Promise<boolean> {
    // this browser stays signed in; every other sign-in of the person ends (REQ-052-02)
    return this.usersService.changePassword(
      user,
      password,
      this.authService.sessionIdOf(request.headers.authorization)
    );
  }

  @NoProjectData()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  // the token of this sign-in opens nothing after this, in every API process (REQ-052-01)
  logout(@CurrentUser() user: User, @Req() request: Request): Promise<void> {
    return this.usersService.logout(user, this.authService.sessionIdOf(request.headers.authorization));
  }

  @NoProjectData()
  @Put(':id/password')
  @ApiOkResponse({ type: Boolean })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin)
  setPassword(@Param('id') id: string, @Body('password') password: string): Promise<boolean> {
    return this.usersService.setPassword(id, password);
  }

  @NoProjectData()
  @Put()
  @ApiOkResponse({ type: UserLoginResponseDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(@CurrentUser() user: User, @Body() updateUserDto: UpdateUserDto): Promise<UserLoginResponseDto> {
    return this.usersService.update(user.id, updateUserDto);
  }

  @NoProjectData()
  @Put('jira')
  @ApiOkResponse({ type: UserDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async setJira(@CurrentUser() user: User, @Body() dto: UserJiraDto): Promise<UserDto> {
    const value = (text: string | undefined) => (text === undefined ? undefined : text.trim() || null);
    const token = value(dto.jiraToken);
    const updated = await this.prismaService.user.update({
      where: { id: user.id },
      // the token is stored sealed (044); the email is no secret
      data: { jiraToken: token ? sealSecret(token) : token, jiraEmail: value(dto.jiraEmail) },
    });
    return new UserDto(updated);
  }

  @NoProjectData()
  @Put('gemini')
  @ApiOkResponse({ type: UserDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async setGemini(@CurrentUser() user: User, @Body() dto: UserGeminiDto): Promise<UserDto> {
    if (dto.geminiApiKey === undefined) return new UserDto(user);
    const updated = await this.prismaService.user.update({
      where: { id: user.id },
      data: { geminiApiKey: dto.geminiApiKey.trim() ? sealSecret(dto.geminiApiKey.trim()) : null },
    });
    return new UserDto(updated);
  }

  @NoProjectData()
  @Get('all')
  @ApiOkResponse({ type: UserDto, isArray: true })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin)
  async userList(): Promise<Array<UserDto & { projects: Array<{ id: string; name: string }> }>> {
    const [users, access] = await Promise.all([
      this.prismaService.user.findMany(),
      this.prismaService.projectAccess.findMany({
        select: { userId: true, project: { select: { id: true, name: true } } },
        orderBy: { project: { name: 'asc' } },
      }),
    ]);
    // the projects each person was given, for the admin's Users page (REQ-042-06)
    return users.map((user) =>
      Object.assign(new UserDto(user), {
        projects: access.filter((row) => row.userId === user.id).map((row) => row.project),
      })
    );
  }

  @NoProjectData()
  @Delete()
  @ApiOkResponse({ type: Boolean })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin)
  async delete(@Body() ids: string[]): Promise<void> {
    this.logger.debug(`Going to remove User: ${ids}`);
    for (const id of ids) {
      await this.usersService.delete(id);
    }
  }

  @NoProjectData()
  @Patch('assignRole')
  @ApiOkResponse({ type: UserDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin)
  async assignRole(@Body() data: AssignRoleDto): Promise<UserDto> {
    this.logger.debug(`Going to assign role ${data.role} to User: ${data.id}`);
    return this.usersService.assignRole(data);
  }
}
