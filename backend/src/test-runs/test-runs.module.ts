import { forwardRef, Module } from '@nestjs/common';
import { TestRunsService } from './test-runs.service';
import { SharedModule } from '../shared/shared.module';
import { TestRunsController } from './test-runs.controller';
import { TestVariationsModule } from '../test-variations/test-variations.module';
import { CompareModule } from '../compare/compare.module';
import { StaticModule } from '../static/static.module';
import { UiTreeModule } from '../ui-tree/ui-tree.module';

@Module({
  imports: [SharedModule, forwardRef(() => TestVariationsModule), CompareModule, StaticModule, UiTreeModule],
  providers: [TestRunsService],
  controllers: [TestRunsController],
  exports: [TestRunsService],
})
export class TestRunsModule {}
