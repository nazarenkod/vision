import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ElementPopover } from "./ElementPopover";
import { PickableElement } from "../../types/insights";

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
      onClose={jest.fn()}
      onAddMore={jest.fn()}
      onVariable={onVariable}
      {...props}
    />,
  );
  return { onVariable, onAct };
}

const pieces = () =>
  screen.getAllByTestId("variablePiece").map((piece) => piece.textContent);

describe("ElementPopover: variable text (spec 033)", () => {
  it("offers Variable text as the fourth action with V", () => {
    popover();
    const actions = screen.getAllByTestId(/^elementAction-/);
    expect(actions.map((action) => action.dataset.testid)).toEqual([
      "elementAction-ignore",
      "elementAction-compare",
      "elementAction-tolerate",
      "elementAction-variable",
    ]);
    expect(within(actions[3]).getByText("V")).toBeInTheDocument();
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
