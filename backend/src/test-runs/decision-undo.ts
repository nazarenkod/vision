// Undo of a review decision (018, ADR-0014): what an approve or reject changed,
// worked out from the state before and after it, and the steps that put the
// state back. Pure: the service loads the states and runs the steps.

/** The parts of a variation an approve can change. */
export interface VariationState {
  id: string;
  baselineName: string | null;
  baselineUiTreeName: string | null;
  elementRules: string | null;
  ignoreAreas: string;
  comment: string | null;
  baselineIds: string[];
}

/** A run and every variation an approve of it may touch. */
export interface RunState {
  testRunId: string;
  status: string;
  testVariationId: string | null;
  // the run's own variation and, if there is one, its feature-branch one
  variations: VariationState[];
}

export interface DecisionItem {
  testRunId: string;
  before: RunState;
  after: RunState;
}

export type UndoStep =
  | { kind: 'deleteBaselines'; ids: string[] }
  | { kind: 'link'; testRunId: string; testVariationId: string | null }
  | { kind: 'deleteVariation'; id: string }
  | {
      kind: 'variation';
      id: string;
      data: Omit<VariationState, 'id' | 'baselineIds'>;
    }
  | { kind: 'status'; testRunId: string; status: string }
  | { kind: 'deleteImage'; name: string }
  | { kind: 'deleteFile'; name: string };

// the server keeps a decision undoable a little longer than the interface
// offers it (8 s), for the time the request takes on a slow network
export const UNDO_WINDOW_MS = 30_000;

export const undoExpired = (createdAt: Date, now: Date): boolean =>
  now.getTime() - createdAt.getTime() > UNDO_WINDOW_MS;

const FIELDS: Array<keyof Omit<VariationState, 'id' | 'baselineIds'>> = [
  'baselineName',
  'baselineUiTreeName',
  'elementRules',
  'ignoreAreas',
  'comment',
];

const fieldsOf = (variation: VariationState): Omit<VariationState, 'id' | 'baselineIds'> =>
  Object.fromEntries(FIELDS.map((field) => [field, variation[field]])) as Omit<VariationState, 'id' | 'baselineIds'>;

/**
 * The steps that turn `after` back into `before`, in an order the foreign keys
 * allow: baselines first (they point at runs and variations), then the run's
 * link, then variations the decision created, then the rest.
 */
export function undoPlan(item: DecisionItem): UndoStep[] {
  const { before, after } = item;
  const beforeById = new Map(before.variations.map((v) => [v.id, v]));
  const steps: UndoStep[] = [];

  const addedBaselines = after.variations.flatMap((variation) => {
    const known = new Set(beforeById.get(variation.id)?.baselineIds ?? []);
    return variation.baselineIds.filter((id) => !known.has(id));
  });
  if (addedBaselines.length) steps.push({ kind: 'deleteBaselines', ids: addedBaselines });

  if (after.testVariationId !== before.testVariationId) {
    steps.push({ kind: 'link', testRunId: item.testRunId, testVariationId: before.testVariationId });
  }

  for (const variation of after.variations) {
    const was = beforeById.get(variation.id);
    if (!was) {
      steps.push({ kind: 'deleteVariation', id: variation.id });
    } else if (FIELDS.some((field) => was[field] !== variation[field])) {
      steps.push({ kind: 'variation', id: variation.id, data: fieldsOf(was) });
    }
  }

  if (after.status !== before.status) {
    steps.push({ kind: 'status', testRunId: item.testRunId, status: before.status });
  }

  // files the decision wrote: in the state after it and nowhere before it
  const used = new Set(before.variations.flatMap((v) => [v.baselineName, v.baselineUiTreeName]));
  for (const variation of after.variations) {
    if (variation.baselineName && !used.has(variation.baselineName)) {
      steps.push({ kind: 'deleteImage', name: variation.baselineName });
      used.add(variation.baselineName);
    }
    if (variation.baselineUiTreeName && !used.has(variation.baselineUiTreeName)) {
      steps.push({ kind: 'deleteFile', name: variation.baselineUiTreeName });
      used.add(variation.baselineUiTreeName);
    }
  }
  return steps;
}

/**
 * Why the decision can no longer be undone, or null when it can: someone or
 * something changed the run or its baselines after it (REQ-018-73).
 */
export function undoBlocker(
  item: DecisionItem,
  current: RunState | null,
  // what the whole decision left each variation as: in a bulk decision a later
  // run of the same screen writes over the variation an earlier one wrote
  finalVariations: Map<string, VariationState> = new Map(item.after.variations.map((v) => [v.id, v]))
): string | null {
  if (!current) return 'The screenshot was deleted after the decision.';
  if (current.status !== item.after.status) {
    return 'The screenshot was decided again after this decision.';
  }
  if (current.testVariationId !== item.after.testVariationId) {
    return 'The screenshot was moved to another baseline after this decision.';
  }
  const now = new Map(current.variations.map((v) => [v.id, v]));
  for (const { id } of item.after.variations) {
    const variation = finalVariations.get(id);
    const there = now.get(id);
    if (!there) return 'Its baseline was deleted after the decision.';
    const sameBaselines =
      there.baselineIds.length === variation.baselineIds.length &&
      there.baselineIds.every((id) => variation.baselineIds.includes(id));
    if (!sameBaselines || there.baselineName !== variation.baselineName) {
      return 'Someone approved this screen again after this decision.';
    }
  }
  return null;
}

/** The state the whole decision left each variation in: the last run's word. */
export function finalVariations(items: DecisionItem[]): Map<string, VariationState> {
  const last = new Map<string, VariationState>();
  for (const item of items) for (const variation of item.after.variations) last.set(variation.id, variation);
  return last;
}

/**
 * Undo of a whole decision: the first reason it cannot be undone, or the steps
 * of every run, the last decided first so each run sees the state it left.
 */
export function decisionUndo(
  items: DecisionItem[],
  current: Map<string, RunState | null>
): { blocked: string } | { steps: UndoStep[] } {
  const final = finalVariations(items);
  for (const item of items) {
    const reason = undoBlocker(item, current.get(item.testRunId) ?? null, final);
    if (reason) return { blocked: reason };
  }
  return { steps: [...items].reverse().flatMap(undoPlan) };
}
