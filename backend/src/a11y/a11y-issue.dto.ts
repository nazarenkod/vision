import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const JIRA_KEY = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

export class A11yIssueRefDto {
  @ApiProperty({ description: 'Issue id from the accessibility report (rule|element)' })
  @IsString()
  @IsNotEmpty()
  violationId: string;

  @ApiPropertyOptional({
    description: 'Every issue of one problem (same rule, same component); acted on together, one bug for all',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  violationIds?: string[];
}

/** The issues a request acts on: the whole problem when given, else the one issue. */
export const issueIds = (body: A11yIssueRefDto): string[] =>
  body.violationIds?.length ? body.violationIds : [body.violationId];

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

  @ApiPropertyOptional({
    description: 'Field values chosen in the dialog, by Jira field id, in the form the create call takes',
  })
  @IsOptional()
  @IsObject()
  fieldValues?: Record<string, unknown>;
}

export class FileA11yBugDto extends PrepareA11yBugDto {
  @ApiPropertyOptional({ description: 'Jira link type name, for issue types that are not sub-tasks' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  linkType?: string;
}
