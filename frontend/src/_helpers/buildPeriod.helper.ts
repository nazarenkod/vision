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
