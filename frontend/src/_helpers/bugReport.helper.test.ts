import {
  addMark,
  aiAvailable,
  applyDraft,
  canAskAi,
  editField,
  emptyForm,
  missingFields,
  removeMark,
  visibleInputs,
} from "./bugReport.helper";
import { JiraBugInput } from "../types";

const severity: JiraBugInput = {
  id: "customfield_1",
  name: "Серйозність помилки",
  required: true,
  type: "option",
  role: "severity",
  options: [{ id: "4", label: "S4" }],
};
const customer: JiraBugInput = {
  id: "customfield_2",
  name: "Замовник",
  required: true,
  type: "user",
  role: "customer",
  value: { accountId: "olena" },
  display: "Олена Коваль",
};
const filled = {
  ...emptyForm("AOS 14"),
  essence: "кнопка обрізана",
  steps: "1. Відкрити",
  actual: "Обрізана.",
  expected: "Видна.",
};

describe("marks", () => {
  it("numbers marks and renumbers after removing one", () => {
    let marks = addMark([], { x: 10, y: 10, width: 50, height: 20 });
    marks = addMark(marks, { x: 100, y: 100, width: -40, height: -30 });
    marks = addMark(marks, { x: 5, y: 5, width: 2, height: 2 });
    expect(marks).toEqual([
      { n: 1, x: 10, y: 10, width: 50, height: 20 },
      { n: 2, x: 60, y: 70, width: 40, height: 30 },
    ]);
    expect(removeMark(marks, 1)).toEqual([
      { n: 1, x: 60, y: 70, width: 40, height: 30 },
    ]);
  });
});

describe("fields", () => {
  it("hides the customer once the task gives one", () => {
    expect(visibleInputs([severity, customer])).toEqual([severity]);
    expect(visibleInputs([{ ...customer, value: undefined }])).toHaveLength(1);
  });

  it("lists empty steps, actual and expected as missing", () => {
    expect(
      missingFields({ ...filled, steps: " ", expected: "" }, [], {}).texts,
    ).toEqual(["steps", "expected"]);
  });

  it("keeps Create off while a required field is empty", () => {
    expect(missingFields(filled, [severity, customer], {})).toEqual({
      texts: [],
      fields: ["Серйозність помилки"],
    });
    expect(
      missingFields(filled, [severity], { customfield_1: { id: "4" } }),
    ).toEqual({
      texts: [],
      fields: [],
    });
  });
});

describe("AI", () => {
  it("offers AI only with the person’s own Gemini key", () => {
    expect(aiAvailable({ geminiKeySet: true })).toBe(true);
    expect(aiAvailable({ geminiKeySet: false })).toBe(false);
    expect(aiAvailable(null)).toBe(false);
  });

  it("keeps Fill with AI off while the note is empty", () => {
    expect(canAskAi("  ")).toBe(false);
    expect(canAskAi("кнопка обрізана")).toBe(true);
  });

  const draft = {
    essence: "кнопка «Pay» обрізана",
    steps: "1. Відкрити Checkout",
    actual: "Обрізана.",
    expected: "Видна.",
  };

  it("marks drafted fields until the person edits them", () => {
    const first = applyDraft(emptyForm(), draft, new Set());
    expect([...first.drafted]).toEqual([
      "essence",
      "steps",
      "actual",
      "expected",
    ]);
    const edited = editField(
      first.form,
      "actual",
      "Обрізана на 8 px.",
      first.drafted,
      new Set(),
    );
    expect(edited.drafted.has("actual")).toBe(false);
    expect(edited.drafted.has("expected")).toBe(true);
  });

  it("asking again keeps the fields the person edited", () => {
    const first = applyDraft(emptyForm(), draft, new Set());
    const mine = editField(
      first.form,
      "actual",
      "Моє.",
      first.drafted,
      new Set(),
    );
    const again = applyDraft(
      mine.form,
      { ...draft, actual: "Інше.", expected: "Інакше." },
      mine.edited,
    );
    expect(again.form.actual).toBe("Моє.");
    expect(again.form.expected).toBe("Інакше.");
    expect(again.drafted.has("actual")).toBe(false);
  });

  it("keeps the note and the person’s fields when the draft fails", () => {
    const form = { ...emptyForm(), steps: "1. Моє" };
    const result = applyDraft(
      form,
      { essence: "", steps: "1. Інше", actual: "  " },
      new Set(["steps"]),
    );
    expect(result.form).toEqual(form);
    expect(result.drafted.size).toBe(0);
  });
});
