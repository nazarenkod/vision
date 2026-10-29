import { motion, tokens } from "../theme";

/**
 * The rounded look of compact fields in a page's header and filter row: the
 * project, the period, the filters. A field that narrows the list turns green.
 */
export const pillField = (active = false) => ({
  "& .MuiOutlinedInput-root": {
    borderRadius: 999,
    bgcolor: active ? tokens.brandSoft : tokens.surface,
    transition: `background-color ${motion.base}ms`,
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: active ? tokens.brand : tokens.borderStrong,
  },
});
