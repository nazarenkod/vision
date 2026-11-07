import React from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { DarkModeOutlined, LightModeOutlined } from "@mui/icons-material";
import { BrandLockup, LOGO_PLAY_MS } from "./BrandMark";
import { staggered } from "./motion/Stagger";
import { tokens, radius, type, motion } from "../theme";
import { LanguageSwitch, useT } from "../i18n";
import { useThemeMode } from "../contexts";

// The brand half stays dark green in both themes: a mix of the brand colour
// with black, so it follows the palette without a colour of its own.
const PANEL = `color-mix(in srgb, ${tokens.brand} 42%, black)`;
const ON_PANEL = "rgba(255, 255, 255, 0.72)";
const PANEL_GRID = 32;

/**
 * One cell of the brand grid that slipped out of place: it shows up as a
 * difference, springs back into its cell and fades into the grid. It leaves
 * nothing behind, so there is no pale square at rest (046), and with reduced
 * motion the global rule jumps straight to that end.
 */
const StrayPixel: React.FunctionComponent = () => (
  <Box
    aria-hidden="true"
    data-testid="authStrayPixel"
    sx={{
      position: "absolute",
      // on a grid line + 1px: the cell it settles into is a real cell
      left: PANEL_GRID * 15 + 1,
      top: PANEL_GRID * 3 + 1,
      width: PANEL_GRID - 1,
      height: PANEL_GRID - 1,
      borderRadius: radius.control,
      "@keyframes v-stray-auth": {
        "0%, 22%": {
          transform: "translate(10px, -8px)",
          backgroundColor: tokens.diff,
          opacity: 0.9,
        },
        "48%": {
          transform: "none",
          backgroundColor: "rgba(255, 255, 255, 0.18)",
          opacity: 1,
        },
        "100%": {
          transform: "none",
          backgroundColor: "rgba(255, 255, 255, 0.18)",
          opacity: 0,
        },
      },
      animation: `v-stray-auth ${LOGO_PLAY_MS}ms ${motion.easing} both ${motion.slow}ms`,
    }}
  />
);

// the brand half's cascade: lockup, baseline, current, words; then the change
const DIFF_AT = 520;

/*
 * Once the cascade is over, the drawing replays a comparison on a loop: a new
 * Current arrives, a scan line passes over both screens, the clock that ticked
 * is outlined as variable text and let go, and the button that moved gets the
 * difference frame. The resting state of every part is the last frame of the
 * loop, so a screenshot (Playwright stops infinite animations) and reduced
 * motion (the global rule plays one 1 ms iteration) both see the finished
 * comparison. The loop has no fill: during its delay the cascade owns the parts.
 */
const LOOP_MS = 7000;
const LOOP_AT = 1600;
const loop = (name: string) =>
  `${name} ${LOOP_MS}ms ${motion.easing} ${LOOP_AT}ms infinite`;
// how far below its new place the button sat on the baseline
const MOVED_BY = 36;

const CLOCK_LINE = 14;

/** The status bar clock: Current's minute has ticked, which is noise, not a change. */
const Clock: React.FunctionComponent<{ current: boolean }> = ({ current }) => (
  <Box
    sx={{
      position: "relative",
      height: CLOCK_LINE,
      overflow: "visible",
    }}
  >
    <Box sx={{ height: CLOCK_LINE, overflow: "hidden" }}>
      <Box
        sx={{
          fontSize: type.caption,
          lineHeight: `${CLOCK_LINE}px`,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: tokens.surface,
          opacity: 0.85,
          transform: current ? `translateY(-${CLOCK_LINE}px)` : "none",
          ...(current && {
            "@keyframes v-auth-clock": {
              "0%, 6%": {
                transform: `translateY(-${CLOCK_LINE}px)`,
                opacity: 0.85,
              },
              "8%": { transform: `translateY(-${CLOCK_LINE}px)`, opacity: 0 },
              "9%": { transform: "none", opacity: 0 },
              "11%, 14%": { transform: "none", opacity: 0.85 },
              "18%, 100%": {
                transform: `translateY(-${CLOCK_LINE}px)`,
                opacity: 0.85,
              },
            },
            animation: loop("v-auth-clock"),
          }),
        }}
      >
        <Box>9:41</Box>
        {current && <Box>9:42</Box>}
      </Box>
    </Box>
    {current && (
      <Box
        data-testid="authVariableClock"
        sx={{
          position: "absolute",
          inset: "-3px -4px",
          border: `1px dashed ${tokens.variable}`,
          borderRadius: radius.control,
          opacity: 0,
          "@keyframes v-auth-variable": {
            "0%, 17%": { opacity: 0, transform: "scale(1.15)" },
            "21%, 32%": { opacity: 1, transform: "none" },
            "38%, 100%": { opacity: 0, transform: "none" },
          },
          animation: loop("v-auth-variable"),
        }}
      />
    )}
  </Box>
);

