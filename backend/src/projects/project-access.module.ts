import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ProjectAccessInterceptor } from './project-access.interceptor';
import { ProjectAccessService } from './project-access.service';

// Global: every route is checked (042), and a route that reads its body late (multipart) uses
// the interceptor again after its own.
@Global()
@Module({
  providers: [
    ProjectAccessService,
    ProjectAccessInterceptor,
    { provide: APP_INTERCEPTOR, useClass: ProjectAccessInterceptor },
  ],
  exports: [ProjectAccessService, ProjectAccessInterceptor],
})
export class ProjectAccessModule {}
