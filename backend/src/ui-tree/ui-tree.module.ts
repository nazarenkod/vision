import { Module } from '@nestjs/common';
import { StaticModule } from '../static/static.module';
import { UiTreeService } from './ui-tree.service';
import { CompareModule } from '../compare/compare.module';
import { ScreenSearchService } from './screen-search.service';
import { TextLocatorService } from './text-locator.service';

@Module({
  imports: [StaticModule, CompareModule],
  providers: [UiTreeService, ScreenSearchService, TextLocatorService],
  exports: [UiTreeService, ScreenSearchService],
})
export class UiTreeModule {}
