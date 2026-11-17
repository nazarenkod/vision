import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { ElementPopover } from "./ElementPopover";
import { PickableElement, ScreenRule } from "../../types/insights";

const updated: PickableElement = {
  index: 7,
  selector: "id:tv_updated",
  element: 'TextView "Updated at 14:07"',
  bounds: { x: 40, y: 400, width: 300, height: 40 },
  text: "Updated at 14:07",
};

function popover(
  props: Partial<React.ComponentProps<typeof ElementPopover>> = {},
) {
  const onVariable = jest.fn();
  const onAct = jest.fn();
  const onClose = jest.fn();
  render(
    <ElementPopover
      anchor={{ x: 100, y: 100 }}
      element={updated}
      sameSelector={1}
      canGoUp={false}
      canGoDown={false}
      busy={false}
      onUp={jest.fn()}
      onDown={jest.fn()}
      onMore={jest.fn()}
      onAct={onAct}
      onRemove={jest.fn()}
      onClose={onClose}
      onAddMore={jest.fn()}
      onVariable={onVariable}
      {...props}
    />,
  );
  return { onVariable, onAct, onClose };
}

const pieces = () =>
  screen.getAllByTestId("variablePiece").map((piece) => piece.textContent);

describe("ElementPopover: variable text (spec 033)", () => {
  it("offers Variable text as the fourth action, its key unnamed", () => {
    popover();
    const actions = screen.getAllByTestId(/^elementAction-/);
    expect(actions.map((action) => action.dataset.testid)).toEqual([
      "elementAction-ignore",
      "elementAction-compare",
      "elementAction-tolerate",
      "elementAction-variable",
    ]);
    // V still works; the action names no key (REQ-064-20)
    expect(actions[3]).toHaveTextContent(/^Variable text$/);
  });

  it("folds the other actions and shows the pieces after V", () => {
    popover();
    fireEvent.keyDown(document.body, { key: "v" });
    expect(screen.queryByTestId("elementAction-ignore")).toBeNull();
    expect(screen.getByTestId("variableBack")).toHaveTextContent(
      "Variable text",
    );
    expect(pieces()).toEqual(["Updated", "at", "14:07"]);
  });

  it("marks nothing by itself", () => {
    popover();
    fireEvent.click(screen.getByTestId("elementAction-variable"));
    screen
      .getAllByTestId("variablePiece")
      .forEach((piece) =>
        expect(piece).toHaveAttribute("aria-pressed", "false"),
      );
  });

  it("asks to click a piece, then says the rest is literal", () => {
    popover();
    fireEvent.click(screen.getByTestId("elementAction-variable"));
    expect(screen.getByTestId("variableHint")).toHaveTextContent(
      "Click the part that changes.",
    );
    fireEvent.click(screen.getByText("14:07"));
    expect(screen.getByTestId("variableHint")).toHaveTextContent(
      "The rest of the text stays word for word.",
    );
  });

  it("shows the pattern of a marked piece on hover", async () => {
    popover();
    fireEvent.click(screen.getByTestId("elementAction-variable"));
    fireEvent.click(screen.getByText("14:07"));
    fireEvent.mouseOver(screen.getByText("14:07"));
    expect(await screen.findByText("Format: \\d+:\\d{2}")).toBeInTheDocument();
  });

  it("saves only when a piece is marked", () => {
    const { onVariable } = popover();
    fireEvent.click(screen.getByTestId("elementAction-variable"));
    expect(screen.getByTestId("variableSave")).toBeDisabled();
    fireEvent.click(screen.getByText("14:07"));
    expect(screen.getByTestId("variableSave")).toBeEnabled();
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(onVariable).toHaveBeenCalledWith({
      parts: [
        { text: "Updated at " },
        { pattern: "\\d+:\\d{2}", sample: "14:07" },
      ],
      scope: "screen",
      selector: "id:tv_updated",
      replaces: undefined,
    });
  });

  it("warns when the baseline text does not fit", () => {
    popover({ other: { side: "baseline", text: "Updated at 6 pm" } });
    fireEvent.click(screen.getByTestId("elementAction-variable"));
    expect(screen.queryByTestId("variableOther")).toBeNull();
    fireEvent.click(screen.getByText("14:07"));
    expect(screen.getByTestId("variableOther")).toHaveTextContent(
      "On the baseline it says “Updated at 6 pm” here — it will not fit.",
    );
    // a baseline in another format is a warning, not a stop
    expect(screen.getByTestId("variableSave")).toBeEnabled();
  });

  it("says when nothing would find the element next run", () => {
    popover({
      element: {
        ...updated,
        selector: "text:02.11, 14:07",
        element: 'TextView "02.11, 14:07"',
        text: "02.11, 14:07",
      },
    });
    fireEvent.click(screen.getByTestId("elementAction-variable"));
    ["02.11", ",", "14:07"].forEach((piece) =>
      fireEvent.click(screen.getByText(piece)),
    );
    expect(screen.getByTestId("variableNoAnchor")).toBeInTheDocument();
    expect(screen.getByTestId("variableSave")).toBeDisabled();
  });

  it("keeps Variable text out of reach for an element without text", () => {
    const { onAct } = popover({ element: { ...updated, text: undefined } });
    expect(screen.getByTestId("elementAction-variable")).toBeDisabled();
    fireEvent.keyDown(document.body, { key: "v" });
    expect(screen.queryByTestId("variableBack")).toBeNull();
    expect(onAct).not.toHaveBeenCalled();
  });
});

