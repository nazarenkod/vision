import { Module } from '@nestjs/common';
import { StaticModule } from '../static/static.module';
import { VisualBugsController } from './visual-bugs.controller';
import { VisualBugsService } from './visual-bugs.service';

@Module({
  imports: [StaticModule],
  providers: [VisualBugsService],
  controllers: [VisualBugsController],
})
export class VisualBugsModule {}
