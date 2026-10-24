import { describeNode, ownSpeakableText } from '../ui-tree/ui-tree.parser';
import { UiNode, UiTree } from '../ui-tree/ui-tree.types';
import { A11yReport, A11yRule, A11ySeverity, A11yViolation, RgbaImage } from './a11y.types';
import { estimateContrast } from './contrast';

// Minimum touch target: 48 dp on Android (Material, ATF), 44 pt on iOS (HIG).
const MIN_TARGET = { 'appium-android': 48, 'appium-ios': 44 };
// WCAG AA: 4.5:1 for body text, 3:1 for large text.
const MIN_CONTRAST = 4.5;
const MIN_CONTRAST_LARGE = 3;
// A single line taller than this (dp) is treated as large text.
const LARGE_TEXT_HEIGHT_DP = 28;
// Containers that cover most of the screen are layout, not controls.
const MAX_CONTROL_SCREEN_SHARE = 0.5;

const ROLE_WORDS = /\b(button|btn|image|icon|picture)\b|кнопк|зображенн|картинк|іконк|иконк/i;
const EDITABLE = /EditText|AutoCompleteTextView|XCUIElementType(TextField|SecureTextField|SearchField|TextView)$/;
const TEXTUAL = /TextView|Button|CheckBox|RadioButton|Switch|Chip|XCUIElementType(StaticText|Button|Link|TextView)$/;
const IOS_BUTTON = /XCUIElementType(Button|Link|Switch|Cell)$/;

interface Context {
  tree: UiTree;
  children: number[][];
  image?: RgbaImage;
}

function buildContext(tree: UiTree, image?: RgbaImage): Context {
  const children: number[][] = tree.nodes.map(() => []);
  tree.nodes.forEach((node) => {
    if (node.parent !== null) children[node.parent].push(node.index);
  });
  return { tree, children, image };
}

const isShown = (node: UiNode) => node.visible && node.bounds.width > 0 && node.bounds.height > 0;

function isControl(node: UiNode, ctx: Context): boolean {
  if (!isShown(node) || !node.enabled || !node.clickable) return false;
  const screen = ctx.tree.width * ctx.tree.height;
  return screen <= 0 || (node.bounds.width * node.bounds.height) / screen <= MAX_CONTROL_SCREEN_SHARE;
}

/**
 * What a screen reader announces for a control: its own label or text, or —
 * on Android, where a clickable container reads out its children — the text of
 * non-clickable descendants.
 */
function speakableText(node: UiNode, ctx: Context): string {
  const own = ownSpeakableText(node);
  if (own || ctx.tree.format === 'appium-ios') return own;
  const parts: string[] = [];
  const visit = (index: number) => {
    for (const childIndex of ctx.children[index]) {
      const child = ctx.tree.nodes[childIndex];
      if (child.clickable) continue;
      const text = ownSpeakableText(child);
      if (text) parts.push(text);
      else visit(childIndex);
    }
  };
  visit(node.index);
  return parts.join(' ').trim();
}

function violation(
  rule: A11yRule,
  severity: A11ySeverity,
  node: UiNode,
  ctx: Context,
  title: string,
  message: string,
  details?: A11yViolation['details']
): A11yViolation {
  return {
    id: `${rule}|${node.key}`,
    rule,
    severity,
    title,
    message,
    nodeKey: node.key,
    resourceId: node.resourceId,
    className: node.className,
    label: speakableText(node, ctx),
    bounds: node.bounds,
    details,
  };
}

const round1 = (value: number) => Math.round(value * 10) / 10;

function checkMissingLabel(node: UiNode, ctx: Context): A11yViolation[] {
  // inputs are covered by checkInputLabel, which also accepts a hint
  if (!isControl(node, ctx) || EDITABLE.test(node.className) || speakableText(node, ctx)) return [];
  const reader = ctx.tree.format === 'appium-ios' ? 'VoiceOver' : 'TalkBack';
  return [
    violation(
      'missing-label',
      'error',
      node,
      ctx,
      'Control has no label',
      `${describeNode(node)} has nothing for ${reader} to read out.`
    ),
  ];
}

function checkTouchTarget(node: UiNode, ctx: Context): A11yViolation[] {
  if (!isControl(node, ctx)) return [];
  const min = MIN_TARGET[ctx.tree.format];
  const width = node.bounds.width / ctx.tree.pixelsPerDp;
  const height = node.bounds.height / ctx.tree.pixelsPerDp;
  // half a unit of slack for rounding in bounds and density
  if (width >= min - 0.5 && height >= min - 0.5) return [];
  const unit = ctx.tree.format === 'appium-ios' ? 'pt' : 'dp';
  return [
    violation(
      'touch-target',
      'warning',
      node,
      ctx,
      'Touch target too small',
      `${describeNode(node)} is ${Math.round(width)} × ${Math.round(height)} ${unit}, minimum is ${min} × ${min} ${unit}.`,
      { widthDp: round1(width), heightDp: round1(height), min, estimatedDensity: ctx.tree.pixelsPerDpEstimated }
    ),
  ];
}

