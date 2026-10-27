import { Role } from '@prisma/client';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { BackupsController } from './backups.controller';

describe('BackupsController', () => {
  it('lets only admins manage backups', () => {
    // set on the class, so every endpoint, present and future, needs a signed-in admin
    expect(Reflect.getMetadata('roles', BackupsController)).toEqual([Role.admin]);
    expect(Reflect.getMetadata(GUARDS_METADATA, BackupsController)).toEqual([JwtAuthGuard, RoleGuard]);
    for (const name of Object.getOwnPropertyNames(BackupsController.prototype).filter((key) => key !== 'constructor')) {
      expect(Reflect.getMetadata('roles', BackupsController.prototype[name])).toBeUndefined();
    }
  });
});
