export type Language = "en" | "uk";

export const LANGUAGES: Language[] = ["en", "uk"];

// Intl.PluralRules categories; English needs one/other, Ukrainian one/few/many
export type Plural = {
  one: string;
  few?: string;
  many?: string;
  other: string;
};

export type Message = string | Plural;

export type Params = Record<string, string | number>;

// English keeps the browser's own formats, as the interface had before Ukrainian
const LOCALES: Record<Language, string | undefined> = {
  en: undefined,
  uk: "uk-UA",
};

export const localeOf = (language: Language) => LOCALES[language];

const pluralRules = new Map<Language, Intl.PluralRules>();
const pluralOf = (language: Language, count: number) => {
  let rules = pluralRules.get(language);
  if (!rules) {
    rules = new Intl.PluralRules(localeOf(language));
    pluralRules.set(language, rules);
  }
  return rules.select(count) as keyof Plural;
};

const interpolate = (text: string, params: Params, language: Language) =>
  text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return whole;
    return typeof value === "number" ? formatNumber(value, language) : value;
  });

/**
 * The text of a key in a language: a plural picks its form by params.count,
 * {name} takes params.name. A key the language lacks reads in English, and a
 * key neither has reads as itself, so a missing text is never blank.
 */
export function translate(
  dictionaries: Record<Language, Record<string, Message>>,
  language: Language,
  key: string,
  params: Params = {},
): string {
  const message = dictionaries[language][key] ?? dictionaries.en[key];
  if (message === undefined) return key;
  const text =
    typeof message === "string"
      ? message
      : (message[pluralOf(language, Number(params.count ?? 0))] ??
        message.other);
  return interpolate(text, params, language);
}

/** The placeholders a text uses, for checking translations keep them all. */
export function placeholdersOf(message: Message): string[] {
  const texts =
    typeof message === "string" ? [message] : Object.values(message);
  return [
    ...new Set(
      texts.flatMap((text) =>
        [...(text ?? "").matchAll(/\{(\w+)\}/g)].map((match) => match[1]),
      ),
    ),
  ].sort();
}

export const STORAGE_KEY = "vision.language";

/**
 * The language picked earlier in this browser; English for everyone else,
 * whatever the browser's own language is.
 */
export function initialLanguage(stored: string | null | undefined): Language {
  return stored === "uk" ? "uk" : "en";
}

export function formatNumber(value: number, language: Language): string {
  // no thousands separators: counts and pixel sizes read as they did before
  return new Intl.NumberFormat(localeOf(language), {
    maximumFractionDigits: 3,
    useGrouping: false,
  }).format(value);
}

/** A number with a fixed count of decimals, as toFixed gives, with the language's decimal mark. */
export function formatFixed(
  value: number,
  digits: number,
  language: Language,
): string {
  return new Intl.NumberFormat(localeOf(language), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(value);
}

export function formatDate(
  value: string | number | Date,
  language: Language,
  // the parts Date.toLocaleString shows
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  },
): string {
  return new Intl.DateTimeFormat(localeOf(language), options).format(
    new Date(value),
  );
}

const ENGLISH_ORDINAL: Record<string, string> = {
  one: "st",
  two: "nd",
  few: "rd",
  other: "th",
};

/** A place in a list: 1st, 2nd, 3rd… in English, 1-м, 2-м… in Ukrainian. */
export function formatOrdinal(value: number, language: Language): string {
  if (language === "uk") return `${value}-м`;
  const rule = new Intl.PluralRules("en", { type: "ordinal" }).select(value);
  return `${value}${ENGLISH_ORDINAL[rule] ?? "th"}`;
}
