import { TestRun } from "../types";
import { ChangeGroup } from "../types/insights";
import { TestStatus } from "../types/testStatus";

// Review queues (031): which screenshots the comparison steps through when it is
// opened from the build overview, and in what order. The key lives in the
// address, so a link opens the same queue; the ids are fixed when the
// comparison opens, so positions do not shift as decisions land.

export type QueueKey =
  | { kind: "all" }
  | { kind: "group"; fingerprint: string }
  | { kind: "device"; profile: string }
  | { kind: "feature"; name: string }
  // a row of the features table for a check its test gave no feature
  | { kind: "check"; name: string }
  | { kind: "run"; id: string };

const WAITING: string[] = [TestStatus.unresolved, TestStatus.new];
export const isWaiting = (run: Pick<TestRun, "status">) =>
  WAITING.includes(run.status);

/** The feature the test sent; checks without one are not grouped (REQ-031-09). */
export const featureOf = (run: Pick<TestRun, "featureName">) =>
  run.featureName?.trim() ?? "";

export const profileOf = (
  run: Pick<TestRun, "device" | "os" | "browser" | "viewport">,
) =>
  [run.device, run.os, run.browser, run.viewport]
    .map((part) => part ?? "")
    .join("|");

export function queueParam(key: QueueKey): string {
  switch (key.kind) {
    case "all":
      return "all";
    case "group":
      return `group:${key.fingerprint}`;
    case "device":
      return `device:${key.profile}`;
    case "feature":
      return `feature:${key.name}`;
    case "check":
      return `check:${key.name}`;
    case "run":
      return `run:${key.id}`;
  }
}

export function parseQueue(param?: string | null): QueueKey | undefined {
  if (!param) return undefined;
  if (param === "all") return { kind: "all" };
  const colon = param.indexOf(":");
  if (colon < 0) return undefined;
  const kind = param.slice(0, colon);
  const value = param.slice(colon + 1);
  if (!value) return undefined;
  switch (kind) {
    case "group":
      return { kind, fingerprint: value };
    case "device":
      return { kind, profile: value };
    case "feature":
    case "check":
      return { kind, name: value };
    case "run":
      return { kind, id: value };
    default:
      return undefined;
  }
}

export const sameQueue = (a?: QueueKey, b?: QueueKey) =>
  !!a && !!b && queueParam(a) === queueParam(b);

/**
 * Every waiting screenshot in the order of the Changes tab: group by group,
 * new ones last; waiting ones no group holds go before the new.
 */
export function waitingInOrder(runs: TestRun[], groups: ChangeGroup[]) {
  const byId = new Map(runs.map((run) => [run.id, run]));
  const seen = new Set<string>();
  const ordered: TestRun[] = [];
  const add = (id: string) => {
    const run = byId.get(id);
    if (run && isWaiting(run) && !seen.has(id)) {
      seen.add(id);
      ordered.push(run);
    }
  };
  groups
    .filter((group) => group.kind !== "new")
    .forEach((group) => group.testRuns.forEach((run) => add(run.id)));
  [...runs]
    .filter((run) => run.status === TestStatus.unresolved)
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((run) => add(run.id));
  groups
    .filter((group) => group.kind === "new")
    .forEach((group) => group.testRuns.forEach((run) => add(run.id)));
  runs.filter(isWaiting).forEach((run) => add(run.id));
  return ordered;
}

/** The ids a queue steps through, in order. */
export function queueIds(
  key: QueueKey,
  runs: TestRun[],
  groups: ChangeGroup[],
): string[] {
  if (key.kind === "run")
    return runs.some((run) => run.id === key.id) ? [key.id] : [];
  if (key.kind === "group") {
    const group = groups.find((g) => g.fingerprint === key.fingerprint);
    if (!group) return [];
    const members = new Set(group.testRuns.map((run) => run.id));
    return waitingInOrder(runs, groups)
      .filter((run) => members.has(run.id))
      .map((run) => run.id);
  }
  const all = waitingInOrder(runs, groups);
  const keep =
    key.kind === "device"
      ? (run: TestRun) => profileOf(run) === key.profile
      : key.kind === "feature"
        ? (run: TestRun) => featureOf(run) === key.name
        : key.kind === "check"
          ? (run: TestRun) => !featureOf(run) && run.name === key.name
          : () => true;
  return all.filter(keep).map((run) => run.id);
}

/** Where a queue starts: the clicked screenshot if it is in it, else the first. */
export const startIndex = (ids: string[], clicked?: string) =>
  Math.max(0, clicked ? ids.indexOf(clicked) : 0);

/**
 * The next screenshot still waiting after this position, skipping those someone
 * else decided meanwhile (REQ-031-27); -1 when the queue is done.
 */
export function nextWaiting(
  ids: string[],
  from: number,
  runs: TestRun[],
): number {
  const byId = new Map(runs.map((run) => [run.id, run]));
  for (let index = from + 1; index < ids.length; index++) {
    const run = byId.get(ids[index]);
    if (run && isWaiting(run)) return index;
  }
  return -1;
}

export interface QueueSummary {
  approved: number;
  rejected: number;
}

const APPROVED: string[] = [
  TestStatus.approved,
  TestStatus.autoApproved,
  TestStatus.ok,
];

export function queueSummary(ids: string[], runs: TestRun[]): QueueSummary {
  const byId = new Map(runs.map((run) => [run.id, run]));
  const statuses = ids.map((id) => byId.get(id)?.status);
  return {
    approved: statuses.filter((s) => !!s && APPROVED.includes(s)).length,
    rejected: statuses.filter((s) => s === TestStatus.failed).length,
  };
}

export interface QueueChoice {
  key: QueueKey;
  // a change group's title, or null for "all waiting" and "new screenshots"
  group: ChangeGroup | null;
  waiting: number;
}

/** The queues the menu offers: all waiting, then each group with something waiting. */
export function queueChoices(
  runs: TestRun[],
  groups: ChangeGroup[],
): QueueChoice[] {
  const all: QueueChoice = {
    key: { kind: "all" },
    group: null,
    waiting: waitingInOrder(runs, groups).length,
  };
  const perGroup = groups
    .map((group) => {
      const key: QueueKey = { kind: "group", fingerprint: group.fingerprint };
      return { key, group, waiting: queueIds(key, runs, groups).length };
    })
    .filter((choice) => choice.waiting > 0);
  return [all, ...perGroup];
}

/** After a queue is done: the next group with something waiting, else all that still waits. */
export function nextQueue(
  current: QueueKey,
  runs: TestRun[],
  groups: ChangeGroup[],
): QueueChoice | undefined {
  const choices = queueChoices(runs, groups);
  const groupsLeft = choices.filter((choice) => choice.group);
  if (current.kind === "group") {
    const at = groups.findIndex((g) => g.fingerprint === current.fingerprint);
    const after = groupsLeft.find(
      (choice) => !!choice.group && groups.indexOf(choice.group) > at,
    );
    if (after) return after;
  }
  const all = choices[0];
  return all.waiting > 0 && current.kind !== "all" ? all : groupsLeft[0];
}
