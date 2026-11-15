import { forwardRef, Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { BuildsModule } from '../builds/builds.module';
import { TestVariationsModule } from '../test-variations/test-variations.module';
import { A11yModule } from '../a11y/a11y.module';
import { UiTreeModule } from '../ui-tree/ui-tree.module';

@Module({
  imports: [forwardRef(() => BuildsModule), forwardRef(() => TestVariationsModule), A11yModule, UiTreeModule],
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
