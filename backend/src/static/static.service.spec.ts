import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { StaticService } from './static.service';
import { ConfigService } from '@nestjs/config';
import { StaticModule } from './static.module';

// StaticController checks report links (043); the app has PrismaService globally
@Global()
@Module({ providers: [{ provide: PrismaService, useValue: {} }], exports: [PrismaService] })
class PrismaForStatic {}

describe('StaticService', () => {
  let service: StaticService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {},
        },
      ],
      imports: [StaticModule, PrismaForStatic],
    }).compile();

    service = module.get<StaticService>(StaticService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
