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
