import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';
import { ProjectDto } from './project.dto';

export class UpdateProjectDto extends OmitType(ProjectDto, ['buildsCounter', 'createdAt', 'updatedAt']) {
  // The settings as the page loaded them (018). With them, a save is refused
  // when someone saved other settings since; without them it saves as before.
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  loadedSettings?: Record<string, unknown>;

  // save over someone else's changes after being told about them
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
