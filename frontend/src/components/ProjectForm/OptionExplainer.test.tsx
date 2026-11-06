import React from "react";
import {
  fireEvent,
  render,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { LanguageProvider } from "../../i18n/LanguageProvider";
import { OptionExplainer } from "./OptionExplainer";

const reduceMotion = (reduce: boolean) =>
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });

const renderExplainer = (on = true) =>
  render(
    <LanguageProvider>
      <OptionExplainer option="moves" on={on} />
    </LanguageProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  reduceMotion(false);
});

describe("OptionExplainer", () => {
  it("plays the animation only while the hint is open", async () => {
    const page = renderExplainer();
    expect(page.queryByTestId("explainerAnimation")).toBeNull();
    fireEvent.click(
      page.getByRole("button", { name: "What this option does" }),
    );
    expect(page.getByTestId("explainerAnimation")).toHaveAttribute(
      "data-animated",
      "true",
    );
    // Esc closes the hint, and the animation goes with it (REQ-049-24, 28)
    fireEvent.keyDown(page.getByTestId("explainer-moves"), { key: "Escape" });
    await waitForElementToBeRemoved(() =>
      page.queryByTestId("explainerAnimation"),
    );
  });

  it("shows two still frames when motion is reduced", () => {
    reduceMotion(true);
    const page = renderExplainer();
    fireEvent.click(page.getByTestId("explain-moves"));
    expect(page.queryByTestId("explainerAnimation")).toBeNull();
    expect(page.getByTestId("explainerFrame-before")).toHaveAttribute(
      "data-animated",
      "false",
    );
    expect(page.getByTestId("explainerFrame-after")).toBeInTheDocument();
    // the change is marked in the after frame only
    expect(
      page
        .getByTestId("explainerFrame-before")
        .querySelectorAll("[data-testid=explainerMark]"),
    ).toHaveLength(0);
    expect(
      page
        .getByTestId("explainerFrame-after")
        .querySelectorAll("[data-testid=explainerMark]"),
    ).toHaveLength(1);
  });

  it("describes the animation for screen readers", () => {
    const page = renderExplainer(false);
    fireEvent.click(page.getByTestId("explain-moves"));
    expect(
      page.getByRole("img", {
        name: "A banner pushes the list down. With the option off, the banner and every row it moved are changes.",
      }),
    ).toBeInTheDocument();
  });
});
