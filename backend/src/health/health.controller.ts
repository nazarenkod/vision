import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { NoProjectData } from '../projects/project-access';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private readonly prismaService: PrismaService
  ) {}

  @NoProjectData()
  @Get()
  @ApiOkResponse({ type: Object })
  @HealthCheck()
  check() {
    // the query result is what the indicator reported before Terminus 12 typed it: the answer stays the same
    return this.health.check([
      () => this.prismaService.$queryRaw`SELECT 1` as Promise<unknown> as Promise<HealthIndicatorResult>,
    ]);
  }
}
