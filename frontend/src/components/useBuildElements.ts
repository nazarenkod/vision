import React from "react";
import { testRunService } from "../services";

// one request per build while the review lasts: the comparison opens screen after screen
const asked = new Map<string, Promise<Map<string, number>>>();

/**
 * How many screens of the build each element changed on (055, beta), for the comparison to
 * offer the others. Empty until known, and on any failure: the offer is a convenience.
 */
export function useBuildElements(
  buildId: string | undefined,
): Map<string, number> {
  const [screens, setScreens] = React.useState<Map<string, number>>(new Map());
  React.useEffect(() => {
    if (!buildId) return;
    let current = true;
    const answer =
      asked.get(buildId) ??
      testRunService
        .getElements(buildId)
        .then(
          (elements) =>
            new Map(elements.map((item) => [item.key, item.screens])),
        )
        .catch(() => {
          asked.delete(buildId);
          return new Map<string, number>();
        });
    asked.set(buildId, answer);
    answer.then((found) => current && setScreens(found));
    return () => {
      current = false;
    };
  }, [buildId]);
  return screens;
}
