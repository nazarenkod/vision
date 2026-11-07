import { Module } from '@nestjs/common';
import { StaticModule } from '../static/static.module';
import { UiTreeService } from './ui-tree.service';
import { CompareModule } from '../compare/compare.module';

@Module({
  imports: [StaticModule, CompareModule],
  providers: [UiTreeService],
  exports: [UiTreeService],
})
export class UiTreeModule {}
