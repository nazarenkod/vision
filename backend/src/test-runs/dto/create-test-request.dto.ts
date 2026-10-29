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
} from 'class-validator';
import { BaselineDataDto } from '../../shared/dto/baseline-data.dto';
import { IgnoreAreaDto } from './ignore-area.dto';

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
  @Type(() => IgnoreAreaDto)
  @ValidateNested({ each: true })
  ignoreAreas?: IgnoreAreaDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Appium page source of the screen: base64 of the XML, optionally gzipped' })
  @IsOptional()
  @IsString()
  uiTree?: string;

  @ApiPropertyOptional({ enum: ['appium-android', 'appium-ios'], description: 'Detected from the XML when omitted' })
  @IsOptional()
  @IsIn(['appium-android', 'appium-ios'])
  uiTreeFormat?: 'appium-android' | 'appium-ios';

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
