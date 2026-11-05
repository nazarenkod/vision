import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { StaticService } from './static.service';
import { StaticFactoryService } from './static.factory';
import { StaticController } from './static.controller';
import { HddService } from './hdd/hdd.service';
import { FileLinksInterceptor } from './file-links.interceptor';

@Module({
  imports: [ConfigModule],
  // every answer behind a guard carries the signatures of the images it names (043)
  providers: [
    StaticService,
    StaticFactoryService,
    HddService,
    { provide: APP_INTERCEPTOR, useClass: FileLinksInterceptor },
  ],
  exports: [StaticService, HddService],
  controllers: [StaticController],
})
export class StaticModule {}
