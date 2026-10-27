import { Module } from '@nestjs/common';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';

@Module({
  providers: [BackupsService],
  controllers: [BackupsController],
})
export class BackupsModule {}
