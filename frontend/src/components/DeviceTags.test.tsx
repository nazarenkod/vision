import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { BranchTag, DeviceTags } from "./DeviceTags";
import { createAppTheme } from "../theme";

describe("DeviceTags", () => {
  it("shows tags and the branch as one grey chip shape", () => {
    render(
      <ThemeProvider theme={createAppTheme("light")}>
        <DeviceTags parts={{ device: "Pixel 4 XL", os: "Android 14" }} />
        <BranchTag branch="release/7.4" />
      </ThemeProvider>,
    );
    const tags = screen.getAllByTestId("deviceTag");
    const branch = screen.getByTestId("branchTag");
    expect(tags.map((tag) => tag.textContent)).toEqual([
      "Pixel 4 XL",
      "Android 14",
    ]);
    const look = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      return {
        radius: style.borderRadius,
        background: style.backgroundColor,
        border: style.borderStyle,
      };
    };
    // one shape: corners of 6 px, the same grey fill, no outline
    for (const chip of [...tags, branch]) {
      expect(look(chip)).toEqual(look(tags[0]));
      expect(chip.className).toContain("MuiChip-filled");
      expect(chip.className).toContain("MuiChip-colorDefault");
    }
    expect(look(tags[0]).radius).toBe("6px");
    // the branch differs only by its icon
    expect(branch.textContent).toBe("release/7.4");
    expect(branch.querySelector("svg")).not.toBeNull();
    expect(tags[0].querySelector("svg")).toBeNull();
  });
});
