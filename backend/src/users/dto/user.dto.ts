import { ApiProperty } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';

export class UserDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty()
  readonly email: string;

  @ApiProperty()
  readonly firstName: string;

  @ApiProperty()
  readonly lastName: string;

  @ApiProperty()
  readonly apiKey: string;

  @ApiProperty()
  readonly role: Role;

  // the personal Jira token itself never leaves the server
  @ApiProperty()
  readonly jiraTokenSet: boolean;

  @ApiProperty({ nullable: true })
  readonly jiraEmail: string | null;

  // the personal Gemini key itself never leaves the server either
  @ApiProperty()
  readonly geminiKeySet: boolean;

  // when they last signed in to the web interface; null: not since 018
  @ApiProperty({ nullable: true })
  readonly lastSignInAt: Date | null;

  constructor(user: User) {
    this.id = user.id;
    this.email = user.email;
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.apiKey = user.apiKey;
    this.role = user.role;
    this.jiraTokenSet = !!user.jiraToken;
    this.jiraEmail = user.jiraEmail ?? null;
    this.geminiKeySet = !!user.geminiApiKey;
    this.lastSignInAt = user.lastSignInAt ?? null;
  }
}
