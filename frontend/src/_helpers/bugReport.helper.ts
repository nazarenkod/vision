import { JiraBugInput, User } from "../types";

/** The texts of a bug from the comparison: the four AI may draft, and the environment. */
export type DraftField = "essence" | "steps" | "actual" | "expected";
export const DRAFT_FIELDS: DraftField[] = [
  "essence",
  "steps",
  "actual",
  "expected",
];

export type BugForm = Record<DraftField, string> & { environment: string };

export const emptyForm = (environment = ""): BugForm => ({
  essence: "",
  steps: "",
  actual: "",
  expected: "",
  environment,
});

/** A marked area of the checkpoint, in screenshot pixels, numbered from 1. */
export interface BugMark {
  n: number;
  x: number;
  y: number;
  width: number;
  height: number;
  // the element's key and name when it was picked from the UI tree
  element?: string;
  label?: string;
}

const renumber = (marks: Omit<BugMark, "n">[]): BugMark[] =>
  marks.map((mark, index) => ({ ...mark, n: index + 1 }));

/** A new mark goes last; a rectangle drawn backwards or by a stray click is not one. */
export function addMark(marks: BugMark[], area: Omit<BugMark, "n">): BugMark[] {
  const x = Math.min(area.x, area.x + area.width);
  const y = Math.min(area.y, area.y + area.height);
  const width = Math.abs(area.width);
  const height = Math.abs(area.height);
  if (width < 4 || height < 4) return marks;
  return renumber([...marks, { ...area, x, y, width, height }]);
}

export function removeMark(marks: BugMark[], n: number): BugMark[] {
  return renumber(marks.filter((mark) => mark.n !== n));
}

/**
 * The Jira fields the dialog shows: the customer copied from the task goes
 * without asking (REQ-025-24), anything still empty is asked for.
 */
export function visibleInputs(inputs: JiraBugInput[]): JiraBugInput[] {
  return inputs.filter(
    (input) => !(input.role === "customer" && input.value !== undefined),
  );
}

/** What still stops Create: the bug's own texts, then Jira's required fields. */
export function missingFields(
  form: BugForm,
  inputs: JiraBugInput[],
  chosen: Record<string, unknown>,
): { texts: DraftField[]; fields: string[] } {
  const valueOf = (input: JiraBugInput) => chosen[input.id] ?? input.value;
  return {
    texts: DRAFT_FIELDS.filter((field) => !form[field].trim()),
    fields: inputs
      .filter(
        (input) =>
          input.required &&
          (valueOf(input) === undefined || valueOf(input) === null),
      )
      .map((input) => input.name),
  };
}

/**
 * On the person's own Gemini key (REQ-025-40): a small local model reads
 * screenshots poorly, and what AI costs is each person's to decide.
 */
export const aiAvailable = (
  user: Pick<User, "geminiKeySet"> | null | undefined,
): boolean => !!user?.geminiKeySet;

export const canAskAi = (note: string): boolean => note.trim().length > 0;

/**
 * A draft from the model into the form: fields the person changed stay theirs,
 * and an answer that left a field empty leaves what was there (REQ-025-46, -48).
 * Returns the form and which fields now show the model's text.
 */
export function applyDraft(
  form: BugForm,
  draft: Partial<Record<DraftField, string>>,
  edited: ReadonlySet<DraftField>,
): { form: BugForm; drafted: Set<DraftField> } {
  const next = { ...form };
  const drafted = new Set<DraftField>();
  for (const field of DRAFT_FIELDS) {
    const value = draft[field]?.trim();
    if (!value || edited.has(field)) continue;
    next[field] = value;
    drafted.add(field);
  }
  return { form: next, drafted };
}

/** The person typed in a field: it is theirs now, and no longer marked as the model's. */
export function editField(
  form: BugForm,
  field: keyof BugForm,
  value: string,
  drafted: ReadonlySet<DraftField>,
  edited: ReadonlySet<DraftField>,
): { form: BugForm; drafted: Set<DraftField>; edited: Set<DraftField> } {
  const nextDrafted = new Set(drafted);
  const nextEdited = new Set(edited);
  if (field !== "environment") {
    nextDrafted.delete(field);
    nextEdited.add(field);
  }
  return {
    form: { ...form, [field]: value },
    drafted: nextDrafted,
    edited: nextEdited,
  };
}
