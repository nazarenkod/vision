import {
  Body,
  Controller,
  INestApplication,
  Patch,
  Post,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ModifyBuildDto } from '../builds/dto/build-modify.dto';
import { CreateTestRequestMultipartDto } from '../test-runs/dto/create-test-request-multipart.dto';
import { FileToBodyInterceptor } from './fite-to-body.interceptor';
import { globalPipes } from './strip-unknown-fields.pipe';

// The same decorators as the real routes, answering with what their handler would get.
@Controller()
class EchoController {
  @Patch('builds')
  build(@Body() dto: ModifyBuildDto) {
    return { body: dto ?? null };
  }

  @Post('multipart')
  @UseInterceptors(FileInterceptor('image'), FileToBodyInterceptor)
  @UsePipes(new ValidationPipe({ transform: true, forbidUnknownValues: true }))
  upload(@Body() dto: CreateTestRequestMultipartDto) {
    const { image, ...rest } = dto;
    return { ...rest, imageBytes: image?.buffer?.length ?? null };
  }
}

describe('request bodies over HTTP, through the global pipes', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [EchoController] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(...globalPipes());
    await app.init();
  });

  afterAll(() => app.close());

  it('hands the handler only the declared fields of a JSON body', async () => {
    const response = await request(app.getHttpServer())
      .patch('/builds')
      .send({ isRunning: false, user: { update: { role: 'admin' } }, projectId: 'another-team' })
      .expect(200);

    expect(response.body).toEqual({ body: { isRunning: false } });
  });

  it('still answers an empty PATCH, as released SDKs send to stop a build', async () => {
    const response = await request(app.getHttpServer()).patch('/builds').expect(200);

    expect(response.body).toEqual({ body: null });
  });

  it('reads a multipart upload as before: the file, merge, tolerance and ignore areas', async () => {
    const response = await request(app.getHttpServer())
      .post('/multipart')
      .field('buildId', '7c9e6679-7425-40de-944b-e07fc1f90ae7')
      .field('projectId', '16fd2706-8baf-433b-82eb-8c7fada847da')
      .field('name', 'Payment')
      .field('branchName', 'master')
      .field('merge', 'true')
      .field('diffTollerancePercent', '0.5')
      .field('ignoreAreas', '[{"x":1,"y":2,"width":3,"height":4}]')
      .field('somethingOld', 'kept by nobody')
      .attach('image', Buffer.from('not really a png'), 'shot.png')
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'Payment',
      merge: true,
      diffTollerancePercent: 0.5,
      ignoreAreas: [{ x: 1, y: 2, width: 3, height: 4 }],
      imageBytes: 16,
    });
    expect(response.body).not.toHaveProperty('somethingOld');
  });
});
