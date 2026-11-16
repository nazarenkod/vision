import { TestVariation } from '@prisma/client';
import { generateTestRun } from '../../_data_';
import { TestRunResultDto } from './testRunResult.dto';

describe('TestRunResultDto', () => {
  it('leaves out capture warnings kept on the run', () => {
    // rows from before spec 020 still hold them
    const testRun = generateTestRun({
      captureWarnings: '[{"kind":"loading","message":"Taken before the screen settled"}]',
    });

    const result = new TestRunResultDto(testRun, { projectId: 'p1', baselineName: 'b.png' } as TestVariation);

    expect(result).not.toHaveProperty('warnings');
    expect(result).not.toHaveProperty('captureWarnings');
  });
});