/** A phone screen drawn from boxes: the header, rows, a total and a button. */
const Phone: React.FunctionComponent<{
  width: number;
  current?: boolean;
}> = ({ width, current = false }) => {
  const line = (w: string, strong = false) => (
    <Box
      sx={{
        height: 5,
        width: w,
        borderRadius: radius.control,
        bgcolor: strong ? tokens.borderStrong : tokens.border,
      }}
    />
  );
  return (
    <Box
      sx={{
        width,
        aspectRatio: "9 / 19.5",
        bgcolor: tokens.surface,
        borderRadius: radius.control,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: current ? tokens.shadowPop : "none",
      }}
    >
      <Box
        sx={{
          height: "11%",
          bgcolor: tokens.text,
          display: "flex",
          alignItems: "flex-end",
          px: 1.25,
          pb: 0.5,
          boxSizing: "border-box",
        }}
      >
        <Clock current={current} />
      </Box>
      <Box
        sx={{
          flex: 1,
          p: 1.25,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {[0, 1, 2].map((row) => (
          <Box key={row} sx={{ display: "flex", gap: 0.75 }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                flexShrink: 0,
                borderRadius: radius.control,
                bgcolor: tokens.subtle,
              }}
            />
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                pt: 0.5,
              }}
            >
              {line("75%", true)}
              {line("40%")}
            </Box>
          </Box>
        ))}
        <Box sx={{ mt: 1.5, borderTop: `1px solid ${tokens.border}` }} />
        {line("85%")}
        {line("55%")}
        <Box sx={{ flex: 1 }} />
        {/* the change: the button moved up, and the difference is marked */}
        <Box
          sx={{
            position: "relative",
            p: current ? 0.75 : 0,
            mb: current ? 4 : 0,
            // the difference is marked once both screens are in place
            ...(current && {
              animation: `v-grow ${motion.slow}ms ${motion.spring} both ${DIFF_AT}ms`,
              "&::before": {
                content: '""',
                position: "absolute",
                inset: 0,
                borderRadius: radius.control,
                border: `1.5px solid ${tokens.diff}`,
                bgcolor: tokens.diffSoft,
                "@keyframes v-auth-frame": {
                  "0%, 5%": { opacity: 1, transform: "none" },
                  "10%, 46%": { opacity: 0, transform: "scale(.9)" },
                  "47%": {
                    opacity: 0,
                    transform: "scale(.9)",
                    boxShadow: `0 0 0 0 ${tokens.diff}`,
                    animationTimingFunction: motion.spring,
                  },
                  "54%": { opacity: 1, transform: "none" },
                  "66%, 100%": {
                    opacity: 1,
                    transform: "none",
                    boxShadow: `0 0 0 10px transparent`,
                  },
                },
                animation: loop("v-auth-frame"),
              },
            }),
          }}
        >
          <Box
            data-testid={current ? "authMovedButton" : undefined}
            sx={{
              position: "relative",
              height: 20,
              mx: current ? "15%" : 0,
              borderRadius: radius.control,
              bgcolor: tokens.brand,
              ...(current && {
                "@keyframes v-auth-move": {
                  "0%, 6%": { transform: "none" },
                  "12%, 42%": {
                    transform: `translateY(${MOVED_BY}px) scaleX(1.4)`,
                    animationTimingFunction: motion.spring,
                  },
                  "50%, 100%": { transform: "none" },
                },
                animation: loop("v-auth-move"),
              }),
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

/** The line that compares the two screens, top to bottom, once per loop. */
const ScanLine: React.FunctionComponent = () => (
  <Box
    data-testid="authScanLine"
    sx={{
      position: "absolute",
      left: -16,
      right: -16,
      top: 0,
      height: 2,
      opacity: 0,
      pointerEvents: "none",
      borderRadius: radius.pill,
      background: `linear-gradient(90deg, transparent, ${tokens.brandSoft} 20%, rgba(255, 255, 255, 0.95) 50%, ${tokens.brandSoft} 80%, transparent)`,
      boxShadow: `0 0 14px 2px color-mix(in srgb, ${tokens.brand} 70%, transparent)`,
      // the light it leaves behind on the part already compared
      "&::before": {
        content: '""',
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 2,
        height: 48,
        background: `linear-gradient(to top, color-mix(in srgb, ${tokens.brand} 22%, transparent), transparent)`,
      },
      "@keyframes v-auth-scan": {
        "0%, 14%": { top: "0%", opacity: 0 },
        "16%": { top: "0%", opacity: 1 },
        "46%": { top: "100%", opacity: 1 },
        "50%, 100%": { top: "100%", opacity: 0 },
      },
      animation: `v-auth-scan ${LOOP_MS}ms linear ${LOOP_AT}ms infinite`,
    }}
  />
);

// the two screens drift a little, out of step, so the drawing feels alive
const floating = (delay: number) => ({
  "@keyframes v-auth-float": {
    from: { transform: "none" },
    to: { transform: "translateY(-5px)" },
  },
  animation: `v-auth-float ${LOOP_MS / 2}ms ease-in-out ${LOOP_AT + delay}ms infinite alternate`,
});

const BrandPanel: React.FunctionComponent = () => {
  const { t } = useT();
  return (
    <Box
      data-testid="authBrand"
      sx={{
        flex: "1 1 480px",
        minHeight: { xs: "auto", md: "100vh" },
        bgcolor: PANEL,
        color: "common.white",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 4,
        px: { xs: 3, md: 7 },
        py: { xs: 4, md: 6 },
        boxSizing: "border-box",
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)",
          backgroundSize: `${PANEL_GRID}px ${PANEL_GRID}px`,
        }}
      />
      <StrayPixel />
      <Box
        {...staggered(0)}
        sx={{
          position: "relative",
          "& [data-testid='wordmark']": { color: "common.white" },
        }}
      >
        <BrandLockup markSize={36} wordSize={type.section} />
      </Box>
      {/* the product's idea, drawn: the baseline and the current screen with its change */}
      <Box
        aria-hidden="true"
        sx={{
          position: "relative",
          display: { xs: "none", sm: "flex" },
          gap: 3,
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            position: "relative",
            display: "flex",
            gap: 3,
            alignItems: "flex-end",
          }}
        >
          {/* the cascade moves the wrapper: its transform would undo the tilt */}
          <Box {...staggered(2)}>
            <Box sx={floating(0)}>
              <Box sx={{ opacity: 0.85, transform: "rotate(-4deg)" }}>
                <Phone width={150} />
              </Box>
            </Box>
          </Box>
          <Box {...staggered(4)}>
            <Box sx={floating(LOOP_MS / 4)}>
              <Phone width={170} current />
            </Box>
          </Box>
          <ScanLine />
        </Box>
      </Box>
      <Box
        {...staggered(6)}
        sx={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Typography
          component="p"
          sx={{
            fontSize: type.page,
            lineHeight: 1.3,
            fontWeight: 700,
            color: "common.white",
          }}
        >
          {t("brand.tagline")}
        </Typography>
        <Typography
          sx={{
            fontSize: type.body,
            color: ON_PANEL,
            maxWidth: 420,
            // The line break in the text starts the second sentence on its own line.
            whiteSpace: "pre-line",
          }}
        >
          {t("auth.brandLine")}
        </Typography>
      </Box>
    </Box>
  );
};

/** Language and theme: there is no top bar before signing in (REQ-046-26). */
const Corner: React.FunctionComponent = () => {
  const { t } = useT();
  const { mode, toggle } = useThemeMode();
  const label = t(mode === "dark" ? "auth.lightTheme" : "auth.darkTheme");
  return (
    <Box
      data-testid="authCorner"
      sx={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 1,
      }}
    >
      <LanguageSwitch />
      <Tooltip title={`${label} (⇧D)`}>
        <IconButton
          size="small"
          onClick={(event) => toggle(event.currentTarget)}
          aria-label={label}
          data-testid="themeToggle"
          sx={{
            border: `1px solid ${tokens.border}`,
            borderRadius: radius.control,
            color: tokens.textSecondary,
          }}
        >
          {mode === "dark" ? (
            <LightModeOutlined fontSize="small" />
          ) : (
            <DarkModeOutlined fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
};

/** Sign-in: the brand on one half, the form on the other; one above the other on a phone. */
export const AuthLayout: React.FunctionComponent<{
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <Box
    data-testid="authLayout"
    sx={{
      minHeight: "100%",
      display: "flex",
      flexWrap: "wrap",
      bgcolor: tokens.ground,
    }}
  >
    <BrandPanel />
    <Box
      data-testid="authFormSide"
      sx={{
        flex: "1 1 480px",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        px: { xs: 2, md: 5 },
        py: { xs: 2, md: 4 },
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* the grid of the earlier sign-in, fading out from behind the form */}
      <Box
        aria-hidden="true"
        data-testid="authFormGrid"
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${tokens.border} 1px, transparent 1px), linear-gradient(90deg, ${tokens.border} 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
          backgroundPosition: "center",
          opacity: 0.55,
          maskImage:
            "radial-gradient(60% 60% at 50% 50%, black 0%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(60% 60% at 50% 50%, black 0%, transparent 80%)",
          animation: `v-fade ${motion.slow}ms ${motion.easing} both`,
        }}
      />
      <Box sx={{ position: "relative" }}>
        <Corner />
      </Box>
      <Box
        {...staggered(1)}
        sx={{
          position: "relative",
          m: "auto",
          py: 4,
          width: "100%",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          // fields stay solid over the grid, so the lines never cross the text
          "& .MuiOutlinedInput-root": { bgcolor: tokens.surface },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography variant="h4" component="h1">
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontSize: type.body, color: tokens.textMuted }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {children}
      </Box>
    </Box>
  </Box>
);
