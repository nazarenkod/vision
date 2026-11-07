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
    expect(page.queryByTestId("explainerCurrent")).toBeNull();
    fireEvent.click(
      page.getByRole("button", { name: "What this option does" }),
    );
    expect(page.getByTestId("explainerCurrent")).toHaveAttribute(
      "data-animated",
      "true",
    );
    // Esc closes the hint, and the animation goes with it (REQ-049-24, 28)
    fireEvent.keyDown(page.getByTestId("explainer-moves"), { key: "Escape" });
    await waitForElementToBeRemoved(() =>
      page.queryByTestId("explainerCurrent"),
    );
  });

  it("shows still pictures when motion is reduced", () => {
    reduceMotion(true);
    const page = renderExplainer();
    fireEvent.click(page.getByTestId("explain-moves"));
    expect(page.getByTestId("explainerReference")).toHaveAttribute(
      "data-animated",
      "false",
    );
    expect(page.getByTestId("explainerCurrent")).toHaveAttribute(
      "data-animated",
      "false",
    );
  });

  it("shows the outcome with the option off and on, the project's own marked", () => {
    const page = renderExplainer(false);
    fireEvent.click(page.getByTestId("explain-moves"));
    const off = page.getByTestId("explainerResult-off");
    const on = page.getByTestId("explainerResult-on");
    expect(off).toHaveAttribute("data-now", "true");
    expect(on).toHaveAttribute("data-now", "false");
    expect(off).toHaveTextContent("5 changed");
    expect(off).toHaveTextContent("now in this project");
    expect(on).toHaveTextContent("1 changed");
    expect(off.querySelectorAll("[data-testid=explainerMark]")).toHaveLength(5);
  });

  it("describes the animation for screen readers", () => {
    const page = renderExplainer(true);
    fireEvent.click(page.getByTestId("explain-moves"));
    expect(
      page.getByRole("img", {
        name: "Current: A banner came in on top and pushed the list down.",
      }),
    ).toBeInTheDocument();
    expect(
      page.getByRole("img", { name: "Option on: 1 changed" }),
    ).toBeInTheDocument();
  });
});
