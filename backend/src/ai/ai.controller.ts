import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../shared/current-user.decorator';
import { AiService } from './ai.service';
import { AiFeaturesService } from './ai-features.service';

class GroupSummaryRequestDto {
  @ApiProperty()
  @IsUUID()
  buildId: string;

  @ApiProperty()
  @IsString()
  groupId: string;
}

class LabelSuggestionRequestDto {
  @ApiProperty()
  @IsUUID()
  testRunId: string;
}

class DraftAreaDto {
  @ApiProperty() @IsNumber() x: number;
  @ApiProperty() @IsNumber() y: number;
  @ApiProperty() @IsNumber() width: number;
  @ApiProperty() @IsNumber() height: number;
}

class BugDraftRequestDto {
  @ApiProperty()
  @IsUUID()
  testRunId: string;

  @ApiProperty({ description: 'What is wrong, in the person’s words' })
  @IsString()
  @MaxLength(2000)
  note: string;

  @ApiProperty({ required: false, type: [DraftAreaDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DraftAreaDto)
  marks?: DraftAreaDto[];

  @ApiProperty({ required: false, type: [String], description: 'The changes the person ticked, as text' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  changes?: string[];

  @ApiProperty({ required: false, description: '1 for the first draft, more for Ask again' })
  @IsOptional()
  @IsInt()
  @Min(1)
  attempt?: number;
}

@Controller('ai')
@ApiTags('ai')
export class AiController {
  constructor(
    private aiService: AiService,
    private aiFeaturesService: AiFeaturesService
  ) {}

  @Get('status')
  @ApiOkResponse({ description: 'Whether AI is configured, which model, and today’s usage' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  status() {
    return this.aiService.status();
  }

  @Post('group-summary')
  @ApiOkResponse({ description: 'What changed in a change group and whether it looks intended' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  groupSummary(@Body() body: GroupSummaryRequestDto) {
    return this.aiFeaturesService.summarizeGroup(body.buildId, body.groupId);
  }

  @Post('a11y-labels')
  @ApiOkResponse({ description: 'Proposed labels for the unlabeled controls of a test run' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  a11yLabels(@Body() body: LabelSuggestionRequestDto) {
    return this.aiFeaturesService.suggestLabels(body.testRunId);
  }

  @Post('bug-draft')
  @ApiOkResponse({ description: 'A draft of a bug’s title essence, steps, actual and expected result (Gemini)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  bugDraft(@CurrentUser() user: User, @Body() body: BugDraftRequestDto) {
    return this.aiFeaturesService.draftBug(body, user?.id);
  }
}
