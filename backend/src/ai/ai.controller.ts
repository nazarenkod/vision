import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
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
}
