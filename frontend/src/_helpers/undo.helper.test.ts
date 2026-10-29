import {
  decisionNotice,
  decisionSnackOptions,
  UNDO_OFFER_MS,
} from "./undo.helper";

describe("undo", () => {
  it("offers Undo for 8 seconds", () => {
    expect(UNDO_OFFER_MS).toBe(8000);
    expect(decisionSnackOptions("approve")).toEqual({
      variant: "success",
      autoHideDuration: 8000,
    });
    expect(decisionSnackOptions("reject").autoHideDuration).toBe(8000);
    expect(decisionSnackOptions("reject").variant).toBe("info");
  });

  it("says what was decided and for how many", () => {
    expect(decisionNotice("approve", 1)).toBe("Approved");
    expect(decisionNotice("reject", 1)).toBe("Rejected");
    expect(decisionNotice("approve", 30)).toBe("Approved 30 screenshots");
  });
});
