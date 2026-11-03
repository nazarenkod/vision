import { english, Text } from "../i18n";
import { formatDate as formatIn } from "../i18n/translate";

type FormatDate = (
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
) => string;

const TIME: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
};

/**
 * When the build ran: "29.10.2026, 13:57:12 – 13:57:14". The end leaves out
 * the date when it is the same day, and a build that has not run on since it
 * started shows its start alone.
 */
export function buildPeriod(
  start: string | Date,
  end: string | Date | null | undefined,
  {
    formatDate = (value, options) => formatIn(value, "en", options),
    t = english,
  }: { formatDate?: FormatDate; t?: Text } = {},
): string {
  const from = formatDate(start);
  if (!end || new Date(end).getTime() <= new Date(start).getTime()) return from;
  const sameDay =
    new Date(start).toDateString() === new Date(end).toDateString();
  return t("builds.period", {
    start: from,
    end: formatDate(end, sameDay ? TIME : undefined),
  });
}

/**
 * How long the build ran: "3 min 34 s", "12 min", "1 h 5 min", "45 s" (038).
 * Null for a build that has not run on since it started.
 */
export function buildDuration(
  start: string | Date,
  end: string | Date | null | undefined,
  t: Text = english,
): string | null {
  if (!end) return null;
  const seconds = Math.floor(
    (new Date(end).getTime() - new Date(start).getTime()) / 1000,
  );
  if (seconds < 1) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours)
    return minutes
      ? t("builds.durationHours", { hours, minutes })
      : t("builds.durationHoursOnly", { hours });
  if (minutes)
    return rest
      ? t("builds.durationMinutes", { minutes, seconds: rest })
      : t("builds.durationMinutesOnly", { minutes });
  return t("builds.durationSeconds", { seconds: rest });
}
