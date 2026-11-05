import {
  activeSideNavItem,
  projectSectionPath,
  projectSwitcherState,
  sideNavItems,
} from "./sideNav.helper";

const projects = [
  { id: "p1", name: "Mobile Shop" },
  { id: "p2", name: "Bank" },
];

describe("sideNav helper", () => {
  it("lists the labelled items for the role", () => {
    const admin = sideNavItems("admin", "p1", projects.length);
    expect(admin.map((item) => [item.key, item.label, item.to])).toEqual([
      ["projects", "nav.projects", "/projects"],
      ["users", "nav.users", "/users"],
      ["backups", "nav.backups", "/backups"],
      ["builds", "nav.builds", "/p1"],
      ["baselines", "nav.baselines", "/variations/p1"],
      ["insights", "nav.insights", "/insights/p1"],
    ]);
    expect(admin.every((item) => !item.disabled)).toBe(true);

    for (const role of ["editor", "guest"] as const) {
      expect(sideNavItems(role, "p1", 2).map((item) => item.key)).toEqual([
        "projects",
        "builds",
        "baselines",
        "insights",
      ]);
    }
  });

  it("says Choose project and disables project items until one is picked", () => {
    expect(projectSwitcherState(projects, null)).toEqual({
      kind: "choose",
      label: "nav.chooseProject",
    });
    // a project that is no longer in the list is not a choice either
    expect(projectSwitcherState(projects, "gone").kind).toBe("choose");
    const project = sideNavItems("editor", null, 2).filter(
      (item) => item.group === "project",
    );
    expect(project.map((item) => item.key)).toEqual([
      "builds",
      "baselines",
      "insights",
    ]);
    expect(project.every((item) => item.disabled && item.to === null)).toBe(
      true,
    );

    expect(projectSwitcherState(projects, "p2")).toEqual({
      kind: "project",
      name: "Bank",
    });
  });

  it("says No projects yet without any project", () => {
    expect(projectSwitcherState([], null)).toEqual({
      kind: "noProjects",
      label: "nav.noProjects",
    });
    const items = sideNavItems("guest", "p1", 0);
    expect(
      items.filter((item) => item.group === "project").map((i) => i.disabled),
    ).toEqual([true, true, true]);
    expect(items.find((item) => item.key === "projects")?.disabled).toBe(false);
  });

  it("marks the item of the page on screen", () => {
    expect(activeSideNavItem("/projects")).toBe("projects");
    expect(activeSideNavItem("/projects/p1/settings")).toBe("projects");
    expect(activeSideNavItem("/p1")).toBe("builds");
    expect(activeSideNavItem("/variations/p1")).toBe("baselines");
    expect(activeSideNavItem("/variations/details/v1")).toBe("baselines");
    expect(activeSideNavItem("/insights/p1")).toBe("insights");
    expect(activeSideNavItem("/users")).toBe("users");
    expect(activeSideNavItem("/backups")).toBe("backups");
    expect(activeSideNavItem("/profile")).toBeNull();
    expect(activeSideNavItem("/")).toBeNull();
  });

  it("keeps the section when the project changes", () => {
    expect(projectSectionPath("/variations/p1", "p2")).toBe("/variations/p2");
    expect(projectSectionPath("/insights/p1", "p2")).toBe("/insights/p2");
    expect(projectSectionPath("/p1", "p2")).toBe("/p2");
    expect(projectSectionPath("/projects", "p2")).toBe("/p2");
  });
});
