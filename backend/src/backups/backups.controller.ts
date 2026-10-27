import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../shared/roles.decorator';
import { BackupsService } from './backups.service';

// Backups hold every project's data, so only admins see or change them.
@ApiTags('backups')
@ApiBearerAuth()
@Controller('backups')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.admin)
export class BackupsController {
  constructor(private backupsService: BackupsService) {}

  @Get('status')
  @ApiOkResponse({ description: 'Whether backups are set up, the last successful one, and a warning for admins' })
  status() {
    return this.backupsService.status();
  }

  @Get()
  @ApiOkResponse({ description: 'Status, Google Drive connection (no secrets), settings and the backups in Drive' })
  overview() {
    return this.backupsService.overview();
  }

  @Post('drive/connect')
  @ApiOkResponse({ description: 'A code to enter at the verification URL with the Google account' })
  connect(@Body() body: { clientId: string; clientSecret: string }) {
    return this.backupsService.connect(body?.clientId, body?.clientSecret);
  }

  @Post('drive/poll')
  @ApiOkResponse({ description: 'pending, connected (with the email) or failed (with the reason)' })
  poll() {
    return this.backupsService.poll();
  }

  @Post('drive/test')
  @ApiOkResponse({ description: 'Whether the backup folder in Drive is reachable' })
  test() {
    return this.backupsService.test();
  }

  @Delete('drive')
  @ApiOkResponse({ description: 'Forgets the Google Drive connection' })
  disconnect() {
    return this.backupsService.disconnect();
  }

  @Put('settings')
  @ApiOkResponse({ description: 'Daily time (HH:MM, server time zone) and database backups kept in Drive' })
  saveSettings(@Body() body: { time: string; keep: number }) {
    return this.backupsService.saveSettings(body);
  }

  @Post('run')
  @ApiOkResponse({ description: 'Asks the host script to back up within 5 minutes' })
  run() {
    return this.backupsService.requestBackup();
  }
}
