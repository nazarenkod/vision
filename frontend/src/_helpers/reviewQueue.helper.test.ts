import { run } from "./testRun.fixture";
import { TestStatus } from "../types/testStatus";
import { ChangeGroup } from "../types/insights";
import {
  nextQueue,
  nextWaiting,
  parseQueue,
  profileOf,
  queueIds,
  queueParam,
  queueSummary,
  startIndex,
  waitingInOrder,
} from "./reviewQueue.helper";

const group = (
  fingerprint: string,
  kind: ChangeGroup["kind"],
  ids: string[],
): ChangeGroup => ({
  id: `g-${fingerprint}`,
  kind,
  title: fingerprint,
  screens: [],
  testRuns: ids.map((id) => run({ id })),
  changes: [],
  noise: null,
  fingerprint,
});

const runs = [
  run({
    id: "login-ios",
    name: "Login. Error",
    device: "iPhone 15",
    os: "iOS 17",
  }),
  run({
    id: "pay-aos",
    name: "Checkout. Pay",
    device: "PIXEL_4_XL",
    os: "AOS 14",
  }),
  run({
    id: "pay-ios",
    name: "Checkout. Pay",
    device: "iPhone 15",
    os: "iOS 17",
  }),
  run({
    id: "avatar",
    name: "Profile. Avatar",
    device: "PIXEL_4_XL",
    os: "AOS 14",
    featureName: "Account",
  }),
  run({ id: "onb", name: "Onboarding. Step 3", status: TestStatus.new }),
  run({ id: "loose", name: "Settings. Main" }),
  run({ id: "home", name: "Home. Feed", status: TestStatus.ok }),
];
const groups = [
  group("moved", "component", ["login-ios", "pay-aos"]),
  group("image", "visual", ["pay-ios", "avatar"]),
  group("new", "new", ["onb"]),
];

describe("review queues", () => {
  it("puts all waiting in the order of the groups, new last", () => {
    expect(waitingInOrder(runs, groups).map((r) => r.id)).toEqual([
      "login-ios",
      "pay-aos",
      "pay-ios",
      "avatar",
      "loose",
      "onb",
    ]);
  });

  it("keeps only the waiting runs of a group, device, feature or check", () => {
    const decided = runs.map((r) =>
      r.id === "pay-aos" ? { ...r, status: TestStatus.approved } : r,
    );
    expect(
      queueIds({ kind: "group", fingerprint: "moved" }, decided, groups),
    ).toEqual(["login-ios"]);
    expect(
      queueIds({ kind: "device", profile: profileOf(runs[0]) }, runs, groups),
    ).toEqual(["login-ios", "pay-ios"]);
    expect(
      queueIds({ kind: "feature", name: "Account" }, runs, groups),
    ).toEqual(["avatar"]);
    // no featureName: the check stands on its own, its name is not cut at the dot
    expect(
      queueIds({ kind: "feature", name: "Checkout" }, runs, groups),
    ).toEqual([]);
    expect(
      queueIds({ kind: "check", name: "Checkout. Pay" }, runs, groups),
    ).toEqual(["pay-aos", "pay-ios"]);
    expect(
      queueIds({ kind: "check", name: "Profile. Avatar" }, runs, groups),
    ).toEqual([]);
  });

  it("starts at the clicked run inside its group", () => {
    const ids = queueIds({ kind: "group", fingerprint: "image" }, runs, groups);
    expect(startIndex(ids, "avatar")).toBe(1);
    expect(startIndex(ids, "not-there")).toBe(0);
  });

  it("opens the run a bug was filed from, decided or not", () => {
    const decided = runs.map((r) =>
      r.id === "home" ? { ...r, status: TestStatus.failed } : r,
    );
    expect(queueIds({ kind: "run", id: "home" }, decided, groups)).toEqual([
      "home",
    ]);
  });

  it("skips runs someone else decided", () => {
    const ids = ["login-ios", "pay-aos", "pay-ios"];
    const now = runs.map((r) =>
      r.id === "pay-aos" ? { ...r, status: TestStatus.approved } : r,
    );
    expect(nextWaiting(ids, 0, now)).toBe(2);
    expect(nextWaiting(ids, 2, now)).toBe(-1);
  });

  it("keeps the queue in the address", () => {
    for (const param of [
      "all",
      "group:moved",
      "device:iPhone 15|iOS 17||",
      "feature:Checkout",
      "check:Checkout. Pay",
      "run:abc",
    ]) {
      const key = parseQueue(param);
      expect(key && queueParam(key)).toBe(param);
    }
    expect(parseQueue("group:")).toBeUndefined();
    expect(parseQueue("nonsense")).toBeUndefined();
  });

  it("sums up a queue and offers the next group with something waiting", () => {
    const after = runs.map((r) =>
      r.id === "login-ios"
        ? { ...r, status: TestStatus.failed }
        : r.id === "pay-aos"
          ? { ...r, status: TestStatus.approved }
          : r,
    );
    expect(queueSummary(["login-ios", "pay-aos"], after)).toEqual({
      approved: 1,
      rejected: 1,
    });
    expect(
      nextQueue({ kind: "group", fingerprint: "moved" }, after, groups)?.key,
    ).toEqual({
      kind: "group",
      fingerprint: "image",
    });
    expect(
      nextQueue({ kind: "feature", name: "Login" }, after, groups)?.key,
    ).toEqual({ kind: "all" });
  });
});
