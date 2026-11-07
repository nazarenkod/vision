import { jiraTypeOptions, selectedJiraType } from "./jiraTypes.helper";

const types = [
  { name: "Bug", subtask: false },
  { name: "Story", subtask: false },
  { name: "Sub-bug", subtask: true },
];

describe("jiraTypeOptions", () => {
  it("starts with Automatic, which saves an empty value", () => {
    const [first] = jiraTypeOptions(types, "Bug");
    expect(first).toEqual({ value: "", label: "Automatic" });
  });

  it("groups sub-tasks apart from other issue types", () => {
    const options = jiraTypeOptions(types, null);
    expect(options.map((option) => [option.value, option.group])).toEqual([
      ["", undefined],
      ["Bug", "Issue types"],
      ["Story", "Issue types"],
      ["Sub-bug", "Sub-tasks"],
    ]);
    // link types have no sub-tasks and so no groups
    expect(
      jiraTypeOptions([{ name: "Relates" }], null).every(
        (option) => !option.group,
      ),
    ).toBe(true);
  });

  it("keeps a saved type Jira does not return, marked", () => {
    const options = jiraTypeOptions(types, "Defect");
    expect(options[1]).toEqual({
      value: "Defect",
      label: "Defect — not in this Jira",
      missing: true,
    });
    expect(selectedJiraType(options, "Defect")).toBe("Defect");
  });

  it("takes a saved name in another case as Jira's own", () => {
    const options = jiraTypeOptions(types, "bug");
    expect(options.some((option) => option.missing)).toBe(false);
    expect(selectedJiraType(options, "bug")).toBe("Bug");
    expect(selectedJiraType(options, "")).toBe("");
  });
});
