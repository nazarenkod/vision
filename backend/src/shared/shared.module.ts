import { forwardRef, Global, Module } from '@nestjs/common';
import { EventsGateway } from '../shared/events/events.gateway';
import { TasksService } from './tasks/tasks.service';
import { SecretsAtRestService } from './secrets-at-rest.service';
import { TestVariationsModule } from '../test-variations/test-variations.module';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  providers: [EventsGateway, TasksService, SecretsAtRestService],
  exports: [EventsGateway],
  imports: [forwardRef(() => TestVariationsModule), AuthModule],
  controllers: [],
})
export class SharedModule {}
