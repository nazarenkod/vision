import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsString,
  IsArray,
  ValidateNested,
  IsIn,
  IsInt,
  Min,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { BaselineDataDto } from '../../shared/dto/baseline-data.dto';
import { IgnoreAreaDto, MAX_IGNORE_AREAS } from './ignore-area.dto';
import { UI_TREE_FORMATS, UiTreeFormat } from '../../ui-tree/ui-tree.types';

export class CreateTestRequestDto extends BaselineDataDto {
  @ApiProperty()
  @IsUUID()
  buildId: string;

  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  diffTollerancePercent?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  merge?: boolean;

  @ApiPropertyOptional({ type: IgnoreAreaDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_IGNORE_AREAS)
  @Type(() => IgnoreAreaDto)
  @ValidateNested({ each: true })
  ignoreAreas?: IgnoreAreaDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    description:
      'UI tree of the screen: Appium page source (XML) or the web page (HTML, 050); base64, optionally gzipped',
  })
  @IsOptional()
  @IsString()
  uiTree?: string;

  @ApiPropertyOptional({ enum: UI_TREE_FORMATS, description: 'Detected from the tree when omitted' })
  @IsOptional()
  @IsIn(UI_TREE_FORMATS)
  uiTreeFormat?: UiTreeFormat;

  @ApiPropertyOptional({ description: 'Version of the browser a web screen was taken in; not part of the check (050)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  browserVersion?: string;

  @ApiPropertyOptional({ description: 'Android screen density in dpi, for dp-based checks' })
  @IsOptional()
  @IsInt()
  @Min(1)
  deviceDensity?: number;

  @ApiPropertyOptional({ description: 'Android activity of the screen, helps tell screens apart' })
  @IsOptional()
  @IsString()
  uiActivity?: string;

  @ApiPropertyOptional({ description: 'Overrides the project setting for this screenshot' })
  @IsOptional()
  @IsBoolean()
  excludeSystemBars?: boolean;

  @ApiPropertyOptional({
    description:
      'Feature the screen belongs to; names bugs filed from the review. Not part of the check: baselines stay',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  featureName?: string;
}
