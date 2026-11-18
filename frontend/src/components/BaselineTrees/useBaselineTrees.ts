import React from "react";
import { testVariationService } from "../../services";
import { Baseline } from "../../types/baseline";
import { TreeLoad } from "../TestDetailsDialog/useInspectorTrees";

export type PairSide = "selected" | "previous";

export type PairTrees = Record<PairSide, TreeLoad> & { retry: () => void };

const IDLE: TreeLoad = { status: "idle" };
const NONE: TreeLoad = { status: "ready", tree: null };

/**
 * The trees of both versions of a pair, fetched only once someone looks at
 * them, each on its own: one that fails leaves the other, and Try again asks
 * for the failed one only (REQ-081-05, 07). A version accepted without a tree
 * is not asked for (REQ-081-06).
 */
export function useBaselineTrees(
  variationId: string | undefined,
  selected: Baseline | undefined,
  previous: Baseline | undefined,
  wanted: boolean,
): PairTrees {
  const [loads, setLoads] = React.useState<Record<PairSide, TreeLoad>>({
    selected: IDLE,
    previous: IDLE,
  });
  // which version each side is for: an answer for an older pair is dropped
  const asked = React.useRef<Record<PairSide, string | undefined>>({
    selected: undefined,
    previous: undefined,
  });

  const load = React.useCallback(
    (side: PairSide, version: Baseline | undefined) => {
      asked.current[side] = version?.id;
      const set = (next: TreeLoad) =>
        setLoads((all) => ({ ...all, [side]: next }));
      if (!version || !variationId) return set(IDLE);
      if (version.uiTreeName === null) return set(NONE);
      set({ status: "loading" });
      testVariationService
        .getBaselineUiTree(variationId, version.id)
        .then((tree) => {
          if (asked.current[side] === version.id)
            set({ status: "ready", tree });
        })
        .catch(() => {
          if (asked.current[side] === version.id) set({ status: "error" });
        });
    },
    [variationId],
  );

  React.useEffect(() => {
    if (!wanted) return;
    load("selected", selected);
    load("previous", previous);
    // a version is the same while its id is
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, selected?.id, previous?.id, wanted]);

  const retry = React.useCallback(() => {
    if (loads.selected.status === "error") load("selected", selected);
    if (loads.previous.status === "error") load("previous", previous);
  }, [loads, load, selected, previous]);

  return { ...loads, retry };
}
