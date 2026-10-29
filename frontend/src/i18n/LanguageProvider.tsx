import React from "react";
import { MessageKey } from "./en";
import { DICTIONARIES } from "./dictionaries";
import {
  formatDate,
  formatNumber,
  formatOrdinal,
  initialLanguage,
  Language,
  Params,
  STORAGE_KEY,
  translate,
} from "./translate";

const readStored = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const store = (language: Language) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // private mode: the choice lasts for this page only
  }
};

/** A text with elements in it: each {name} is replaced by `nodes[name]`. */
const withNodes = (
  text: string,
  nodes: Record<string, React.ReactNode>,
): React.ReactNode =>
  text
    .split(/\{(\w+)\}/g)
    .map((part, index) =>
      index % 2 === 1 ? (
        <React.Fragment key={index}>
          {nodes[part] ?? `{${part}}`}
        </React.Fragment>
      ) : (
        part
      ),
    );

export interface I18n {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey, params?: Params) => string;
  /** t for a text with markup in it: bold names, code examples. */
  tx: (
    key: MessageKey,
    nodes: Record<string, React.ReactNode>,
    params?: Params,
  ) => React.ReactNode;
  formatNumber: (value: number) => string;
  formatOrdinal: (value: number) => string;
  formatDate: (
    value: string | number | Date,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
}

const make = (
  language: Language,
  setLanguage: (language: Language) => void,
): I18n => ({
  language,
  setLanguage,
  t: (key, params) => translate(DICTIONARIES, language, key, params),
  tx: (key, nodes, params) =>
    withNodes(translate(DICTIONARIES, language, key, params), nodes),
  formatNumber: (value) => formatNumber(value, language),
  formatOrdinal: (value) => formatOrdinal(value, language),
  formatDate: (value, options) => formatDate(value, language, options),
});

// outside a provider (unit tests of a single component) texts read in English
const I18nContext = React.createContext<I18n>(make("en", () => undefined));

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>(() =>
    initialLanguage(readStored(), navigator.languages ?? [navigator.language]),
  );

  React.useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = React.useMemo(
    () =>
      make(language, (next) => {
        store(next);
        setLanguageState(next);
      }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useT = () => React.useContext(I18nContext);
