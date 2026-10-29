import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AddElementRuleDto {
  @ApiProperty({ enum: ['screen', 'project'], description: 'This screen only, or every screen of the project' })
  @IsIn(['screen', 'project'])
  scope: 'screen' | 'project';

  @ApiProperty({ example: 'id:balance', description: 'id:…, class:… or text:… (text:/regex/ allowed)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  selector: string;

  @ApiProperty({
    enum: ['ignore', 'tolerate', 'compare'],
    description: 'compare: only the elements such rules match are compared on this screen',
  })
  @IsIn(['ignore', 'tolerate', 'compare'])
  action: 'ignore' | 'tolerate' | 'compare';

  @ApiPropertyOptional({ description: 'tolerate: share of the element that may change, in percent' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxDiffPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class RemoveElementRuleDto {
  @ApiProperty({ enum: ['screen', 'project'] })
  @IsIn(['screen', 'project'])
  scope: 'screen' | 'project';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ruleId: string;
}

export class ReplaceAreaWithElementDto {
  @ApiProperty({ description: "id of one of the run's saved ignore areas" })
  @IsString()
  @IsNotEmpty()
  areaId: string;

  @ApiProperty({ example: 'id:banner', description: 'the element the area stands for' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  selector: string;
}
