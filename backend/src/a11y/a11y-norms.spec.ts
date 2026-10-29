import { readFileSync } from 'fs';
import path from 'path';
import { parseUiTree } from '../ui-tree/ui-tree.parser';
import { buildReport, findViolations } from './a11y.rules';
import { applyNorms, DEFAULT_A11Y_NORMS, parseA11yNorms } from './a11y-norms';
import { A11yViolation } from './a11y.types';
import { facetsOf, problemKeyOf } from './a11y-problems';

const fixture = (name: string) => readFileSync(path.join(__dirname, '../ui-tree/__fixtures__', name), 'utf8');
const tree = parseUiTree(fixture('android-payment.xml'), { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });

// a report received while the project still had 48 dp: btn_help 35.8 dp, btn_scan_qr 34.3 dp
const received = buildReport(tree, findViolations(tree), null);

const contrastIssue = (ratio: number, required: number): A11yViolation => ({
  id: 'low-contrast|id:tv_fee',
  rule: 'low-contrast',
  severity: 'warning',
  title: 'Low text contrast',
  message: `Text "Fee" (id/tv_fee): ${ratio.toFixed(1)} : 1, needs ${required} : 1.`,
  nodeKey: 'id:tv_fee',
  resourceId: 'com.bank.app:id/tv_fee',
  className: 'android.widget.TextView',
  label: 'Fee',
  bounds: { x: 0, y: 0, width: 10, height: 10 },
  // as reports from before 026 have it: no word on large text
  details: { ratio, required },
});

describe('parseA11yNorms', () => {
  it("reads the project's touch target per platform", () => {
    expect(parseA11yNorms({ touchTargetAndroid: 40 })).toEqual({ ...DEFAULT_A11Y_NORMS, touchTargetAndroid: 40 });
    expect(parseA11yNorms({ touchTargetIos: 40 })).toMatchObject({ touchTargetAndroid: 48, touchTargetIos: 40 });
    expect(parseA11yNorms(undefined)).toEqual(DEFAULT_A11Y_NORMS);
  });

  it('falls back to the default for a norm out of range', () => {
    expect(
      parseA11yNorms({
        touchTargetAndroid: 10,
        touchTargetIos: 40.5,
        contrast: 9,
        contrastLarge: '3',
        disabledRules: ['x'],
      })
    ).toEqual(DEFAULT_A11Y_NORMS);
  });
});

describe('applyNorms', () => {
  it('hides issues a looser norm lets pass in a received report', () => {
    const report = applyNorms(received, { ...DEFAULT_A11Y_NORMS, touchTargetAndroid: 35 });
    const touch = report.violations.filter((v) => v.rule === 'touch-target');
    expect(touch.map((v) => v.nodeKey)).toEqual(['id:com.bank.app:id/btn_scan_qr']);
    expect(touch[0].message).toContain('minimum is 35 × 35 dp');
    expect(touch[0].details).toMatchObject({ min: 35, unit: 'dp' });
    expect(report.summary.total).toBe(received.summary.total - 1);
  });

  it('shows nothing new when a norm gets stricter: the tree is not checked again', () => {
    const report = applyNorms(received, { ...DEFAULT_A11Y_NORMS, touchTargetAndroid: 60 });
    expect(report.violations.map((v) => v.id)).toEqual(received.violations.map((v) => v.id));
    expect(report.violations.find((v) => v.rule === 'touch-target').message).toContain('minimum is 60 × 60 dp');
  });

  it('hides issues of rules the project turned off, in the counts too', () => {
    const report = applyNorms(received, { ...DEFAULT_A11Y_NORMS, disabledRules: ['missing-label'] });
    expect(report.violations.some((v) => v.rule === 'missing-label')).toBe(false);
    expect(report.summary.total).toBe(received.summary.total - 1);
  });

  it('does not count a fixed issue that only a changed norm took away', () => {
    const baseline = findViolations(tree);
    const report = applyNorms(buildReport(tree, [], baseline), { ...DEFAULT_A11Y_NORMS, touchTargetAndroid: 30 });
    expect(report.fixed.some((v) => v.rule === 'touch-target')).toBe(false);
  });

  it('tells large text from body text in reports from before 026', () => {
    const report = {
      ...received,
      violations: [
        { ...contrastIssue(3.5, 3), status: 'new' as const },
        { ...contrastIssue(3.5, 4.5), status: 'new' as const },
      ],
    };
    const shown = applyNorms(report, { ...DEFAULT_A11Y_NORMS, contrastLarge: 4 });
    // large text now needs 4 : 1 and fails; body text still needs 4.5 : 1
    expect(shown.violations.map((v) => v.details.required)).toEqual([4, 4.5]);
    // body text passes a 3 : 1 norm, large text still fails its own
    const looser = applyNorms(report, { ...DEFAULT_A11Y_NORMS, contrast: 3, contrastLarge: 4 });
    expect(looser.violations.map((v) => v.details)).toEqual([expect.objectContaining({ required: 4, large: true })]);
  });

  it("keeps the issue's id and measured size whatever the norm", () => {
    const before = received.violations.find((v) => v.nodeKey.endsWith('btn_scan_qr'));
    const after = applyNorms(received, { ...DEFAULT_A11Y_NORMS, touchTargetAndroid: 40 }).violations.find((v) =>
      v.nodeKey.endsWith('btn_scan_qr')
    );
    expect(after.id).toBe(before.id);
    expect(problemKeyOf(facetsOf(after, 'Payment'))).toBe(problemKeyOf(facetsOf(before, 'Payment')));
  });
});
