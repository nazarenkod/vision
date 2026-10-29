import React from "react";
import { flushSync } from "react-dom";
import { motion, palettes, Palette, ThemeMode } from "../theme";
import {
  flippedPreference,
  isThemeHotkey,
  readPreference,
  resolveMode,
  revealCircle,
  ThemePreference,
  writePreference,
} from "../_helpers/themeMode.helper";
import { prefersReducedMotion } from "../_helpers/motion.helper";

// The soft edge of the theme circle is a mask whose radius is this property.
// Registered as a length it animates smoothly; where it cannot be registered
// the circle keeps a hard edge.
const softEdge = (() => {
  try {
    CSS.registerProperty({
      name: "--v-reveal",
      syntax: "<length>",
      inherits: false,
      initialValue: "0px",
    });
    return true;
  } catch (error) {
    // already registered: a hot reload of this module
    return (
      error instanceof DOMException && error.name === "InvalidModificationError"
    );
  }
})();

type ThemeModeState = {
  preference: ThemePreference;
  mode: ThemeMode;
  /** `from` is the control that was pressed: the new theme spreads from it. */
  setPreference: (preference: ThemePreference, from?: Element | null) => void;
  toggle: (from?: Element | null) => void;
};

const ThemeModeContext = React.createContext<ThemeModeState | undefined>(
  undefined,
);

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

const systemQuery = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : undefined;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

export const ThemeModeProvider: React.FunctionComponent<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [preference, setPreferenceState] = React.useState<ThemePreference>(() =>
    readPreference(storage()),
  );
  const [systemDark, setSystemDark] = React.useState(
    () => !!systemQuery()?.matches,
  );
  const mode = resolveMode(preference, systemDark);

  React.useEffect(() => {
    const query = systemQuery();
    if (!query) return;
    const onChange = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  // the global stylesheet picks the CSS variables of the theme by this attribute
  React.useLayoutEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const setPreference = React.useCallback(
    (next: ThemePreference, from?: Element | null) => {
      writePreference(storage(), next);
      const apply = () => flushSync(() => setPreferenceState(next));
      const doc = document as ViewTransitionDocument;
      const changesLook = resolveMode(next, systemDark) !== mode;
      if (
        !changesLook ||
        !from ||
        !doc.startViewTransition ||
        prefersReducedMotion()
      ) {
        apply();
        return;
      }
      const box = from.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const {
        feather,
        from: opening,
        radius,
      } = revealCircle(x, y, {
        width: window.innerWidth,
        height: window.innerHeight,
      });
      const at = `${x}px ${y}px`;
      const frames = softEdge
        ? {
            "--v-reveal": [`${opening}px`, `${radius}px`],
            "--v-reveal-at": [at, at],
            "--v-reveal-feather": [`${feather}px`, `${feather}px`],
          }
        : {
            clipPath: [
              `circle(0px at ${at})`,
              `circle(${radius - feather}px at ${at})`,
            ],
          };
      try {
        doc
          .startViewTransition(apply)
          .ready.then(() =>
            document.documentElement.animate(frames, {
              duration: motion.reveal,
              easing: motion.revealEasing,
              // held at the end: dropped back to 0 for the frame before the
              // transition is torn down, the mask flashed the old theme
              fill: "forwards",
              pseudoElement: "::view-transition-new(root)",
            }),
          )
          .catch(() => undefined);
      } catch {
        apply();
      }
    },
    [mode, systemDark],
  );

  const toggle = React.useCallback(
    (from?: Element | null) => setPreference(flippedPreference(mode), from),
    [mode, setPreference],
  );

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isThemeHotkey(event)) return;
      event.preventDefault();
      toggle(document.querySelector("[data-testid='themeToggle']"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const value = React.useMemo(
    () => ({ preference, mode, setPreference, toggle }),
    [preference, mode, setPreference, toggle],
  );
  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  );
};

export function useThemeMode(): ThemeModeState {
  const context = React.useContext(ThemeModeContext);
  if (!context) {
    // components rendered alone (unit tests) get the light theme
    return {
      preference: "system",
      mode: "light",
      setPreference: () => undefined,
      toggle: () => undefined,
    };
  }
  return context;
}

/** Real colour values of the theme on screen, for canvas and colour maths. */
export function useTokens(): Palette {
  return palettes[useThemeMode().mode];
}
