import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TextPart } from '../../ui-tree/variable-text';

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
    enum: ['ignore', 'tolerate', 'compare', 'variable'],
    description:
      'compare: only the elements such rules match are compared on this screen; ' +
      'variable: the pixels are left out and the text is checked against parts',
  })
  @IsIn(['ignore', 'tolerate', 'compare', 'variable'])
  action: 'ignore' | 'tolerate' | 'compare' | 'variable';

  @ApiPropertyOptional({
    description: 'variable: the text as fixed parts and places with a pattern',
    example: [{ text: 'Updated at ' }, { pattern: '\\d+:\\d{2}', sample: '14:07' }],
  })
  @IsOptional()
  @IsArray()
  parts?: TextPart[];

  @ApiPropertyOptional({ description: 'a rule of the same scope this one takes the place of, in the same write' })
  @IsOptional()
  @IsString()
  replacesRuleId?: string;

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
