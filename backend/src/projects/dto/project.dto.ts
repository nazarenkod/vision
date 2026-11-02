import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsNumber, IsBoolean, IsEnum, IsJSON, IsDate, IsOptional, IsUrl } from 'class-validator';
import { ImageComparison, Project } from '@prisma/client';
import { Type } from 'class-transformer';

// the variation group columns stay in the row (ADR-0003) but are no longer
// part of the API (022); nor is the shared Jira token and its email: Jira goes
// only with the acting person's own token (035, ADR-0025)
export class ProjectDto implements Omit<
  Project,
  'bulkApproveVariations' | 'bulkApproveGroupBy' | 'jiraToken' | 'jiraEmail'
> {
  @ApiProperty()
  @IsUUID()
  readonly id: string;

  @ApiProperty()
  @IsNumber()
  readonly buildsCounter: number;

  @ApiProperty()
  @IsString()
  readonly name: string;

  @ApiProperty()
  @IsString()
  readonly mainBranchName: string;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  readonly createdAt: Date;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  readonly updatedAt: Date;

  @ApiProperty()
  @IsBoolean()
  autoApproveFeature: boolean;

  @ApiProperty()
  @IsEnum(ImageComparison)
  imageComparison: ImageComparison;

  @ApiProperty()
  @IsNumber()
  maxBuildAllowed: number;

  @ApiProperty()
  @IsNumber()
  maxBranchLifetime: number;

  @ApiProperty()
  @IsJSON()
  imageComparisonConfig: string;

  @ApiPropertyOptional({ example: 'https://jira.example.com' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  jiraUrl: string | null;

  @ApiPropertyOptional({ example: 'Bug' })
  @IsOptional()
  @IsString()
  jiraIssueType: string | null;

  @ApiPropertyOptional({ description: 'UI tree comparison settings and project-wide element rules, as JSON' })
  @IsOptional()
  @IsString()
  uiTreeSettings: string | null;

  @ApiPropertyOptional({ example: 'Relates' })
  @IsOptional()
  @IsString()
  jiraLinkType: string | null;
}
