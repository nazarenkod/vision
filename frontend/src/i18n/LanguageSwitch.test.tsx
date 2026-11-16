import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { LanguageProvider, useT } from "./LanguageProvider";
import { LanguageSwitch } from "./LanguageSwitch";
import { STORAGE_KEY } from "./translate";

const Page = () => {
  const { t } = useT();
  const [text, setText] = React.useState("");
  return (
    <>
      <LanguageSwitch />
      <h1>{t("settings.title")}</h1>
      <input
        aria-label="draft"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </>
  );
};

const renderPage = () =>
  render(
    <LanguageProvider>
      <Page />
    </LanguageProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = "";
});

describe("LanguageSwitch", () => {
  it("offers English and Ukrainian", () => {
    const page = renderPage();
    expect(page.getByRole("button", { name: "English" })).toBeInTheDocument();
    expect(
      page.getByRole("button", { name: "Українська" }),
    ).toBeInTheDocument();
  });

  it("switches the texts without a reload", () => {
    const page = renderPage();
    fireEvent.change(page.getByLabelText("draft"), {
      target: { value: "typed" },
    });
    expect(page.getByRole("heading")).toHaveTextContent("Settings");

    act(() => {
      fireEvent.click(page.getByRole("button", { name: "Українська" }));
    });

    expect(page.getByRole("heading")).toHaveTextContent("Налаштування");
    // the page was not rebuilt: what was typed is still there
    expect(page.getByLabelText("draft")).toHaveValue("typed");
  });

  it("remembers the language in the browser", () => {
    const first = renderPage();
    fireEvent.click(first.getByRole("button", { name: "Українська" }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("uk");
    first.unmount();

    const again = renderPage();
    expect(again.getByRole("heading")).toHaveTextContent("Налаштування");
  });

  it("marks the document with the language", () => {
    const page = renderPage();
    expect(document.documentElement.lang).toBe("en");
    fireEvent.click(page.getByRole("button", { name: "Українська" }));
    expect(document.documentElement.lang).toBe("uk");
  });
});
