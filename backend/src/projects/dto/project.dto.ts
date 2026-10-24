import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsNumber, IsBoolean, IsEnum, IsJSON, IsDate, IsOptional, IsUrl } from 'class-validator';
import { ImageComparison, Project } from '@prisma/client';
import { Type } from 'class-transformer';

export class ProjectDto implements Project {
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

  @ApiProperty()
  @IsBoolean()
  bulkApproveVariations: boolean;

  @ApiProperty()
  @IsString()
  bulkApproveGroupBy: string;

  @ApiPropertyOptional({ example: 'https://jira.example.com' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  jiraUrl: string | null;

  @ApiPropertyOptional({ description: 'Jira Cloud only: account email used with the API token' })
  @IsOptional()
  @IsString()
  jiraEmail: string | null;

  // write-only: responses carry jiraTokenSet instead; omit to keep, empty string to remove
  @ApiPropertyOptional({ writeOnly: true })
  @IsOptional()
  @IsString()
  jiraToken: string | null;

  @ApiPropertyOptional({ example: 'Bug' })
  @IsOptional()
  @IsString()
  jiraIssueType: string | null;

  @ApiPropertyOptional({ example: 'Relates' })
  @IsOptional()
  @IsString()
  jiraLinkType: string | null;
}
