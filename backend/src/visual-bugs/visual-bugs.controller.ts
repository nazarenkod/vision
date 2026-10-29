import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { CurrentUser } from '../shared/current-user.decorator';
import { Roles } from '../shared/roles.decorator';
import { FileVisualBugDto, PrepareVisualBugDto } from './visual-bug.dto';
import { VisualBugsService } from './visual-bugs.service';

@Controller('test-runs')
@ApiTags('test-runs')
export class VisualBugsController {
  constructor(private visualBugsService: VisualBugsService) {}

  @Post(':id/bug/prepare')
  @ApiOkResponse({ description: 'The task, its issue and link types, and what a bug from the comparison asks for' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  prepare(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: PrepareVisualBugDto) {
    return this.visualBugsService.prepare(id, body, user?.id);
  }

  @Post(':id/bug')
  @ApiOkResponse({ description: 'Files a Jira bug about this screenshot under the given task' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.editor)
  file(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: FileVisualBugDto) {
    return this.visualBugsService.file(id, body, user?.id);
  }

  @Get(':id/bugs')
  @ApiOkResponse({ description: 'Bugs filed from the comparison for this check, on every device and build' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  forCheck(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.visualBugsService.forCheck(id);
  }
}
