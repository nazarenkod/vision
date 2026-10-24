import { Module } from '@nestjs/common';
import { StaticModule } from '../static/static.module';
import { UiTreeModule } from '../ui-tree/ui-tree.module';
import { A11yIssuesService } from './a11y-issues.service';

@Module({
  imports: [StaticModule, UiTreeModule],
  providers: [A11yIssuesService],
  exports: [A11yIssuesService],
})
export class A11yModule {}
