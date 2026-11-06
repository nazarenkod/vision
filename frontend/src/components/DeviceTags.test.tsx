import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { BranchTag, DeviceTags, TagOverflow } from "./DeviceTags";
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

  it("hides the tags that do not fit behind +N", async () => {
    // jsdom lays nothing out: a 200 px line, 60 px tags and a 30 px "+N"
    const rect = jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const width =
          this.dataset.testid === "tagOverflow"
            ? 200
            : this.parentElement?.dataset.testid === "overflowRuler"
              ? this.textContent?.startsWith("+")
                ? 30
                : 60
              : 0;
        return { width } as DOMRect;
      });
    const tags = ["Pixel 4 XL", "Android 14", "checkout", "ru_RU", "dark"];
    render(
      <ThemeProvider theme={createAppTheme("light")}>
        <TagOverflow tags={tags} />
      </ThemeProvider>,
    );

    // 60 + 4 + 60 + 4 + 30 fits in 200, a third tag would not
    expect(
      screen.getAllByTestId("overflowTag").map((tag) => tag.textContent),
    ).toEqual(["Pixel 4 XL", "Android 14"]);
    const more = screen.getByTestId("overflowTagsMore");
    expect(more.textContent).toBe("+3");
    expect(more.className).toContain("MuiChip-colorDefault");
    fireEvent.mouseOver(more);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "checkout, ru_RU, dark",
    );
    rect.mockRestore();
  });

  it("shows every tag and no +N when they all fit", () => {
    render(
      <ThemeProvider theme={createAppTheme("light")}>
        <TagOverflow tags={["Pixel 4 XL", "Android 14"]} />
      </ThemeProvider>,
    );
    expect(screen.getAllByTestId("overflowTag")).toHaveLength(2);
    expect(screen.queryByTestId("overflowTagsMore")).toBeNull();
  });
});
