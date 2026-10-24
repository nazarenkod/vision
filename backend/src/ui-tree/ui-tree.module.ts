import { Module } from '@nestjs/common';
import { StaticModule } from '../static/static.module';
import { UiTreeService } from './ui-tree.service';

@Module({
  imports: [StaticModule],
  providers: [UiTreeService],
  exports: [UiTreeService],
})
export class UiTreeModule {}
