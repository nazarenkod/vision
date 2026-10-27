import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../shared/roles.decorator';
import { BackupsService } from './backups.service';

@ApiTags('backups')
@Controller('backups')
export class BackupsController {
  constructor(private backupsService: BackupsService) {}

  @Get('status')
  @ApiOkResponse({ description: 'Whether backups are set up, the last successful one, and a warning for admins' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin)
  status() {
    return this.backupsService.status();
  }
}
