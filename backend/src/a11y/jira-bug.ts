import { A11yRule, A11yViolation } from './a11y.types';
import { JiraField, JiraIssueType, JiraParentIssue, JiraUser } from './jira.client';
import { UiTree } from '../ui-tree/ui-tree.types';

/** The functional block, or service, is what a check's name says before its first dot. */
export function functionalBlock(testName: string): string {
  const index = testName.indexOf('.');
  return (index > 0 ? testName.slice(0, index) : testName).trim();
}

/** The rest of the name after the first dot, which usually names the screen or step. */
function nameAfterBlock(testName: string): string {
  const index = testName.indexOf('.');
  return index > 0 ? testName.slice(index + 1).trim() : '';
}

const TITLE_TAG = /appbar#title/i;

/**
 * The screen's own title from the UI tree: the element tagged Appbar#Title
 * (as a resource id or content description), or the text under it.
 */
export function screenTitle(tree: UiTree | null): string | null {
  if (!tree) return null;
  const tagged = tree.nodes.find((node) => TITLE_TAG.test(node.resourceId) || TITLE_TAG.test(node.label));
  if (!tagged) return null;
  const own = [tagged.text, TITLE_TAG.test(tagged.label) ? '' : tagged.label].find((value) => value?.trim());
  if (own) return own.trim();
  // the tag can sit on a container whose child holds the text
  const child = tree.nodes.find((node) => node.parent === tagged.index && (node.text || node.label));
  return child ? (child.text || child.label).trim() : null;
}

const EXPECTED: Record<A11yRule, string> = {
  'missing-label':
    'Елемент має доступну назву (contentDescription / accessibilityLabel), яку озвучує TalkBack / VoiceOver.',
  'touch-target': 'Область натискання не менше 48 × 48 dp (Android) або 44 × 44 pt (iOS).',
  'duplicate-label': 'Різні елементи мають різні назви, щоб їх можна було розрізнити на слух.',
  'low-contrast': 'Контраст тексту з фоном не менше 4.5 : 1 (3 : 1 для великого тексту).',
  'input-without-label': 'Поле введення має підпис або підказку, яку озвучує скрінрідер.',
  'redundant-role': 'Назва не містить ролі елемента («кнопка», «зображення»): роль озвучується автоматично.',
  'not-accessible': 'Інтерактивний елемент доступний для скрінрідера.',
};

const escapeWiki = (value: string) => value.replace(/\|/g, '/').replace(/[{}]/g, '');

/** Summary and description of the bug, following the team's bug template. */
export function bugText(input: {
  violation: A11yViolation;
  testName: string;
  title: string | null;
  device: string;
  url: string;
}): { summary: string; description: string; block: string; screen: string } {
  const { violation, testName, title, device, url } = input;
  const block = functionalBlock(testName);
  const screen = title || nameAfterBlock(testName) || testName;
  const element = violation.label || violation.resourceId || violation.className;
  const where = screen === block ? block : `${block}. ${screen}`;
  const summary = `[A11y] ${where}: ${violation.title} (${element})`.slice(0, 250);
  const rows: Array<[string, string]> = [
    ['Сервіс / функціональний блок', block],
    ['Екран', screen],
    ['Перевірка', testName],
    ['Пристрій', device || '—'],
    ['Елемент', `${violation.className}${violation.resourceId ? ` (${violation.resourceId})` : ''}`],
    ['Озвучується як', violation.label ? `"${violation.label}"` : 'нічого'],
    ['Правило', `${violation.title} (${violation.rule})`],
  ];
  const details = Object.entries(violation.details ?? {}).map(([key, value]) => `* ${key}: ${value}`);
  const description = [
    'h3. Фактичний результат',
    violation.message,
    '',
    'h3. Очікуваний результат',
    EXPECTED[violation.rule] ?? 'Елемент відповідає вимогам доступності.',
    '',
    ...rows.map(([key, value]) => `||${key}|${escapeWiki(value)}|`),
    ...(details.length ? ['', '*Деталі*', ...details] : []),
    '',
    'На скріншоті у вкладенні проблемний елемент обведено.',
    `[Відкрити у Vision|${url}]`,
  ].join('\n');
  return { summary, description, block, screen };
}

/**
 * The issue type to offer first: the project's configured one, else a bug
 * sub-task, else a bug, else the first sub-task.
 */
export function defaultIssueType(types: JiraIssueType[], configured?: string | null): JiraIssueType | null {
  const byName = (pattern: RegExp, subtask?: boolean) =>
    types.find((type) => pattern.test(type.name) && (subtask === undefined || type.subtask === subtask));
  const bug = /bug|баг|помилк|ошибк|дефект|defect/i;
  return (
    (configured && types.find((type) => type.name.toLowerCase() === configured.toLowerCase())) ||
    byName(bug, true) ||
    byName(bug) ||
    types.find((type) => type.subtask) ||
    types[0] ||
    null
  );
}

