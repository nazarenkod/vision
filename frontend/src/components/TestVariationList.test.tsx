import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TestVariationList from "./TestVariationList";
import Filters from "./Filters";
import { TestVariation } from "../types";
import { baselineSections } from "../_helpers/baselineSections.helper";

jest.mock("../services", () => ({
  staticService: { getImage: (name: string) => name },
}));

const baseline = (name: string, featureName?: string) =>
  ({
    id: name,
    name,
    baselineName: `${name}.png`,
    branchName: "main",
    device: "Pixel 4 XL",
    os: "15",
    browser: "",
    viewport: "",
    customTags: "",
    featureName,
  }) as TestVariation;

describe("TestVariationList (068)", () => {
  it("shows a feature as a framed section with no collapse", () => {
    const sections = baselineSections([
      [baseline("Autofill", "Envelopes")],
      [baseline("New envelope", "Envelopes")],
      [baseline("QR checkout")],
    ]);
    render(
      <MemoryRouter>
        <TestVariationList sections={sections} onDeleteClick={jest.fn()} />
      </MemoryRouter>,
    );

    const feature = screen.getByRole("region", { name: "Envelopes" });
    expect(within(feature).getByRole("heading").textContent).toBe(
      "Envelopes· 2 checks",
    );
    expect(within(feature).getAllByTestId("baselineCard")).toHaveLength(2);
    // nothing to fold: the frame is always open
    expect(
      within(feature).queryByRole("button", { expanded: true }),
    ).toBeNull();
    expect(
      within(feature).queryByRole("button", { expanded: false }),
    ).toBeNull();

    const plain = screen.getByTestId("baselinesWithoutFeature");
    expect(within(plain).queryByRole("heading")).toBeNull();
    expect(within(plain).getAllByTestId("baselineCard")).toHaveLength(1);
  });

  it("offers the feature filter", () => {
    const setFeature = jest.fn();
    const noFilter: [string, jest.Mock] = ["", jest.fn()];
    render(
      <Filters
        items={[
          baseline("a", "Envelopes"),
          baseline("b", "Credit"),
          baseline("c"),
        ]}
        queryState={["", jest.fn()]}
        osState={noFilter}
        deviceState={noFilter}
        browserState={noFilter}
        viewportState={noFilter}
        customTagsState={noFilter}
        featureState={["", setFeature]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Feature" }));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["All", "Credit", "Envelopes"]);
    fireEvent.click(screen.getByRole("option", { name: "Envelopes" }));
    expect(setFeature).toHaveBeenCalledWith("Envelopes");
  });
});
