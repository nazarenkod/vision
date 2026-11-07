import { readFileSync } from 'fs';
import path from 'path';
import { parseUiTree } from '../ui-tree/ui-tree.parser';
import { findViolations } from './a11y.rules';
import { DEFAULT_A11Y_NORMS } from './a11y-norms';
import { A11yJobInput, runA11yJob } from './a11y.job';

const fixture = (name: string) => readFileSync(path.join(__dirname, '../ui-tree/__fixtures__', name), 'utf8');

describe('runA11yJob', () => {
  it('finds the same issues after the job is copied to a worker thread', () => {
    const tree = parseUiTree(fixture('android-payment.xml'), { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });
    // a decoded screenshot is a Buffer here and arrives in the worker as a plain Uint8Array
    const data = Buffer.alloc(1080 * 2400 * 4, 255);
    for (let y = 1010; y < 1035; y++) data.fill(200, (y * 1080 + 50) * 4, (y * 1080 + 350) * 4);
    const image = { width: 1080, height: 2400, data };
    const input: A11yJobInput = { kind: 'a11y', tree, image, norms: DEFAULT_A11Y_NORMS };

    const inWorker = runA11yJob(structuredClone(input));

    expect(inWorker.violations).toEqual(findViolations(tree, image, DEFAULT_A11Y_NORMS));
    expect(inWorker.violations.map((v) => v.rule)).toContain('low-contrast');
  });
});
