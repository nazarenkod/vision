import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { createHash } from 'crypto';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../shared/roles.decorator';
import { CurrentUser } from '../shared/current-user.decorator';
import { ReportLinkDto, ReportsService } from './reports.service';

@Controller()
@ApiTags('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  // only editors and admins put a build in front of people without an account (REQ-031-69)
  @Post('builds/:id/report-links')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  create(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) buildId: string,
    @Body() body: { sections?: string[]; language?: string; days?: number }
  ): Promise<ReportLinkDto> {
    return this.reportsService.create(buildId, body ?? {}, user);
  }

  @Get('builds/:id/report')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  report(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) buildId: string) {
    return this.reportsService.reportFor(buildId, user);
  }

  @Get('builds/:id/report-links')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  list(@Param('id', new ParseUUIDPipe()) buildId: string): Promise<ReportLinkDto[]> {
    return this.reportsService.list(buildId);
  }

  @Delete('report-links/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  revoke(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.reportsService.revoke(id, user);
  }

  /**
   * The one route that serves data without signing in (ADR-0022). The page asks
   * every few seconds; an unchanged report costs a 304.
   */
  @Get('public/reports/:token')
  async publicReport(
    @Param('token') token: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const report = await this.reportsService.publicReport(token);
    const body = JSON.stringify(report);
    const etag = `"${createHash('sha1').update(body).digest('base64url')}"`;
    res.setHeader('ETag', etag);
    // the page is served from another origin than the API: let it read the tag
    res.setHeader('Access-Control-Expose-Headers', 'ETag');
    res.setHeader('Cache-Control', 'no-cache');
    if (ifNoneMatch === etag) {
      res.status(304).end();
      return;
    }
    res.status(200).type('application/json').send(body);
  }
}
