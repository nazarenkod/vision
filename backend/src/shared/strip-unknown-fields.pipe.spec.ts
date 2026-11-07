import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ModifyBuildDto } from '../builds/dto/build-modify.dto';
import { CreateTestRequestMultipartDto } from '../test-runs/dto/create-test-request-multipart.dto';
import { declaredFields, globalPipes, StripUnknownFieldsPipe } from './strip-unknown-fields.pipe';
import { AiController } from '../ai/ai.controller';
import { BackupsController } from '../backups/backups.controller';
import { BuildsController } from '../builds/builds.controller';
import { ProjectsController } from '../projects/projects.controller';
import { ReportsController } from '../reports/reports.controller';
import { TestRunsController } from '../test-runs/test-runs.controller';
import { TestVariationsController } from '../test-variations/test-variations.controller';
import { UsersController } from '../users/users.controller';
import { VisualBugsController } from '../visual-bugs/visual-bugs.controller';
import { AnalyticsController } from '../analytics/analytics.controller';
import { StaticController } from '../static/static.controller';
import { HealthController } from '../health/health.controller';
import { OllamaController } from '../compare/libs/vlm/providers/ollama/ollama.controller';

const body = (metatype: unknown, data?: string): ArgumentMetadata => ({
  type: 'body',
  metatype: metatype as never,
  data,
});
const pipe = new StripUnknownFieldsPipe();

async function throughGlobalPipes(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
  for (const each of globalPipes()) value = await each.transform(value, metadata);
  return value;
}

describe('StripUnknownFieldsPipe', () => {
  it('drops the keys the DTO does not declare, so they never reach Prisma', () => {
    const sent = { isRunning: false, user: { update: { role: 'admin' } }, projectId: 'another-team' };

    expect(pipe.transform(sent, body(ModifyBuildDto))).toEqual({ isRunning: false });
  });

  it('keeps every declared field, including the ones a parent class declares', () => {
    const fields = declaredFields(CreateTestRequestMultipartDto);

    expect([...fields].sort()).toEqual(
      expect.arrayContaining(['buildId', 'projectId', 'name', 'image', 'merge', 'ignoreAreas'])
    );
  });

  it('leaves alone what has no DTO: a single field, an array of ids, a body typed inline', () => {
    const ids = ['a', 'b'];
    const inline = { clientId: 'x', clientSecret: 'y' };

    expect(pipe.transform('secret-password', body(String, 'password'))).toBe('secret-password');
    expect(pipe.transform(ids, body(Array))).toBe(ids);
    expect(pipe.transform(inline, body(Object))).toBe(inline);
    expect(pipe.transform({ id: 'p' }, { type: 'param', metatype: String, data: 'id' })).toEqual({ id: 'p' });
  });

  it('keeps a body that is not an object as it came, for validation to refuse', () => {
    expect(pipe.transform(undefined, body(ModifyBuildDto))).toBeUndefined();
    expect(pipe.transform([{ isRunning: true }], body(ModifyBuildDto))).toEqual([{ isRunning: true }]);
  });

  it('still lets the multipart upload read its form: file, merge and ignore areas as sent', async () => {
    const form = {
      buildId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      projectId: '16fd2706-8baf-433b-82eb-8c7fada847da',
      name: 'Payment',
      branchName: 'master',
      merge: 'true',
      diffTollerancePercent: '0.5',
      ignoreAreas: '[{"x":1,"y":2,"width":3,"height":4}]',
      image: { buffer: Buffer.from('png') },
      user: { connect: { email: 'x' } },
    };
    const metadata = body(CreateTestRequestMultipartDto);

    const afterGlobal = await throughGlobalPipes(form, metadata);
    const dto = (await new ValidationPipe({ transform: true, forbidUnknownValues: true }).transform(
      afterGlobal,
      metadata
    )) as CreateTestRequestMultipartDto;

    expect(dto).toMatchObject({ merge: true, diffTollerancePercent: 0.5, image: { buffer: Buffer.from('png') } });
    expect(dto.ignoreAreas).toEqual([{ x: 1, y: 2, width: 3, height: 4 }]);
    expect(dto).not.toHaveProperty('user');
  });

  it('runs validation on the body as sent, before anything is dropped', async () => {
    await expect(throughGlobalPipes({ isRunning: 'yes' }, body(ModifyBuildDto))).rejects.toThrow();
    expect(await throughGlobalPipes({ isRunning: true, number: 9 }, body(ModifyBuildDto))).toEqual({ isRunning: true });
  });
});

describe('request bodies of every route', () => {
  const CONTROLLERS = [
    AiController,
    AnalyticsController,
    BackupsController,
    BuildsController,
    HealthController,
    OllamaController,
    ProjectsController,
    ReportsController,
    StaticController,
    TestRunsController,
    TestVariationsController,
    UsersController,
    VisualBugsController,
  ];
  // bodies that are not a DTO class: each route checks these values itself
  const CHECKED_BY_HAND = [
    'BackupsController.connect',
    'BackupsController.saveSettings',
    'ReportsController.create',
    'TestRunsController.approveTestRun',
    'TestRunsController.reject',
    'TestRunsController.delete',
    'UsersController.delete',
  ];
  const bodies = CONTROLLERS.flatMap((controller) =>
    Object.getOwnPropertyNames(controller.prototype)
      .filter((name) => name !== 'constructor')
      .flatMap((name) => {
        const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, name) ?? {};
        const types = Reflect.getMetadata('design:paramtypes', controller.prototype, name) ?? [];
        return Object.entries(args as Record<string, { index: number; data?: string }>)
          .filter(([key, arg]) => key.startsWith(`${RouteParamtypes.BODY}:`) && arg.data === undefined)
          .map(([, arg]) => ({ route: `${controller.name}.${name}`, metatype: types[arg.index] }));
      })
  );

  it('finds the bodies to check', () => {
    expect(bodies.length).toBeGreaterThan(20);
  });

  it('come as a DTO class that declares its fields, or are on the checked-by-hand list', () => {
    const undeclared = bodies
      .filter(({ route, metatype }) => !CHECKED_BY_HAND.includes(route) && !declaredFields(metatype))
      .map(({ route, metatype }) => `${route} (${metatype?.name})`);

    expect(undeclared).toEqual([]);
  });
});
