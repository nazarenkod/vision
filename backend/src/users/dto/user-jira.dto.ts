import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Personal Jira credentials; undefined keeps a value, an empty string removes it. */
export class UserJiraDto {
  @ApiPropertyOptional({ description: 'Personal access token (Server/DC) or API token (Cloud); write-only' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  jiraToken?: string;

  @ApiPropertyOptional({ description: 'Account email, for Jira Cloud only' })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  jiraEmail?: string;
}
