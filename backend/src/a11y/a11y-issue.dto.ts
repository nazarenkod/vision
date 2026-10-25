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

export class PrepareA11yBugDto extends A11yIssueRefDto {
  @ApiProperty({ example: 'MOB-1200', description: 'Task the bug goes under; the bug goes into its project' })
  @Matches(JIRA_KEY, { message: 'parentKey must look like ABC-123' })
  parentKey: string;

  @ApiPropertyOptional({ description: 'Jira issue type id; the project default or a bug sub-task when absent' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  issueTypeId?: string;
}

export class FileA11yBugDto extends PrepareA11yBugDto {
  @ApiPropertyOptional({ description: 'Jira link type name, for issue types that are not sub-tasks' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  linkType?: string;
}
