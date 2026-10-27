import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { SettingRow } from "./SettingRow";

describe("SettingRow", () => {
  it("offers the default back once the value differs", () => {
    const onReset = jest.fn();
    const row = render(
      <SettingRow
        label="Warn about loading states"
        help="Spinners mean the screenshot was taken too early."
        defaultText="on"
        changed={false}
        onReset={onReset}
      >
        <input />
      </SettingRow>,
    );
    expect(row.getByText("Default: on")).toBeInTheDocument();
    expect(row.queryByRole("button", { name: "Reset to default" })).toBeNull();

    row.rerender(
      <SettingRow
        label="Warn about loading states"
        defaultText="on"
        changed
        onReset={onReset}
      >
        <input />
      </SettingRow>,
    );
    fireEvent.click(row.getByRole("button", { name: "Reset to default" }));
    expect(onReset).toHaveBeenCalled();
  });
});
