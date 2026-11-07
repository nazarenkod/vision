import { ApiProperty } from '@nestjs/swagger';
import { IgnoreAreaDto, MAX_IGNORE_AREAS } from './ignore-area.dto';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested, IsString } from 'class-validator';

export class UpdateIgnoreAreasDto {
  @ApiProperty({ type: String, isArray: true })
  @IsString({ each: true })
  readonly ids: string[];

  @ApiProperty({ type: IgnoreAreaDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(MAX_IGNORE_AREAS)
  @Type(() => IgnoreAreaDto)
  @ValidateNested({ each: true })
  readonly ignoreAreas: IgnoreAreaDto[];
}
