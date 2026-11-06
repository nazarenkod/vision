import { routes } from "../constants/routes";
import type { MessageKey } from "../i18n";
import type { User } from "../types";

// The labelled sidebar (spec 046, ADR-0028): which items it holds, which one is
// the page on screen, and what the project switcher says.

export type SideNavKey =
  "projects" | "users" | "backups" | "builds" | "baselines" | "insights";

export interface SideNavItem {
  key: SideNavKey;
  label: MessageKey;
  /** the items above the switcher, or the chosen project's ones below it */
  group: "main" | "project";
  /** null while the item cannot be opened */
  to: string | null;
  disabled: boolean;
}

const PROJECT_ITEMS: Array<{
  key: SideNavKey;
  label: MessageKey;
  to: (projectId: string) => string;
}> = [
  { key: "builds", label: "nav.builds", to: (id) => `${routes.HOME}${id}` },
  {
    key: "baselines",
    label: "nav.baselines",
    to: (id) => `${routes.VARIATION_LIST_PAGE}/${id}`,
  },
  {
    key: "insights",
    label: "nav.insights",
    to: (id) => `${routes.INSIGHTS_PAGE}/${id}`,
  },
];

/**
 * Projects for everyone, Users and Backups for admins, then the project's own
 * items: always there, so the menu does not jump, but inactive until a project
 * the user can see is chosen (REQ-046-20, -22, -27).
 */
export function sideNavItems(
  role: User["role"] | undefined,
  projectId: string | null | undefined,
  projectCount: number,
): SideNavItem[] {
  const main: SideNavItem[] = [
    {
      key: "projects",
      label: "nav.projects",
      group: "main",
      to: routes.PROJECT_LIST_PAGE,
      disabled: false,
    },
  ];
  if (role === "admin") {
    main.push(
      {
        key: "users",
        label: "nav.users",
        group: "main",
        to: routes.USER_LIST_PAGE,
        disabled: false,
      },
      {
        key: "backups",
        label: "nav.backups",
        group: "main",
        to: routes.BACKUPS_PAGE,
        disabled: false,
      },
    );
  }
  const open = !!projectId && projectCount > 0;
  return [
    ...main,
    ...PROJECT_ITEMS.map(({ key, label, to }) => ({
      key,
      label,
      group: "project" as const,
      to: open && projectId ? to(projectId) : null,
      disabled: !open,
    })),
  ];
}

// pages with a name of their own; any other single segment is a project's builds
const NAMED_PAGES = new Set([
  "projects",
  "users",
  "backups",
  "variations",
  "insights",
  "profile",
  "login",
  "register",
  "r",
  "report",
]);

/** The item the page on screen belongs to; none for Profile, which is the account's. */
export function activeSideNavItem(pathname: string): SideNavKey | null {
  const [first] = pathname.split("/").filter(Boolean);
  if (!first) return null;
  if (first === "projects") return "projects";
  if (first === "users") return "users";
  if (first === "backups") return "backups";
  if (first === "variations") return "baselines";
  if (first === "insights") return "insights";
  if (NAMED_PAGES.has(first)) return null;
  return "builds";
}

export type SwitcherState =
  | { kind: "noProjects"; label: MessageKey }
  | { kind: "choose"; label: MessageKey }
  | { kind: "project"; name: string };

/** What the project switcher says: the chosen project, or why there is none. */
export function projectSwitcherState(
  projects: Array<{ id: string; name: string }>,
  projectId: string | null | undefined,
): SwitcherState {
  if (projects.length === 0) {
    return { kind: "noProjects", label: "nav.noProjects" };
  }
  const chosen = projects.find((project) => project.id === projectId);
  return chosen
    ? { kind: "project", name: chosen.name }
    : { kind: "choose", label: "nav.chooseProject" };
}

/** Switching the project keeps the section: Baselines stay Baselines. */
export function projectSectionPath(pathname: string, projectId: string) {
  const section = activeSideNavItem(pathname);
  const item = PROJECT_ITEMS.find(({ key }) => key === section);
  return (item ?? PROJECT_ITEMS[0]).to(projectId);
}
