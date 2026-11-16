import React from "react";
import { render } from "@testing-library/react";
import { RunFlags } from "./ChangeGroups";
import { run } from "../_helpers/testRun.fixture";
import { TestRun } from "../types";

// as an older version kept them on the row, and the socket still sends them
const withWarnings = (fields: Partial<TestRun>) =>
  ({
    ...run(fields),
    captureWarnings: JSON.stringify([
      { kind: "loading", message: "Taken before the screen settled" },
      { kind: "screen-mismatch", message: "This does not look like it" },
    ]),
  }) as TestRun;

describe("RunFlags", () => {
  it("shows hidden changes but no warnings saved before", () => {
    const flags = render(
      <RunFlags run={withWarnings({ semanticChangeCount: 2 })} />,
    );
    expect(flags.getByText("2 hidden")).toBeInTheDocument();
    expect(flags.queryByText("Loading")).toBeNull();
    expect(flags.queryByText("Other screen?")).toBeNull();

    const none = render(<RunFlags run={withWarnings({})} />);
    expect(none.container).toBeEmptyDOMElement();
  });
});
