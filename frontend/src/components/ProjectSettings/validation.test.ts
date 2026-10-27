import { DEFAULT_PROJECT_EDIT_STATE } from "../../constants";
import { ImageComparison } from "../../types/imageComparison";
import { validateProject } from "./validation";

const project = {
  ...DEFAULT_PROJECT_EDIT_STATE,
  id: "p",
  name: "AOS",
  mainBranchName: "main",
};

describe("validateProject", () => {
  it("passes the project as the API creates it", () => {
    expect(validateProject(project)).toEqual([]);
  });

  it("points each problem at its field and tab, in the order of the tabs", () => {
    const errors = validateProject({
      ...project,
      name: "A",
      maxBuildAllowed: 0,
      imageComparison: ImageComparison.pixelmatch,
      imageComparisonConfig: JSON.stringify({ threshold: 2 }),
      jiraUrl: "jira",
    });
    expect(errors.map((error) => [error.field, error.tab])).toEqual([
      ["name", "general"],
      ["buildCount", "general"],
      ["threshold", "comparison"],
      ["jiraUrl", "jira"],
    ]);
  });

  it("reports a pattern that does not compile", () => {
    const errors = validateProject({
      ...project,
      uiTreeSettings: JSON.stringify({
        a11yClasses: [{ id: "c1", name: "Tabs", when: { element: ["/(/"] } }],
        elementRules: [{ id: "r1", selector: "clock", action: "ignore" }],
      }),
    });
    expect(errors).toEqual([
      expect.objectContaining({ field: "rule-r1", tab: "mobile" }),
      expect.objectContaining({
        field: "class-c1",
        tab: "accessibility",
        message: "validation.pattern",
      }),
    ]);
  });
});
