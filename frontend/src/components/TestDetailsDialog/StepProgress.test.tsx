import React from "react";
import { render, screen } from "@testing-library/react";
import { StepProgress } from "./StepProgress";

describe("StepProgress", () => {
  it("says the position without counts", () => {
    render(
      <StepProgress
        statuses={["approved", "unresolved", "new", "unresolved"]}
        currentIndex={1}
      />,
    );
    expect(screen.getByTestId("stepProgress")).toHaveTextContent(/^2 of 4$/);
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
