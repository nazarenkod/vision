type FormatDate = (
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
) => string;

const DAY: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};
const TIME: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

/**
 * When a baseline was made, in one line: "Oct 12, 2026 · 16:05" (REQ-046-55).
 * The date and the time are formatted apart, so the dot stands between them
 * in either language.
 */
export function recordDate(
  value: string | number | Date,
  formatDate: FormatDate,
): string {
  return `${formatDate(value, DAY)} · ${formatDate(value, TIME)}`;
}
