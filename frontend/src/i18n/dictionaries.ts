import { en, MessageKey } from "./en";
import { uk } from "./uk";
import { Params, translate } from "./translate";

export const DICTIONARIES = { en, uk };

export type Text = (key: MessageKey, params?: Params) => string;

/**
 * The English text of a key, for pure helpers that take a `text` function and
 * are also called outside React (and in their unit tests).
 */
export const english: Text = (key, params) =>
  translate(DICTIONARIES, "en", key, params);

/** Whether a text built at run time (a status, an enum value) has a key. */
export const isMessageKey = (key: string): key is MessageKey =>
  key in DICTIONARIES.en;

/** A value's own label, or the value itself when it has none: data stays as it is. */
export const labelOf = (text: Text, prefix: string, value: string) => {
  const key = `${prefix}.${value}`;
  return isMessageKey(key) ? text(key) : value;
};
