import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { BrandLockup, BrandMark, LOGO_PLAY_MS, Wordmark } from "./BrandMark";
import { tokens } from "../theme";

describe("BrandMark", () => {
  it("draws the nest mark and the two square dots", () => {
    const { container } = render(<BrandLockup />);
    const mark = screen.getByTestId("brandMark");
    // the tile is cut by a mask, and the pixel sits in that notch
    expect(mark.querySelector("mask rect[fill='black']")).not.toBeNull();
    const pixel = screen.getByTestId("brandPixel");
    expect(pixel.tagName.toLowerCase()).toBe("rect");
    expect(pixel.getAttribute("width")).toBe("6.8");
    expect(pixel.getAttribute("height")).toBe("6.8");
    expect(mark.querySelector("path")?.getAttribute("d")).toBe(
      "M7.4 13.2 L13.7 25 L20 13.2",
    );
    const word = screen.getByRole("img", { name: "Vision" });
    expect(word.textContent).toBe("vısıon");
    expect(screen.getAllByTestId("wordmarkDot")).toHaveLength(2);
    expect(container.innerHTML).not.toContain("eye");
  });

  it("has no magenta at rest", () => {
    render(
      <>
        <BrandMark playing={false} />
        <Wordmark playing={false} />
      </>,
    );
    const mark = screen.getByTestId("brandMark");
    expect(mark.getAttribute("data-playing")).toBe("false");
    for (const element of [
      mark,
      ...Array.from(mark.querySelectorAll("*")),
      ...screen.getAllByTestId("wordmarkDot"),
    ]) {
      const style = window.getComputedStyle(element as Element);
      expect(style.animationName || "none").toMatch(/^(none|)$/);
      expect(
        (element as HTMLElement).getAttribute("style") ?? "",
      ).not.toContain(tokens.diff);
    }
  });

  it("plays slowly enough to see the pixel leave and come back", () => {
    expect(LOGO_PLAY_MS).toBeGreaterThanOrEqual(2000);
    expect(LOGO_PLAY_MS).toBeLessThanOrEqual(2400);
  });

  it("plays once on mount and again on hover", () => {
    render(<BrandMark />);
    const mark = screen.getByTestId("brandMark");
    expect(mark.getAttribute("data-playing")).toBe("true");
    fireEvent.animationEnd(screen.getByTestId("brandPixel"));
    expect(mark.getAttribute("data-playing")).toBe("false");
    fireEvent.mouseEnter(mark);
    expect(mark.getAttribute("data-playing")).toBe("true");
  });

  it("stays still when the system asks for less motion", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    try {
      render(<BrandMark />);
      const mark = screen.getByTestId("brandMark");
      expect(mark.getAttribute("data-playing")).toBe("false");
      fireEvent.mouseEnter(mark);
      expect(mark.getAttribute("data-playing")).toBe("false");
    } finally {
      window.matchMedia = original;
    }
  });
});
