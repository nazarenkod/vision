import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { globalPipes } from '../../shared/strip-unknown-fields.pipe';
import { CreateTestRequestDto } from './create-test-request.dto';
import { CreateTestRequestMultipartDto } from './create-test-request-multipart.dto';
import { MAX_IGNORE_AREAS } from './ignore-area.dto';
import { UpdateIgnoreAreasDto } from './update-ignore-area.dto';

const areas = (count: number) => Array.from({ length: count }, (_, i) => ({ x: i, y: i, width: 10, height: 10 }));
const uuid = '3f7c1a52-2a4b-4d8e-9a51-0c2e6b1d7f90';

// the body as the API's own pipes see it, in the order the app sets them up
async function through(metatype: ArgumentMetadata['metatype'], body: unknown): Promise<unknown> {
  let value = body;
  for (const pipe of globalPipes()) value = await pipe.transform(value, { type: 'body', metatype });
  return value;
}

const routes: Array<[string, ArgumentMetadata['metatype'], (count: number) => unknown]> = [
  [
    'POST /test-runs',
    CreateTestRequestDto,
    (count) => ({
      imageBase64: 'x',
      name: 's',
      branchName: 'main',
      buildId: uuid,
      projectId: uuid,
      ignoreAreas: areas(count),
    }),
  ],
  [
    'POST /test-runs/multipart',
    CreateTestRequestMultipartDto,
    (count) => ({
      name: 's',
      branchName: 'main',
      buildId: uuid,
      projectId: uuid,
      ignoreAreas: JSON.stringify(areas(count)),
    }),
  ],
  ['POST /test-runs/ignoreAreas/update', UpdateIgnoreAreasDto, (count) => ({ ids: [uuid], ignoreAreas: areas(count) })],
  ['POST /test-runs/ignoreAreas/add', UpdateIgnoreAreasDto, (count) => ({ ids: [uuid], ignoreAreas: areas(count) })],
];

describe('ignore areas a request may hold (051)', () => {
  it('is 20', () => {
    expect(MAX_IGNORE_AREAS).toBe(20);
  });

  it('turns away more than 20 ignore areas on every route', async () => {
    for (const [route, metatype, body] of routes) {
      const refusal = await through(metatype, body(21)).then(
        () => `${route} took 21 areas`,
        (error: BadRequestException) => `${route}: ${JSON.stringify(error.getResponse())}`
      );
      expect(refusal).toContain(`${route}: `);
      expect(refusal).toContain('ignoreAreas must contain no more than 20 elements');
    }
  });

  it('takes up to 20 as before', async () => {
    for (const [, metatype, body] of routes) {
      await expect(through(metatype, body(20))).resolves.toBeDefined();
      await expect(through(metatype, body(0))).resolves.toBeDefined();
    }
  });

  it('turns away a huge list without checking every area first', async () => {
    const started = Date.now();
    await expect(through(CreateTestRequestDto, routes[0][2](100_000))).rejects.toThrow(BadRequestException);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
