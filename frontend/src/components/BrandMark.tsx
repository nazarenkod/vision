import React from "react";
import { Box } from "@mui/material";
import { keyframes, styled } from "@mui/material/styles";
import { BRAND } from "../constants/brand";
import { tokens } from "../theme";
import { prefersReducedMotion } from "../_helpers/motion.helper";

// The pixel that slipped out of place: it pops out as a difference (magenta),
// stays there long enough to be seen, and springs back resolved (green). At
// rest the mark has no magenta at all. Each phase has its own curve: one sharp
// curve on every segment made the whole thing a blink.
const pixelOut = keyframes`
  0%, 12% {
    transform: none;
    fill: ${tokens.brand};
    animation-timing-function: cubic-bezier(.3, 0, .2, 1);
  }
  34% { transform: translate(3.6px, -3.6px); fill: ${tokens.diff}; }
  58% {
    transform: translate(3.6px, -3.6px);
    fill: ${tokens.diff};
    animation-timing-function: cubic-bezier(.5, 0, .6, 1);
  }
  74% {
    transform: translate(-0.6px, 0.6px);
    fill: ${tokens.brand};
    animation-timing-function: cubic-bezier(.3, 0, .4, 1);
  }
  86%, 100% { transform: none; fill: ${tokens.brand}; }
`;
const dotFlash = keyframes`
  0%, 28% { background: ${tokens.brand}; }
  36%, 60% { background: ${tokens.diff}; }
  72%, 100% { background: ${tokens.brand}; }
`;
export const LOGO_PLAY_MS = 2400;

// a plain styled rect: MUI's Box would take width and height as its own props
const Pixel = styled("rect", {
  shouldForwardProp: (prop) => prop !== "playing",
})<{ playing: boolean }>(({ playing }) => ({
  fill: tokens.brand,
  transformBox: "view-box",
  animation: playing ? `${pixelOut} ${LOGO_PLAY_MS}ms linear` : "none",
}));

/** Plays once when shown and again on hover; never with reduced motion. */
function usePlayOnce(): [boolean, () => void, () => void] {
  const [playing, setPlaying] = React.useState(() => !prefersReducedMotion());
  const start = React.useCallback(() => {
    if (!prefersReducedMotion()) setPlaying(true);
  }, []);
  const stop = React.useCallback(() => setPlaying(false), []);
  return [playing, start, stop];
}

/** «Гніздо»: a green tile with a white v and a pixel set into its corner. */
export const BrandMark: React.FunctionComponent<{
  size?: number;
  /** a parent that plays the mark itself (on hover of a whole lockup) */
  playing?: boolean;
  onPlayed?: () => void;
}> = ({ size = 32, playing: playingFromParent, onPlayed }) => {
  const mask = `nest-${React.useId().replace(/:/g, "")}`;
  const [ownPlaying, start, stop] = usePlayOnce();
  const controlled = playingFromParent !== undefined;
  const playing = controlled ? playingFromParent : ownPlaying;
  return (
    <Box
      component="svg"
      viewBox="0 0 32 32"
      aria-hidden="true"
      data-testid="brandMark"
      data-playing={playing ? "true" : "false"}
      onMouseEnter={controlled ? undefined : start}
      sx={{
        width: size,
        height: size,
        display: "block",
        overflow: "visible",
        flexShrink: 0,
      }}
    >
      <defs>
        <mask id={mask}>
          {/* a mask: white keeps the tile, black cuts the notch */}
          <rect width="32" height="32" fill="white" />
          <rect
            x="19.2"
            y="3.2"
            width="9.6"
            height="9.6"
            rx="2.6"
            fill="black"
          />
        </mask>
      </defs>
      <rect
        width="32"
        height="32"
        rx="9"
        mask={`url(#${mask})`}
        style={{ fill: tokens.brand }}
      />
      <path
        d="M7.4 13.2 L13.7 25 L20 13.2"
        fill="none"
        strokeWidth="3.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke: tokens.brandInk }}
      />
      <Pixel
        data-testid="brandPixel"
        x="20.6"
        y="4.6"
        width="6.8"
        height="6.8"
        rx="1.7"
        playing={playing}
        onAnimationEnd={() => (controlled ? onPlayed?.() : stop())}
      />
    </Box>
  );
};

/** "vision" with both dots over the i as square pixels. */
export const Wordmark: React.FunctionComponent<{
  size?: number;
  playing?: boolean;
}> = ({ size = 18, playing = false }) => {
  const dot = (flash: boolean) => (
    <Box
      component="i"
      data-testid="wordmarkDot"
      sx={{
        position: "absolute",
        left: "50%",
        top: "0.1em",
        width: "0.2em",
        height: "0.2em",
        ml: "-0.1em",
        borderRadius: "0.035em",
        background: tokens.brand,
        animation:
          flash && playing ? `${dotFlash} ${LOGO_PLAY_MS}ms linear` : "none",
      }}
    />
  );
  const i = (flash: boolean) => (
    <Box
      component="span"
      sx={{ position: "relative", display: "inline-block" }}
    >
      ı{dot(flash)}
    </Box>
  );
  return (
    <Box
      component="span"
      role="img"
      aria-label={BRAND.name}
      data-testid="wordmark"
      sx={{
        display: "inline-flex",
        alignItems: "baseline",
        lineHeight: 1,
        fontFamily: '"Geist Sans", "Inter", system-ui, sans-serif',
        fontWeight: 700,
        letterSpacing: "-0.025em",
        fontSize: size,
        whiteSpace: "nowrap",
        color: tokens.text,
      }}
    >
      <Box component="span" aria-hidden="true" sx={{ display: "contents" }}>
        v{i(false)}s{i(true)}on
      </Box>
    </Box>
  );
};

/** Mark and word together: hovering anywhere on it plays both. */
export const BrandLockup: React.FunctionComponent<{
  markSize?: number;
  wordSize?: number;
  direction?: "row" | "column";
  gap?: number;
}> = ({ markSize = 28, wordSize = 18, direction = "row", gap = 1.1 }) => {
  const [playing, start, stop] = usePlayOnce();
  return (
    <Box
      onMouseEnter={start}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        flexDirection: direction,
        gap,
      }}
    >
      <BrandMark size={markSize} playing={playing} onPlayed={stop} />
      <Wordmark size={wordSize} playing={playing} />
    </Box>
  );
};
