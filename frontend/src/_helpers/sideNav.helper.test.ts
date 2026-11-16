import {
  activeSideNavItem,
  projectHeadingState,
  projectSectionPath,
  projectTileLabel,
  sideNavItems,
} from "./sideNav.helper";

const projects = [
  { id: "p1", name: "Mobile Shop" },
  { id: "p2", name: "Bank" },
];

describe("sideNav helper", () => {
  it("lists the project sections under the project's name", () => {
    expect(projectHeadingState(projects, "p2")).toEqual({
      kind: "project",
      name: "Bank",
    });
    const items = sideNavItems("editor", "p1", projects.length);
    expect(items.map((item) => [item.key, item.label, item.to])).toEqual([
      ["builds", "nav.builds", "/p1"],
      ["baselines", "nav.baselines", "/variations/p1"],
      ["insights", "nav.insights", "/insights/p1"],
    ]);
    expect(items.every((item) => item.group === "project")).toBe(true);
    expect(items.every((item) => !item.disabled)).toBe(true);
  });

  it("puts Users and Backups under Administration for an admin only", () => {
    const admin = sideNavItems("admin", "p1", 2);
    expect(
      admin.filter((item) => item.group === "admin").map((item) => item.to),
    ).toEqual(["/users", "/backups"]);
    // administration comes after the project's sections
    expect(admin.map((item) => item.key)).toEqual([
      "builds",
      "baselines",
      "insights",
      "users",
      "backups",
    ]);
    for (const role of ["editor", "guest"] as const) {
      expect(
        sideNavItems(role, "p1", 2).some((item) => item.group === "admin"),
      ).toBe(false);
    }
  });

  it("says Choose project and disables project items until one is picked", () => {
    expect(projectHeadingState(projects, null)).toEqual({
      kind: "choose",
      label: "nav.chooseProject",
    });
    // a project that is no longer in the list is not a choice either
    expect(projectHeadingState(projects, "gone").kind).toBe("choose");
    const items = sideNavItems("editor", null, 2);
    expect(items.every((item) => item.disabled && item.to === null)).toBe(true);
  });

  it("says No projects yet without any project", () => {
    expect(projectHeadingState([], null)).toEqual({
      kind: "noProjects",
      label: "nav.noProjects",
    });
    const items = sideNavItems("admin", "p1", 0);
    expect(
      items.filter((item) => item.group === "project").map((i) => i.disabled),
    ).toEqual([true, true, true]);
    // administration does not wait for a project
    expect(
      items.filter((item) => item.group === "admin").map((i) => i.disabled),
    ).toEqual([false, false]);
  });

  it("marks the item of the page on screen", () => {
    expect(activeSideNavItem("/p1")).toBe("builds");
    expect(activeSideNavItem("/variations/p1")).toBe("baselines");
    expect(activeSideNavItem("/variations/details/v1")).toBe("baselines");
    expect(activeSideNavItem("/insights/p1")).toBe("insights");
    expect(activeSideNavItem("/users")).toBe("users");
    expect(activeSideNavItem("/backups")).toBe("backups");
    // pages of no section
    expect(activeSideNavItem("/projects")).toBeNull();
    expect(activeSideNavItem("/projects/p1/settings")).toBeNull();
    expect(activeSideNavItem("/search/p1")).toBeNull();
    expect(activeSideNavItem("/profile")).toBeNull();
    expect(activeSideNavItem("/")).toBeNull();
  });

  it("keeps the section when switching the project", () => {
    expect(projectSectionPath("/variations/p1", "p2")).toBe("/variations/p2");
    expect(projectSectionPath("/insights/p1", "p2")).toBe("/insights/p2");
    expect(projectSectionPath("/p1", "p2")).toBe("/p2");
    expect(projectSectionPath("/projects", "p2")).toBe("/p2");
    expect(projectSectionPath("/profile", "p2")).toBe("/p2");
  });

  it("shortens a project name to at most three characters", () => {
    expect(projectTileLabel("iOS")).toBe("iOS");
    expect(projectTileLabel("AOS")).toBe("AOS");
    expect(projectTileLabel("Web")).toBe("Web");
    expect(projectTileLabel("Mobile Shop Android")).toBe("MSA");
    expect(projectTileLabel("mobile shop android tablet")).toBe("MSA");
    expect(projectTileLabel("Android")).toBe("An");
    expect(projectTileLabel("банк")).toBe("Ба");
    expect(projectTileLabel("  ")).toBe("?");
    // same letters, told apart by the full name in the tile's label
    expect(projectTileLabel("Mobile iOS")).toBe(
      projectTileLabel("Mobile Instant"),
    );
  });
});