function checkDuplicateLabels(ctx: Context): A11yViolation[] {
  const byLabel = new Map<string, UiNode[]>();
  for (const node of ctx.tree.nodes) {
    if (!isControl(node, ctx)) continue;
    const label = speakableText(node, ctx).toLowerCase().replace(/\s+/g, ' ');
    if (!label) continue;
    byLabel.set(label, [...(byLabel.get(label) ?? []), node]);
  }
  const result: A11yViolation[] = [];
  for (const [label, nodes] of byLabel) {
    if (nodes.length < 2) continue;
    for (const node of nodes) {
      result.push(
        violation(
          'duplicate-label',
          'warning',
          node,
          ctx,
          'Same label on several controls',
          `${nodes.length} controls are announced as "${label.slice(0, 40)}"; users cannot tell them apart.`,
          { count: nodes.length }
        )
      );
    }
  }
  return result;
}

function checkContrast(node: UiNode, ctx: Context): A11yViolation[] {
  if (!ctx.image || !isShown(node) || !node.text.trim() || !TEXTUAL.test(node.className)) return [];
  const estimate = estimateContrast(ctx.image, node.bounds);
  if (!estimate) return [];
  const heightDp = node.bounds.height / ctx.tree.pixelsPerDp;
  const large = heightDp >= LARGE_TEXT_HEIGHT_DP && node.text.length <= 30;
  const required = large ? MIN_CONTRAST_LARGE : MIN_CONTRAST;
  if (estimate.ratio >= required) return [];
  return [
    violation(
      'low-contrast',
      'warning',
      node,
      ctx,
      'Low text contrast',
      `${describeNode(node)}: ${estimate.ratio.toFixed(1)} : 1, needs ${required} : 1.`,
      { ratio: estimate.ratio, required, foreground: estimate.foreground, background: estimate.background }
    ),
  ];
}

function checkInputLabel(node: UiNode, ctx: Context): A11yViolation[] {
  if (!isShown(node) || !EDITABLE.test(node.className)) return [];
  if (node.label.trim() || node.hint.trim() || node.text.trim()) return [];
  return [
    violation(
      'input-without-label',
      'warning',
      node,
      ctx,
      'Input has no label or hint',
      `${describeNode(node)} gives no clue what to enter.`
    ),
  ];
}

function checkRedundantRole(node: UiNode, ctx: Context): A11yViolation[] {
  if (!isControl(node, ctx) || !ROLE_WORDS.test(node.label)) return [];
  return [
    violation(
      'redundant-role',
      'info',
      node,
      ctx,
      'Label repeats the role',
      `"${node.label.slice(0, 40)}" already gets its role announced; drop words like "button" or "image".`
    ),
  ];
}

function checkIosAccessible(node: UiNode, ctx: Context): A11yViolation[] {
  if (ctx.tree.format !== 'appium-ios' || node.accessible || !isShown(node) || !IOS_BUTTON.test(node.className)) {
    return [];
  }
  return [
    violation(
      'not-accessible',
      'warning',
      node,
      ctx,
      'Control hidden from VoiceOver',
      `${describeNode(node)} has isAccessibilityElement = false.`
    ),
  ];
}

const NODE_RULES = [
  checkMissingLabel,
  checkTouchTarget,
  checkContrast,
  checkInputLabel,
  checkRedundantRole,
  checkIosAccessible,
];

/** All accessibility issues of one screen. The screenshot is only needed for contrast. */
export function findViolations(tree: UiTree, image?: RgbaImage): A11yViolation[] {
  const ctx = buildContext(tree, image);
  const found = tree.nodes.flatMap((node) => NODE_RULES.flatMap((rule) => rule(node, ctx)));
  found.push(...checkDuplicateLabels(ctx));
  // one entry per id: the same element can't be reported twice by the same rule
  return [...new Map(found.map((v) => [v.id, v])).values()];
}

const SEVERITY_ORDER: Record<A11ySeverity, number> = { error: 0, warning: 1, info: 2 };

/**
 * Splits the current issues into new and existing by comparing with the
 * baseline's issues, and lists the baseline issues that are gone as fixed.
 * Without a baseline tree every issue counts as new.
 */
export function buildReport(tree: UiTree, current: A11yViolation[], baseline: A11yViolation[] | null): A11yReport {
  const baselineIds = new Set((baseline ?? []).map((v) => v.id));
  const currentIds = new Set(current.map((v) => v.id));
  const violations = current
    .map((v) => ({ ...v, status: baselineIds.has(v.id) ? ('existing' as const) : ('new' as const) }))
    .sort(
      (a, b) =>
        (a.status === b.status ? 0 : a.status === 'new' ? -1 : 1) ||
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.bounds.y - b.bounds.y
    );
  const fixed = (baseline ?? []).filter((v) => !currentIds.has(v.id));
  // advice (severity info) is listed but never counted, so it cannot fail a build
  const counted = violations.filter((v) => v.severity !== 'info');
  const newCount = counted.filter((v) => v.status === 'new').length;
  return {
    version: 1,
    format: tree.format,
    pixelsPerDp: tree.pixelsPerDp,
    pixelsPerDpEstimated: tree.pixelsPerDpEstimated,
    baselineChecked: baseline !== null,
    summary: {
      new: newCount,
      existing: counted.length - newCount,
      fixed: fixed.filter((v) => v.severity !== 'info').length,
      total: counted.length,
    },
    violations,
    fixed,
  };
}
