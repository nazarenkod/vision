import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { CreateUserDto } from '../dto/user-create.dto';
import { UserLoginResponseDto } from '../dto/user-login-response.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, User } from '@prisma/client';
import { UpdateUserDto } from '../dto/user-update.dto';
import { AuthService } from '../../auth/auth.service';
import { UserLoginRequestDto } from '../dto/user-login-request.dto';
import { Entry as LdapEntry, Client as LdapClient } from 'ldapts';
import { Users } from '../users.interface';
import { ConfigService } from '@nestjs/config';
import { genSaltSync } from 'bcryptjs';

type LDAPConfig = {
  url: string;
  bindUser: string;
  bindPassword: string;
  searchDN: string;
  usersSearchFilter: string;
  attributeMail: string;
  attributeFirstName: string;
  attributeLastName: string;
  tlsNoVerify: boolean;
};
export class LdapUsersService implements Users {
  private readonly ldapClient: LdapClient;
  private readonly logger: Logger = new Logger(LdapUsersService.name);
  private readonly ldapConfig: LDAPConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly authService: AuthService
  ) {
    this.ldapConfig = {
      url: this.configService.getOrThrow<string>('LDAP_URL'),
      bindUser: this.configService.getOrThrow<string>('LDAP_BIND_USER'),
      bindPassword: this.configService.getOrThrow<string>('LDAP_BIND_PASSWORD'),
      searchDN: this.configService.getOrThrow<string>('LDAP_SEARCH_DN'),
      usersSearchFilter: this.configService.getOrThrow<string>('LDAP_USERS_SEARCH_FILTER'),
      attributeMail: this.configService.getOrThrow<string>('LDAP_ATTRIBUTE_MAIL'),
      attributeFirstName: this.configService.getOrThrow<string>('LDAP_ATTRIBUTE_FIRST_NAME'),
      attributeLastName: this.configService.getOrThrow<string>('LDAP_ATTRIBUTE_LAST_NAME'),
      tlsNoVerify: this.configService.get<string>('LDAP_TLS_NO_VERIFY', 'false').toLowerCase() === 'true',
    };
    this.ldapClient = new LdapClient({
      url: this.ldapConfig.url,
      tlsOptions: {
        rejectUnauthorized: !this.ldapConfig.tlsNoVerify,
      },
    });
  }

  /** Whether the directory has this person: then it decides their sign-in, not a local password (045). */
  async isInDirectory(email: string): Promise<boolean> {
    return !!(await this.findInDirectory(email));
  }

  // The search answers "not found" with the sign-in error; here not found is an answer, not a failure.
  private async findInDirectory(email: string): Promise<LdapEntry | null> {
    try {
      return await this.findUserInLdap(email);
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.BAD_REQUEST) return null;
      throw error;
    }
  }

  private async findUserInLdap(email: string): Promise<LdapEntry> {
    //escape the email address for LDAP search
    email = this.escapeLdap(email.trim());
    this.logger.verbose(`search '${email}' in LDAP`);
    try {
      await this.ldapClient.bind(this.ldapConfig.bindUser, this.ldapConfig.bindPassword);
      const attributes = [
        'dn',
        this.ldapConfig.attributeMail,
        this.ldapConfig.attributeFirstName,
        this.ldapConfig.attributeLastName,
      ];

      const { searchEntries } = await this.ldapClient.search(this.ldapConfig.searchDN, {
        filter: this.ldapConfig.usersSearchFilter.replaceAll('{{email}}', email),
        sizeLimit: 1,
        attributes: attributes,
      });
      if (searchEntries.length === 0) {
        this.logger.log('User not found in LDAP.');
        throw new HttpException('Invalid email or password.', HttpStatus.BAD_REQUEST);
      }
      for (const attribute of attributes) {
        if (searchEntries[0][attribute] == null) {
          this.logger.warn(`Attribute '${attribute}' not found in LDAP entry found for '${email}'`);
          throw new HttpException('Invalid email or password.', HttpStatus.BAD_REQUEST);
        }
      }
      return searchEntries[0];
    } finally {
      await this.ldapClient.unbind();
    }
  }

  private async createUserFromLdapEntry(ldapEntry: LdapEntry): Promise<User> {
    const userForDb = {
      email: ldapEntry[this.ldapConfig.attributeMail].toString().trim().toLowerCase(),
      firstName: ldapEntry[this.ldapConfig.attributeFirstName].toString(),
      lastName: ldapEntry[this.ldapConfig.attributeLastName].toString(),
      apiKey: this.authService.unknownApiKey(),
      password: await this.authService.encryptPassword(genSaltSync(1).slice(-12)),
      role: Role.editor,
    };

    return this.prismaService.user.create({
      data: userForDb,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async create(createUserDto: CreateUserDto): Promise<UserLoginResponseDto> {
    throw new HttpException('User creation is disabled. Use your LDAP-Credentials to login.', HttpStatus.BAD_REQUEST);
  }

  /**
   * The email is who the account is: sign-in through the directory finds the account by it. Taking
   * it from the request let anyone give their account a colleague's email, and the colleague's first
   * directory sign-in then landed in the attacker's account (VIS-SEC-006). So the email stays as it
   * is, as with SSO; the directory's people get their names from the directory, by the email the
   * account already has.
   */
  async update(id: string, userDto: UpdateUserDto): Promise<UserLoginResponseDto> {
    const current = await this.prismaService.user.findUnique({ where: { id }, select: { email: true } });
    if (!current) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    if (userDto.email !== undefined && userDto.email.trim().toLowerCase() !== current.email.toLowerCase()) {
      throw new HttpException(
        'The email comes from the company directory and cannot be changed here',
        HttpStatus.BAD_REQUEST
      );
    }
    const fromDirectory = await this.findInDirectory(current.email);
    const user = await this.prismaService.user.update({
      where: { id },
      data: fromDirectory
        ? {
            firstName: fromDirectory[this.ldapConfig.attributeFirstName].toString(),
            lastName: fromDirectory[this.ldapConfig.attributeLastName].toString(),
          }
        : { firstName: userDto.firstName, lastName: userDto.lastName },
    });
    const token = this.authService.signToken(user);
    return new UserLoginResponseDto(user, token);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async changePassword(user: User, newPassword: string): Promise<boolean> {
    this.logger.warn(`${user.email} tied to change password - this is not supported for LDAP users`);
    return true;
  }

  async login(userLoginRequestDto: UserLoginRequestDto) {
    // A bind with an empty password is an anonymous bind, and many directories answer it with
    // success: without this check anyone signed in as anyone (VIS-SEC-007).
    if (!userLoginRequestDto.password?.trim()) {
      throw new HttpException('Invalid email or password.', HttpStatus.BAD_REQUEST);
    }
    const userFromLdap = await this.findUserInLdap(userLoginRequestDto.email);
    if (!userFromLdap) {
      throw new HttpException('Invalid email or password.', HttpStatus.BAD_REQUEST);
    }

    // check if user password is correct using ldap
    try {
      await this.ldapClient.bind(userFromLdap.dn, userLoginRequestDto.password);
    } catch (e) {
      throw new HttpException('Invalid email or password.', HttpStatus.BAD_REQUEST);
    } finally {
      await this.ldapClient.unbind();
    }

    const userEmailFromLdap = userFromLdap[this.ldapConfig.attributeMail].toString().trim().toLowerCase();

    let user = await this.prismaService.user.findUnique({
      where: { email: userEmailFromLdap },
    });

    if (!user) {
      // create user if not found in Vision database
      this.logger.log(
        `'${userLoginRequestDto.email}' (found in ldap as '${userEmailFromLdap}') successfully ` +
          'authenticated via LDAP, but not found in Vision database. Creating user.'
      );
      user = await this.createUserFromLdapEntry(userFromLdap);
    }

    const token = this.authService.signToken(user);
    return new UserLoginResponseDto(user, token);
  }

  /**
   * RFC 2254 Escaping of filter strings
   * Raw                     Escaped
   * (o=Parens (R Us))       (o=Parens \28R Us\29)
   * (cn=star*)              (cn=star\2A)
   * (filename=C:\MyFile)    (filename=C:\5cMyFile)
   */
  private escapeLdap(input: string): string {
    let escapedResult = '';
    for (const inputChar of input) {
      switch (inputChar) {
        case '*':
          escapedResult += '\\2a';
          break;
        case '(':
          escapedResult += '\\28';
          break;
        case ')':
          escapedResult += '\\29';
          break;
        case '\\':
          escapedResult += '\\5c';
          break;
        case '\0':
          escapedResult += '\\00';
          break;
        default:
          escapedResult += inputChar;
          break;
      }
    }
    return escapedResult;
  }
}
