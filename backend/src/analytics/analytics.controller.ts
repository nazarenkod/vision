import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get(':projectId')
  @ApiQuery({ name: 'days', required: false, description: 'Window in days, 7 to 730 (default 90)' })
  @ApiOkResponse({
    description: 'Unused baselines, unstable screens, accessibility hotspots, noise, capture quality, device coverage',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getInsights(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Query('days') days?: string) {
    const window = Math.min(730, Math.max(7, Math.round(Number(days) || 90)));
    return this.analyticsService.projectInsights(projectId, window);
  }
}
