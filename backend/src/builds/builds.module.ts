import { forwardRef, Module } from '@nestjs/common';
import { BuildsService } from './builds.service';
import { BuildsController } from './builds.controller';
import { UsersModule } from '../users/users.module';
import { TestRunsModule } from '../test-runs/test-runs.module';
import { SharedModule } from '../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { A11yModule } from '../a11y/a11y.module';
import { BuildOverviewService } from './build-overview.service';

@Module({
  imports: [
    SharedModule,
    UsersModule,
    forwardRef(() => TestRunsModule),
    AuthModule,
    forwardRef(() => ProjectsModule),
    A11yModule,
  ],
  providers: [BuildsService, BuildOverviewService],
  controllers: [BuildsController],
  exports: [BuildsService],
})
export class BuildsModule {}
