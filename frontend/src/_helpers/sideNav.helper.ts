import { routes } from "../constants/routes";
import type { MessageKey } from "../i18n";
import type { User } from "../types";

// The sidebar with a project rail (spec 060, ADR-0028): which items the section
// panel holds, which one is the page on screen, what its heading says and what
// a project's tile reads.

export type SideNavKey =
  "builds" | "baselines" | "insights" | "users" | "backups";

export interface SideNavItem {
  key: SideNavKey;
  label: MessageKey;
  /** the chosen project's sections, or Administration at the bottom */
  group: "project" | "admin";
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
 * The project's sections, always there so the panel does not jump but inactive
 * until a project the user can see is chosen, then Users and Backups for admins
 * (REQ-060-10, -11, -12, -13).
 */
export function sideNavItems(
  role: User["role"] | undefined,
  projectId: string | null | undefined,
  projectCount: number,
): SideNavItem[] {
  const open = !!projectId && projectCount > 0;
  const project = PROJECT_ITEMS.map(({ key, label, to }) => ({
    key,
    label,
    group: "project" as const,
    to: open && projectId ? to(projectId) : null,
    disabled: !open,
  }));
  if (role !== "admin") return project;
  return [
    ...project,
    {
      key: "users",
      label: "nav.users",
      group: "admin",
      to: routes.USER_LIST_PAGE,
      disabled: false,
    },
    {
      key: "backups",
      label: "nav.backups",
      group: "admin",
      to: routes.BACKUPS_PAGE,
      disabled: false,
    },
  ];
}

// pages with a name of their own; any other single segment is a project's builds
const NAMED_PAGES = new Set([
  "projects",
  "users",
  "backups",
  "variations",
  "insights",
  "search",
  "profile",
  "login",
  "register",
  "r",
  "report",
]);

/** The item the page on screen belongs to; none for Projects and Profile. */
export function activeSideNavItem(pathname: string): SideNavKey | null {
  const [first] = pathname.split("/").filter(Boolean);
  if (!first) return null;
  if (first === "users") return "users";
  if (first === "backups") return "backups";
  if (first === "variations") return "baselines";
  if (first === "insights") return "insights";
  if (NAMED_PAGES.has(first)) return null;
  return "builds";
}

export type HeadingState =
  | { kind: "noProjects"; label: MessageKey }
  | { kind: "choose"; label: MessageKey }
  | { kind: "project"; name: string };

/** What the section panel's heading says: the chosen project, or why there is none. */
export function projectHeadingState(
  projects: Array<{ id: string; name: string }>,
  projectId: string | null | undefined,
): HeadingState {
  if (projects.length === 0) {
    return { kind: "noProjects", label: "nav.noProjects" };
  }
  const chosen = projects.find((project) => project.id === projectId);
  return chosen
    ? { kind: "project", name: chosen.name }
    : { kind: "choose", label: "nav.chooseProject" };
}

/** Switching the project keeps the section: Baselines stay Baselines; elsewhere Builds. */
export function projectSectionPath(pathname: string, projectId: string) {
  const section = activeSideNavItem(pathname);
  const item = PROJECT_ITEMS.find(({ key }) => key === section);
  return (item ?? PROJECT_ITEMS[0]).to(projectId);
}

/**
 * What a project's tile reads (REQ-060-02): a name of three characters or fewer
 * as it is (iOS, AOS, Web); several words by their first letters, three at most;
 * one longer word by its first two letters. The full name is the tile's label.
 */
export function projectTileLabel(name: string): string {
  const trimmed = name.trim();
  const chars = Array.from(trimmed);
  if (chars.length === 0) return "?";
  if (chars.length <= 3) return trimmed;
  const words = trimmed.split(/[\s_\-./]+/).filter(Boolean);
  if (words.length > 1) {
    return words
      .slice(0, 3)
      .map((word) => Array.from(word)[0].toUpperCase())
      .join("");
  }
  const [first, second] = chars;
  return first.toUpperCase() + second.toLowerCase();
}
