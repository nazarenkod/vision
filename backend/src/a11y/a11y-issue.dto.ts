import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const JIRA_KEY = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

export class A11yIssueRefDto {
  @ApiProperty({ description: 'Issue id from the accessibility report (rule|element)' })
  @IsString()
  @IsNotEmpty()
  violationId: string;
}

export class IgnoreA11yIssueDto extends A11yIssueRefDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class LinkA11yIssueDto extends A11yIssueRefDto {
  @ApiProperty({ example: 'MOB-1234' })
  @Matches(JIRA_KEY, { message: 'jiraKey must look like ABC-123' })
  jiraKey: string;
}

export class FileA11yBugDto extends A11yIssueRefDto {
  @ApiProperty({ example: 'MOB-1200', description: 'Task the new bug is linked to; the bug goes into its project' })
  @Matches(JIRA_KEY, { message: 'parentKey must look like ABC-123' })
  parentKey: string;
}
