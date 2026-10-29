// A save from the settings page must not quietly undo what someone else saved
// after the page was opened (018, REQ-018-53). Only settings count: the
// project row also changes on every build (its counter), and screen rules are
// added from the review, not from this page.

export const SETTINGS_FIELDS = [
  'name',
  'mainBranchName',
  'autoApproveFeature',
  'imageComparison',
  'imageComparisonConfig',
  'maxBuildAllowed',
  'maxBranchLifetime',
  'bulkApproveVariations',
  'bulkApproveGroupBy',
  'uiTreeSettings',
  'jiraUrl',
  'jiraEmail',
  'jiraIssueType',
  'jiraLinkType',
] as const;

export type SettingsSnapshot = Partial<Record<(typeof SETTINGS_FIELDS)[number], unknown>>;

// rules of single screens live in the same JSON but come from the review
function withoutCheckRules(value: unknown): unknown {
  if (typeof value !== 'string' || !value) return value ?? null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') delete parsed.checkRules;
    return JSON.stringify(parsed);
  } catch {
    return value;
  }
}

const normal = (field: string, value: unknown) =>
  field === 'uiTreeSettings' ? withoutCheckRules(value) : value === undefined || value === '' ? null : value;

/** The settings that differ between what the page loaded and what is stored now. */
export function settingsConflict(loaded: SettingsSnapshot, current: SettingsSnapshot): string[] {
  return SETTINGS_FIELDS.filter(
    (field) => field in loaded && normal(field, loaded[field]) !== normal(field, current[field])
  );
}
