import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, { provide: UsersService, useValue: {} }, { provide: JwtService, useValue: {} }],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('never accepts a password against a restored placeholder', async () => {
    // vision-restore.sh leaves this instead of a hash for everyone but the master user
    expect(await service.compare('', '!restored')).toBe(false);
    expect(await service.compare('!restored', '!restored')).toBe(false);
  });
});
