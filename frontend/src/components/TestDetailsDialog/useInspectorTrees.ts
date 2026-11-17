import React from "react";
import { insightsService } from "../../services";
import { InspectorTree, TreeSide } from "../../types/insights";

export type TreeLoad =
  | { status: "idle" | "loading" | "error" }
  | { status: "ready"; tree: InspectorTree | null };

export type InspectorTrees = Record<TreeSide, TreeLoad> & {
  retry: () => void;
};

const IDLE: TreeLoad = { status: "idle" };

/**
 * Both trees of a check, fetched only once someone looks at them: a tree can
 * be megabytes, and the comparison works without it (REQ-062-08).
 */
export function useInspectorTrees(
  testRunId: string | undefined,
  wanted: boolean,
): InspectorTrees {
  const [current, setCurrent] = React.useState<TreeLoad>(IDLE);
  const [baseline, setBaseline] = React.useState<TreeLoad>(IDLE);
  const [attempt, setAttempt] = React.useState(0);
  const loadedFor = React.useRef<string>();

  React.useEffect(() => {
    // another check: what was loaded is no longer its tree
    loadedFor.current = undefined;
    setCurrent(IDLE);
    setBaseline(IDLE);
  }, [testRunId]);

  React.useEffect(() => {
    if (!wanted || !testRunId) return;
    const key = `${testRunId}:${attempt}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    let live = true;
    const load = (side: TreeSide, set: (load: TreeLoad) => void) => {
      set({ status: "loading" });
      insightsService
        .getUiTree(testRunId, side)
        .then((tree) => live && set({ status: "ready", tree }))
        .catch(() => live && set({ status: "error" }));
    };
    load("current", setCurrent);
    load("baseline", setBaseline);
    return () => {
      live = false;
      // a load cut short is started again next time
      if (loadedFor.current === key) loadedFor.current = undefined;
    };
  }, [testRunId, wanted, attempt]);

  const retry = React.useCallback(() => setAttempt((n) => n + 1), []);
  return { current, baseline, retry };
}

export const treeOf = (load: TreeLoad): InspectorTree | null =>
  load.status === "ready" ? load.tree : null;
