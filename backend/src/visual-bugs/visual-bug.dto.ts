import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const JIRA_KEY = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

export class PrepareVisualBugDto {
  @ApiProperty({ example: 'MOB-1200', description: 'Task the bug goes under; the bug goes into its project' })
  @Matches(JIRA_KEY, { message: 'parentKey must look like ABC-123' })
  parentKey: string;

  @ApiPropertyOptional({ description: 'Jira issue type id; the project default or a bug sub-task when absent' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  issueTypeId?: string;

  @ApiPropertyOptional({ description: 'Field values chosen in the dialog, by Jira field id, in create form' })
  @IsOptional()
  @IsObject()
  fieldValues?: Record<string, unknown>;
}

export class BugMarkDto {
  @ApiProperty() @IsNumber() x: number;
  @ApiProperty() @IsNumber() y: number;
  @ApiProperty() @IsNumber() width: number;
  @ApiProperty() @IsNumber() height: number;

  @ApiPropertyOptional({ description: 'Element key when the mark was picked from the UI tree' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  element?: string;
}

export class FileVisualBugDto extends PrepareVisualBugDto {
  @ApiPropertyOptional({ description: 'Jira link type name, for issue types that are not sub-tasks' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  linkType?: string;

  @ApiProperty({ description: 'What is wrong, after the [Automation] [feature] prefix' })
  @IsString()
  @MaxLength(250)
  essence: string;

  @ApiPropertyOptional({ description: 'Environment section; Vision writes it when empty' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  environment?: string;

  @ApiProperty() @IsString() @MaxLength(5000) steps: string;
  @ApiProperty() @IsString() @MaxLength(5000) actual: string;
  @ApiProperty() @IsString() @MaxLength(5000) expected: string;

  @ApiPropertyOptional({ type: [BugMarkDto], description: 'Marked areas of the checkpoint, in screenshot pixels' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BugMarkDto)
  marks?: BugMarkDto[];
}
