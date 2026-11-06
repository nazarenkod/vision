import React from "react";
import { render, screen } from "@testing-library/react";
import { StepProgress } from "./StepProgress";

describe("StepProgress", () => {
  it("says the position and how many are decided and left", () => {
    render(
      <StepProgress
        statuses={["approved", "unresolved", "new", "unresolved"]}
        currentIndex={1}
      />,
    );
    expect(screen.getByTestId("stepPosition")).toHaveTextContent("2 of 4");
    expect(screen.getByTestId("stepCounts")).toHaveTextContent(
      "1 decided · 2 left",
    );
    // one segment per step: decided, current, and the two still ahead
    const segments = screen
      .getByTestId("stepDots")
      .querySelectorAll("[data-state]");
    expect(
      Array.from(segments).map((segment) => segment.getAttribute("data-state")),
    ).toEqual(["approved", "current", "waiting", "waiting"]);
  });

  it("shows only the position when there is one screen", () => {
    render(<StepProgress statuses={["unresolved"]} currentIndex={0} />);
    expect(screen.getByTestId("stepProgress")).toHaveTextContent(/^1 of 1$/);
    expect(screen.queryByTestId("stepDots")).toBeNull();
    expect(screen.queryByTestId("stepCounts")).toBeNull();
  });

  it("names the queue after the position", () => {
    render(
      <StepProgress
        statuses={["unresolved"]}
        currentIndex={0}
        queue={<span>To review</span>}
      />,
    );
    expect(screen.getByTestId("stepPosition")).toHaveTextContent(
      "1 of 1 in To review",
    );
    expect(screen.getByTestId("queuePosition")).toHaveTextContent("1 of 1");
  });
});
