/** One filter of a list: its name and the value chosen, empty when none. */
export type FilterField = {
  key: string;
  label: string;
  value: string | null | undefined;
  // how the value reads, when it is not shown as it is (a status)
  shownValue?: string;
};

export type ActiveFilter = { key: string; label: string; text: string };

/**
 * The filters that narrow the list, in the order they are offered, each as
 * the text of its chip: "OS: Android 14" (REQ-046-54).
 */
export function activeFilters(fields: FilterField[]): ActiveFilter[] {
  return fields
    .filter((field) => !!field.value)
    .map((field) => ({
      key: field.key,
      label: field.label,
      text: `${field.label}: ${field.shownValue ?? field.value}`,
    }));
}

/** The values a filter offers: each once, empty ones left out. */
export function distinctValues(
  values: (string | null | undefined)[],
): string[] {
  return values.filter(
    (value, index, array): value is string =>
      !!value && array.indexOf(value) === index,
  );
}
