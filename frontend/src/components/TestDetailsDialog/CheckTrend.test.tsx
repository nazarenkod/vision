import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CheckTrend } from "./CheckTrend";
import { formatDate } from "../../i18n/translate";
import { TestStatus } from "../../types/testStatus";
import { testRunService } from "../../services";

jest.mock("../../services", () => ({
  testRunService: { getTrend: jest.fn() },
}));

const getTrend = testRunService.getTrend as jest.Mock;

const point = (
  id: string,
  buildNumber: number,
  status: TestStatus,
  diffPercent: number,
) => ({
  id,
  buildNumber,
  status,
  diffPercent,
  createdAt: "2026-10-31T12:00:00.000Z",
});

describe("CheckTrend", () => {
  beforeEach(() => getTrend.mockReset());

  it("names the build, the share, the status and the date of a run on hover", async () => {
    getTrend.mockResolvedValue([
      point("older", 127, TestStatus.ok, 0),
      point("current", 128, TestStatus.approved, 1.24),
    ]);
    render(<CheckTrend testRunId="current" />);

    const bars = await screen.findAllByTestId("trendBar");
    expect(bars).toHaveLength(2);
    expect(screen.getByTestId("checkTrend")).toHaveAttribute(
      "aria-label",
      "Trend of the check over the last 2 runs",
    );
    // the current run ends the trend and is the one outlined
    expect(bars[1]).toHaveAttribute("data-current", "true");
    expect(bars[0]).not.toHaveAttribute("data-current");

    fireEvent.mouseOver(bars[1]);
    const date = formatDate("2026-10-31T12:00:00.000Z", "en", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      `#128 · 1.24% · approved · ${date}`,
    );
  });

  it("shows nothing when the trend cannot be loaded", async () => {
    getTrend.mockRejectedValue(new Error("offline"));
    const { container } = render(<CheckTrend testRunId="current" />);
    // the width is kept while it loads
    expect(screen.getByTestId("checkTrendLoading")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId("checkTrendLoading")).toBeNull(),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("asks again when another run is opened", async () => {
    getTrend.mockResolvedValue([point("a", 1, TestStatus.ok, 0)]);
    const { rerender } = render(<CheckTrend testRunId="a" />);
    await screen.findByTestId("checkTrend");
    getTrend.mockResolvedValue([point("b", 2, TestStatus.new, 0)]);
    rerender(<CheckTrend testRunId="b" />);
    await waitFor(() => expect(getTrend).toHaveBeenLastCalledWith("b"));
    expect(await screen.findByTestId("trendBar")).toHaveAttribute(
      "data-status",
      TestStatus.new,
    );
  });
});
