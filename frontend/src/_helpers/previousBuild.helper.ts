import { english, Text } from "../i18n";
import { BuildOverview } from "../types/buildOverview";

/**
 * "Since #127: 4 changed, 2 new" — only the parts that happened, each said
 * once; a build with nothing new against the previous one says so.
 */
export function sincePrevious(
  previous: NonNullable<BuildOverview["previous"]>,
  text: Text = english,
): string {
  const parts = [
    previous.changed &&
      text("overview.prevChanged", { count: previous.changed }),
    previous.added && text("overview.prevNew", { count: previous.added }),
    previous.gone && text("overview.prevGone", { count: previous.gone }),
  ].filter(Boolean);
  return `${text("overview.since", { number: previous.number })}: ${
    parts.length ? parts.join(", ") : text("overview.prevSame")
  }`;
}
