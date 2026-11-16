import { Module } from '@nestjs/common';
import { BuildsModule } from '../builds/builds.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [BuildsModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
