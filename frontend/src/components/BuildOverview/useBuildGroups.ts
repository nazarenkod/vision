import React from "react";
import { insightsService } from "../../services";
import { ChangeGroup } from "../../types/insights";
import { TestRun } from "../../types";

// a burst of decisions lands as a burst of events: ask once it settles
const REFRESH_DELAY_MS = 400;

/**
 * The build's change groups for the Overview tab and the review queues (031),
 * asked again when what waits for a decision changes. The Changes tab keeps its
 * own copy: it also holds AI summaries and collapsed state.
 */
export function useBuildGroups(
  buildId: string | undefined,
  testRuns: TestRun[],
): ChangeGroup[] | null {
  const [groups, setGroups] = React.useState<ChangeGroup[] | null>(null);
  const pendingKey = React.useMemo(
    () =>
      testRuns
        .filter(
          (run) =>
            run.buildId === buildId &&
            (run.status === "unresolved" || run.status === "new"),
        )
        .map((run) => run.id)
        .sort()
        .join(","),
    [testRuns, buildId],
  );
  const loaded = React.useRef(false);

  React.useEffect(() => {
    loaded.current = false;
    setGroups(null);
  }, [buildId]);

  React.useEffect(() => {
    if (!buildId) return;
    let cancelled = false;
    const timer = setTimeout(
      () =>
        insightsService
          .getGroups(buildId)
          .then((result) => {
            if (cancelled) return;
            loaded.current = true;
            setGroups(result);
          })
          // the overview still shows everything else; the Changes tab says why
          .catch(() => !cancelled && setGroups((current) => current ?? [])),
      loaded.current ? REFRESH_DELAY_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [buildId, pendingKey]);

  return groups;
}