describe("ElementPopover: an anchor found by the start of its text (spec 061)", () => {
  const icon: PickableElement = {
    index: 3,
    selector:
      "xpath://*[starts-with(@label,'На свою картку *7101')]/XCUIElementTypeOther[1]",
    element: "Other",
    bounds: { x: 16, y: 110, width: 40, height: 40 },
    variants: [
      {
        selector:
          "xpath://*[starts-with(@label,'На свою картку *7101')]/XCUIElementTypeOther[1]",
        direction: "down",
        anchor: "На свою картку *7101",
        anchorKind: "text",
        anchorMatch: "start",
        levels: 1,
        count: 1,
      },
    ],
  };

  it("names the start of the text the rule hangs on", () => {
    popover({ element: icon });
    expect(screen.getByTestId("elementTextAnchor")).toHaveTextContent(
      "Found through the start of a text: the rule stops working when “На свою картку *7101” changes",
    );
  });

  it("keeps the plain warning for a text matched whole", () => {
    const [variant] = icon.variants ?? [];
    popover({
      element: { ...icon, variants: [{ ...variant, anchorMatch: undefined }] },
    });
    expect(screen.getByTestId("elementTextAnchor")).toHaveTextContent(
      "Found through a text: the rule stops working when the text changes",
    );
  });
});

