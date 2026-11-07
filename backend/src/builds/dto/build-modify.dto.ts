import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ModifyBuildDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly ciBuildId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  readonly isRunning?: boolean;
}

export type BuildChanges = Pick<ModifyBuildDto, 'ciBuildId' | 'isRunning'>;

/**
 * The only build fields a PATCH may change. The body goes to Prisma as `data`, where any other key
 * is a write: `user: { update: { role: 'admin' } }` made an editor an admin and `projectId` moved a
 * build into another team's project (VIS-SEC-001). So fields are picked, never passed on.
 */
export function buildChanges(body: unknown): BuildChanges {
  const changes: { ciBuildId?: string; isRunning?: boolean } = {};
  if (!body || typeof body !== 'object') return changes;
  const { ciBuildId, isRunning } = body as Record<string, unknown>;
  if (typeof ciBuildId === 'string') changes.ciBuildId = ciBuildId;
  if (typeof isRunning === 'boolean') changes.isRunning = isRunning;
  return changes;
}
