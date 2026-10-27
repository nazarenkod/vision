import React from "react";
import { en, MessageKey } from "./en";
import { uk } from "./uk";
import {
  formatDate,
  formatNumber,
  initialLanguage,
  Language,
  Params,
  STORAGE_KEY,
  translate,
} from "./translate";

const DICTIONARIES = { en, uk };

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

export interface I18n {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey, params?: Params) => string;
  formatNumber: (value: number) => string;
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
  formatNumber: (value) => formatNumber(value, language),
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
