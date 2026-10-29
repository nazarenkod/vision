import { settingsConflict } from './settings-conflict';

const stored = {
  name: 'Mobile Shop',
  mainBranchName: 'main',
  imageComparison: 'pixelmatch',
  maxBuildAllowed: 100,
  uiTreeSettings: JSON.stringify({ excludeSystemBars: true, checkRules: [] }),
  jiraUrl: null,
};

describe('settingsConflict', () => {
  it('reports settings someone changed after the page was opened', () => {
    const now = { ...stored, maxBuildAllowed: 50, imageComparison: 'odiff' };
    expect(settingsConflict(stored, now)).toEqual(['imageComparison', 'maxBuildAllowed']);
    expect(settingsConflict(stored, stored)).toEqual([]);
  });

  it('ignores screen rules added from the review and empty against null', () => {
    const now = {
      ...stored,
      uiTreeSettings: JSON.stringify({ excludeSystemBars: true, checkRules: [{ check: 'Pay', rules: [] }] }),
      jiraUrl: '',
    };
    expect(settingsConflict(stored, now)).toEqual([]);
    const changed = { ...stored, uiTreeSettings: JSON.stringify({ excludeSystemBars: false }) };
    expect(settingsConflict(stored, changed)).toEqual(['uiTreeSettings']);
  });

  it('only compares what the page loaded', () => {
    expect(settingsConflict({ name: 'Mobile Shop' }, { ...stored, maxBuildAllowed: 1 })).toEqual([]);
  });
});
