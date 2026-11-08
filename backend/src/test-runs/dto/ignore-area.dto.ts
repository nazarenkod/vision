import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

// Each area is a pass over the screenshot in a comparison worker: a million of them held a worker
// for its whole time limit (VIS-SEC-005). A screen has a few; 20 leaves room (051, owner 2026-11-07).
export const MAX_IGNORE_AREAS = 20;

export class IgnoreAreaDto {
  @ApiProperty()
  @IsNumber()
  readonly x: number;

  @ApiProperty()
  @IsNumber()
  readonly y: number;

  @ApiProperty()
  @IsNumber()
  readonly width: number;

  @ApiProperty()
  @IsNumber()
  readonly height: number;
}