const SEVERITY_FIELD = /серйозн|серьезн|severity/i;
const CUSTOMER_FIELD = /замовник|заказчик|customer/i;
// filled from the issue itself or by Jira
const HANDLED = new Set(['project', 'issuetype', 'summary', 'description', 'parent', 'reporter', 'assignee', 'labels']);

const userRef = (user: JiraUser) => (user.accountId ? { accountId: user.accountId } : { name: user.name ?? user.key });

const display = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(display).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return String(object.displayName ?? object.value ?? object.name ?? object.key ?? object.id ?? '');
  }
  return String(value);
};

/** A task's field value in the form Jira takes when creating an issue. */
export function copyValue(field: JiraField, value: unknown): unknown {
  if (value === null || value === undefined || (Array.isArray(value) && !value.length)) return undefined;
  const ref = (item: unknown) => {
    const object = item as Record<string, unknown>;
    if (field.schema.items === 'user' || field.schema.type === 'user') return userRef(object as JiraUser);
    if (object && typeof object === 'object') {
      if (object.id !== undefined) {
        const child = object.child as Record<string, unknown> | undefined;
        return child?.id ? { id: String(object.id), child: { id: String(child.id) } } : { id: String(object.id) };
      }
      return undefined;
    }
    return item;
  };
  if (field.schema.type === 'array') {
    const items = (value as unknown[]).map(ref).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (['string', 'number', 'date', 'datetime', 'any'].includes(field.schema.type)) return value;
  return ref(value);
}

export interface BugFields {
  fields: Record<string, unknown>;
  // what Vision filled in, to show before creating
  filled: Array<{ field: string; value: string; source: 'task' | 'vision' }>;
  // required fields Vision could not fill
  missing: string[];
  // assignee to set after creating, when the create screen has no assignee field
  assignAfter: JiraUser | null;
}

/**
 * Fields of the new bug for the chosen issue type: a sub-task goes under the
 * task, the task's assignee takes it, severity is S4, the customer and any
 * other required field the task has a value for are copied from the task.
 * Only fields on the create screen are sent, so Jira never refuses one.
 */
export function buildBugFields(input: {
  meta: JiraField[];
  parent: JiraParentIssue;
  issueType: JiraIssueType;
  summary: string;
  description: string;
  labels: string[];
  severity: string;
}): BugFields {
  const { meta, parent, issueType } = input;
  const onScreen = new Map(meta.map((field) => [field.id, field]));
  const fields: Record<string, unknown> = {
    project: { key: parent.projectKey },
    issuetype: { id: issueType.id },
    summary: input.summary,
  };
  const filled: BugFields['filled'] = [];
  if (onScreen.has('description') || !meta.length) fields.description = input.description;
  if (issueType.subtask) {
    fields.parent = { key: parent.key };
    filled.push({ field: 'Parent', value: parent.key, source: 'task' });
  }

  let assignAfter: JiraUser | null = null;
  if (parent.assignee) {
    if (onScreen.has('assignee')) fields.assignee = userRef(parent.assignee);
    else assignAfter = parent.assignee;
    filled.push({ field: 'Assignee', value: display(parent.assignee), source: 'task' });
  }
  if (onScreen.has('labels') && input.labels.length) {
    fields.labels = input.labels;
    filled.push({ field: 'Labels', value: input.labels.join(', '), source: 'vision' });
  }

  for (const field of meta) {
    if (HANDLED.has(field.id) || fields[field.id] !== undefined) continue;
    if (SEVERITY_FIELD.test(field.name)) {
      const wanted = input.severity.toLowerCase();
      const option =
        field.allowedValues?.find((item) => display(item).trim().toLowerCase() === wanted) ??
        field.allowedValues?.find((item) => display(item).trim().toLowerCase().startsWith(wanted));
      const value = option
        ? field.schema.type === 'array'
          ? [{ id: option.id }]
          : { id: option.id }
        : field.allowedValues?.length
          ? undefined
          : input.severity;
      if (value !== undefined) {
        fields[field.id] = value;
        filled.push({ field: field.name, value: option ? display(option) : input.severity, source: 'vision' });
        continue;
      }
    }
    if (field.required || CUSTOMER_FIELD.test(field.name)) {
      const copied = copyValue(field, parent.fields[field.id]);
      if (copied !== undefined) {
        fields[field.id] = copied;
        filled.push({ field: field.name, value: display(parent.fields[field.id]), source: 'task' });
      }
    }
  }

  const missing = meta
    .filter((field) => field.required && !HANDLED.has(field.id) && fields[field.id] === undefined)
    // Jira fills a required field that has a default value by itself
    .filter((field) => !field.hasDefaultValue)
    .map((field) => field.name);
  return { fields, filled, missing, assignAfter };
}