describe("ElementPopover: tidier and closed by a click outside (spec 067)", () => {
  // the listener starts after the click that opened the popover
  const settle = () =>
    act(() => new Promise((resolve) => setTimeout(resolve, 0)));

  it("closes on a click outside it", async () => {
    const { onClose } = popover();
    await settle();
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open on a click inside it and leaves the screenshots to pick", async () => {
    const stage = document.createElement("div");
    stage.className = "konvajs-content";
    const canvas = document.createElement("canvas");
    stage.appendChild(canvas);
    document.body.appendChild(stage);
    const { onClose } = popover();
    await settle();
    fireEvent.mouseDown(screen.getByTestId("elementTitle"));
    fireEvent.mouseDown(canvas);
    expect(onClose).not.toHaveBeenCalled();
    stage.remove();
  });

  it("asks where the rule goes before what it does", () => {
    popover();
    const scope = screen.getByRole("button", { name: "This check" });
    const ignore = screen.getByTestId("elementAction-ignore");
    expect(
      scope.compareDocumentPosition(ignore) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the step down in place, disabled when there is nowhere to go", () => {
    popover({ canGoDown: false });
    expect(screen.getByTestId("elementChild")).toBeDisabled();
  });

  const plus: PickableElement = {
    index: 9,
    selector: "xpath://*[@resource-id='card']/android.widget.ImageView[1]",
    element: "ImageView",
    nameless: true,
    bounds: { x: 0, y: 0, width: 20, height: 20 },
    variants: [
      {
        selector: "xpath://*[@resource-id='card']/android.widget.ImageView[1]",
        direction: "down",
        anchor: "card",
        anchorKind: "id",
        levels: 1,
        count: 1,
      },
      {
        selector:
          "xpath://*[@resource-id='activity_list_item_transaction_tail_badge']/..",
        direction: "up",
        anchor: "activity_list_item_transaction_tail_badge",
        anchorKind: "id",
        levels: 1,
        count: 3,
      },
    ],
  };

  it("names a nameless element by its class once the ways to find it are listed", () => {
    popover({ element: plus });
    expect(screen.getByTestId("elementTitle")).toHaveTextContent(/^ImageView$/);
    expect(screen.getByTestId("elementVariant-down")).toHaveTextContent(
      /^inside card$/,
    );
  });

  it("counts only the ways that find other than one element", () => {
    popover({ element: plus });
    const counts = screen.getAllByTestId("elementVariantCount");
    expect(counts).toHaveLength(1);
    expect(counts[0]).toHaveTextContent("3 found");
    // the anchor is cut in the middle, the whole selector stays in the title
    expect(screen.getByTestId("elementVariant-up")).toHaveTextContent(
      /^parent of activity_list…n_tail_badge3 found$/,
    );
  });
});

describe("ElementPopover: what a variable text leaves out (spec 066)", () => {
  const history: PickableElement = {
    index: 3,
    parent: null,
    selector: "id:history",
    element: 'View "History"',
    bounds: { x: 100, y: 1000, width: 300, height: 100 },
    text: "History",
    labelOnly: true,
  };
  const shown: PickableElement = {
    index: 5,
    parent: 3,
    selector: "text:History",
    element: 'TextView "History"',
    bounds: { x: 200, y: 1020, width: 180, height: 60 },
    text: "History",
  };
  const historyRule: ScreenRule = {
    id: "r",
    selector: "id:history",
    action: "variable",
    scope: "screen",
    matches: 1,
    parts: [{ pattern: "\\p{L}+", sample: "History" }],
  };

  it("says what of the element is not compared", () => {
    popover({
      element: history,
      rule: historyRule,
      leftOut: {
        side: "current",
        element: history.bounds,
        areas: [shown.bounds],
      },
    });
    expect(screen.getByTestId("variableLeftOut")).toHaveTextContent(
      "Only the text is not compared",
    );
  });

  it("says why the whole element is not compared", () => {
    popover({
      element: history,
      rule: historyRule,
      leftOut: {
        side: "current",
        element: history.bounds,
        areas: [history.bounds],
        reason: "resized",
      },
    });
    expect(screen.getByTestId("variableLeftOut")).toHaveTextContent(
      "The whole element is not compared: its size changed",
    );
  });

  it("says only the marked pieces are not compared, or which was not found", () => {
    popover({
      element: history,
      rule: historyRule,
      leftOut: {
        side: "current",
        element: history.bounds,
        areas: [{ x: 10, y: 10, width: 20, height: 10 }],
        located: true,
      },
    });
    expect(screen.getByTestId("variableLeftOut")).toHaveTextContent(
      "Only the marked pieces are not compared",
    );
    cleanup();
    popover({
      element: history,
      rule: historyRule,
      leftOut: {
        side: "current",
        element: history.bounds,
        areas: [history.bounds],
        reason: "not-found-baseline",
        missing: "+1.01",
      },
    });
    expect(screen.getByTestId("variableLeftOut")).toHaveTextContent(
      "The whole element is not compared: «+1.01» was not found on the baseline",
    );
  });

  it("warns on a saved rule that checks words only", () => {
    popover({ element: history, rule: historyRule });
    expect(screen.getByTestId("variableWordsOnly")).toHaveTextContent(
      "Only checks that a word is here — almost like Ignore",
    );
  });

  it("offers the text shown on the screen for a label-only element", () => {
    popover({ element: history, shownText: shown, onShownText: jest.fn() });
    fireEvent.click(screen.getByTestId("elementAction-variable"));
    expect(screen.getByTestId("variableShownText")).toHaveTextContent(
      "Text on the screen: “History”",
    );
  });

  it("moves the marking to the shown text", () => {
    const onShownText = jest.fn();
    popover({ element: history, shownText: shown, onShownText });
    fireEvent.click(screen.getByTestId("elementAction-variable"));
    fireEvent.click(screen.getByTestId("variableMarkInIt"));
    expect(onShownText).toHaveBeenCalled();
    // the shown text opens with its pieces, not the actions
    render(
      <ElementPopover
        anchor={{ x: 100, y: 100 }}
        element={shown}
        sameSelector={1}
        canGoUp
        canGoDown={false}
        busy={false}
        onUp={jest.fn()}
        onDown={jest.fn()}
        onMore={jest.fn()}
        onAct={jest.fn()}
        onRemove={jest.fn()}
        onClose={jest.fn()}
        onAddMore={jest.fn()}
        onVariable={jest.fn()}
        startMarking
      />,
    );
    expect(screen.getAllByTestId("variablePiece").at(-1)).toHaveTextContent(
      "History",
    );
  });

  it("shows the baseline warning before the words-only one", () => {
    popover({ element: shown, other: { side: "baseline", text: "12:00" } });
    fireEvent.click(screen.getByTestId("elementAction-variable"));
    fireEvent.click(screen.getByText("History"));
    const other = screen.getByTestId("variableOther");
    const words = screen.getByTestId("variableWordsOnly");
    expect(
      other.compareDocumentPosition(words) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
