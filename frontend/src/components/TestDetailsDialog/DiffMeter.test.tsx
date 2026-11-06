import React from "react";
import { render, screen } from "@testing-library/react";
import { DiffMeter } from "./DiffMeter";
import { LanguageProvider } from "../../i18n";
import { STORAGE_KEY } from "../../i18n/translate";
import { tokens } from "../../theme";

describe("DiffMeter", () => {
  afterEach(() => window.localStorage.removeItem(STORAGE_KEY));

  it("says the changed share against the allowed one in words", () => {
    window.localStorage.setItem(STORAGE_KEY, "uk");
    const { rerender } = render(
      <LanguageProvider>
        <DiffMeter diffPercent={0.52} tolerancePercent={0.5} />
      </LanguageProvider>,
    );
    const meter = screen.getByTestId("diffMeter");
    expect(meter).toHaveTextContent(/^змінено 0,52%·дозволено 0,5%$/);
    // no bar: the numbers are the whole of it
    expect(screen.queryByTestId("diffFill")).toBeNull();
    expect(screen.queryByTestId("toleranceMark")).toBeNull();
    // over the tolerance: the changed share in the failed colour
    expect(screen.getByTestId("diffValue")).toHaveStyle({
      color: tokens.status.failed.fg,
    });

    rerender(
      <LanguageProvider>
        <DiffMeter diffPercent={0.4} tolerancePercent={0.5} />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("diffValue")).toHaveStyle({
      color: tokens.text,
    });

    // no tolerance: only the changed share
    rerender(
      <LanguageProvider>
        <DiffMeter diffPercent={1.24} tolerancePercent={0} />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("diffMeter")).toHaveTextContent(
      /^змінено 1,24%$/,
    );
    expect(screen.queryByTestId("diffAllowed")).toBeNull();
  });
});
