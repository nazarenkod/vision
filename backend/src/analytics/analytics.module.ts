import { Module } from '@nestjs/common';
import { UiTreeModule } from '../ui-tree/ui-tree.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [UiTreeModule],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
