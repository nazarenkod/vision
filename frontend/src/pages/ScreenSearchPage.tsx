import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  ButtonBase,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { SearchOutlined } from "@mui/icons-material";
import { projectsService, buildsService, staticService } from "../services";
import { ScreenSearchResult } from "../types";
import { useProjectFromAddress } from "../contexts";
import { radius, tokens, type } from "../theme";
import { useT } from "../i18n";
import { routes } from "../constants";
import {
  buildProjectPageUrl,
  buildTestRunLocation,
} from "../_helpers/route.helpers";
import {
  boxPercent,
  deviceLabel,
  devicesOf,
  encodeBoxes,
  isSearchable,
  SearchHit,
  searchHits,
} from "../_helpers/screenSearch.helper";
import { ElementCrop } from "../components/ElementCrop";
import { BetaChip } from "../components/BetaChip";

// a pause in typing, not every key, asks the server
const TYPING_PAUSE_MS = 300;
const CARD_CROP_WIDTH = 236;
const CARD_CROP_HEIGHT = 72;
const PREVIEW_WIDTH = 300;

const PROBLEM_KEY = {
  pattern: "search.problem.pattern",
  prefix: "search.problem.prefix",
} as const;

// one colour per device, the same on the pill and the dots under a card
const deviceColours = () => [
  tokens.status.new.bar,
  tokens.status.changed.bar,
  tokens.variable,
  tokens.status.passed.bar,
  tokens.textMuted,
];

const checkName = (hit: SearchHit) =>
  hit.row.customTags ? `${hit.row.name} [${hit.row.customTags}]` : hit.row.name;

const Pill: React.FunctionComponent<{
  on: boolean;
  onClick: () => void;
  colour?: string;
  testId?: string;
  children: React.ReactNode;
}> = ({ on, onClick, colour, testId, children }) => (
  <ButtonBase
    aria-pressed={on}
    onClick={onClick}
    data-testid={testId}
    sx={{
      height: 32,
      px: 1.5,
      gap: 0.75,
      borderRadius: radius.pill,
      border: `1px solid ${on && !colour ? tokens.brand : tokens.borderStrong}`,
      bgcolor: on && !colour ? tokens.brandSoft : tokens.surface,
      color: on ? tokens.text : tokens.textMuted,
      fontSize: type.small,
      fontWeight: 500,
      opacity: colour && !on ? 0.55 : 1,
    }}
  >
    {colour && (
      <Box
        aria-hidden
        sx={{ width: 8, height: 8, borderRadius: radius.pill, bgcolor: colour }}
      />
    )}
    {children}
  </ButtonBase>
);

/**
 * Search of the project's screens by their UI trees (053, beta): every found element cut out of
 * its screen, the picked one shown on the whole screen beside them. The query lives in the
 * address, so a link shows the same.
 */
const ScreenSearchPage: React.FunctionComponent = () => {
  const { projectId = "" } = useParams<{ projectId: string }>();
  useProjectFromAddress(projectId);
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  // the build the search was opened from; searched only when chosen
  const buildId = params.get("build");
  const inBuild = !!buildId && params.get("in") === "build";
  const [typed, setTyped] = React.useState(query);
  const [result, setResult] = React.useState<ScreenSearchResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [buildNumber, setBuildNumber] = React.useState<number | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [picked, setPicked] = React.useState<string | null>(null);
  const field = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => field.current?.focus(), []);

  // a query from the `/` search lands here through the address
  React.useEffect(() => setTyped(query), [query]);

  React.useEffect(() => {
    if (!buildId) return;
    buildsService
      .getDetails(buildId)
      .then((build) => setBuildNumber(build.number ?? null))
      .catch(() => setBuildNumber(null));
  }, [buildId]);

  // the address follows the field after a pause, and the search follows the address
  React.useEffect(() => {
    if (typed === query) return;
    const timer = window.setTimeout(() => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (typed) next.set("q", typed);
          else next.delete("q");
          return next;
        },
        { replace: true },
      );
    }, TYPING_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [typed, query, setParams]);

  React.useEffect(() => {
    setError(null);
    setPicked(null);
    if (!projectId || !isSearchable(query)) {
      setResult(null);
      return;
    }
    let current = true;
    projectsService
      .searchScreens(
        projectId,
        query,
        inBuild ? (buildId ?? undefined) : undefined,
      )
      .then((answer) => current && setResult(answer))
      .catch((reason) => current && setError(String(reason)));
    return () => {
      current = false;
    };
  }, [projectId, query, inBuild, buildId]);

  const showMore = () => {
    if (!result) return;
    setLoadingMore(true);
    projectsService
      .searchScreens(
        projectId,
        query,
        inBuild ? (buildId ?? undefined) : undefined,
        result.page + 1,
      )
      .then((answer) =>
        setResult((before) =>
          before
            ? { ...answer, rows: [...before.rows, ...answer.rows] }
            : answer,
        ),
      )
      .catch((reason) => setError(String(reason)))
      .finally(() => setLoadingMore(false));
  };

  const setScope = (scope: "baselines" | "build") =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (scope === "build") next.set("in", "build");
      else next.delete("in");
      return next;
    });

  const toggleDevice = (device: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(device)) next.delete(device);
      else next.add(device);
      return next;
    });

  const rows = React.useMemo(() => result?.rows ?? [], [result]);
  const devices = React.useMemo(() => devicesOf(rows), [rows]);
  const colourOf = (device: string) => {
    const colours = deviceColours();
    return colours[devices.indexOf(device) % colours.length];
  };
  const hits = React.useMemo(() => searchHits(rows, hidden), [rows, hidden]);
  const shown = hits.find((hit) => hit.id === picked) ?? hits[0] ?? null;
  const screens = new Set(
    hits.map((hit) => `${hit.row.name}\n${hit.row.customTags}`),
  );

  const placeOf = (hit: SearchHit) => {
    const { item } = hit.devices[0];
    return inBuild && buildId
      ? {
          pathname: buildProjectPageUrl(projectId),
          ...buildTestRunLocation(buildId, item.id, { tab: "all" }),
        }
      : `${routes.VARIATION_DETAILS_PAGE}/${item.id}?${new URLSearchParams({
          highlight: encodeBoxes(
            item.boxes.filter((_, index) => item.keys[index] === hit.key),
          ),
          // the outlines belong to this baseline; a newer one gets none
          on: item.imageName ?? "",
        })}`;
  };

  const problem =
    result?.problem && result.problem !== "empty"
      ? result.problem === "short"
        ? t("search.short")
        : t(
            PROBLEM_KEY[result.problem as keyof typeof PROBLEM_KEY] ??
              "search.problem.other",
          )
      : null;
  const selector = /^(id|class|text|xpath|component):/i.test(typed);

  return (
    <Box
      sx={{
        px: 4,
        py: 3,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxWidth: 1280,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1.5,
          maxWidth: 760,
        }}
      >
        <TextField
          inputRef={field}
          fullWidth
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={t("search.placeholder")}
          error={!!problem}
          helperText={problem ?? undefined}
          inputProps={{
            "aria-label": t("search.label"),
            "data-testid": "searchInput",
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined sx={{ color: tokens.brand }} />
              </InputAdornment>
            ),
            endAdornment: result && !result.problem && hits.length > 0 && (
              <InputAdornment position="end">
                <Typography
                  data-testid="searchSummary"
                  sx={{
                    fontSize: type.small,
                    color: tokens.textMuted,
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("search.summary", {
                    matches: hits.length,
                    screens: t("search.screens", { count: screens.size }),
                  })}
                </Typography>
              </InputAdornment>
            ),
            sx: { fontFamily: selector ? tokens.mono : undefined },
          }}
          sx={{ bgcolor: tokens.surface }}
        />
        <Box sx={{ pt: 1.75 }}>
          <BetaChip />
        </Box>
      </Box>

      {(buildId || devices.length > 1) && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            alignItems: "center",
          }}
        >
          {buildId && (
            <>
              <Pill
                on={!inBuild}
                onClick={() => setScope("baselines")}
                testId="searchInBaselines"
              >
                {t("search.baselines")}
              </Pill>
              <Pill
                on={inBuild}
                onClick={() => setScope("build")}
                testId="searchInBuild"
              >
                {t("search.build", { number: buildNumber ?? "…" })}
              </Pill>
              {devices.length > 1 && (
                <Box
                  sx={{
                    width: "1px",
                    height: 20,
                    bgcolor: tokens.border,
                    mx: 0.5,
                  }}
                />
              )}
            </>
          )}
          {devices.length > 1 &&
            devices.map((device) => (
              <Pill
                key={device}
                on={!hidden.has(device)}
                onClick={() => toggleDevice(device)}
                colour={colourOf(device)}
                testId="searchDevice"
              >
                {device}
              </Pill>
            ))}
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ fontSize: type.body }}>
          {t("search.failed", { error })}
        </Typography>
      )}

      {result && !result.problem && hits.length === 0 && (
        <Typography
          data-testid="searchNothing"
          sx={{ fontSize: type.body, color: tokens.textMuted }}
        >
          {t("search.nothing")}
          {result.withoutTree > 0 &&
            ` · ${t("search.withoutTree", { count: result.withoutTree })}`}
        </Typography>
      )}

      {hits.length > 0 && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 2.5,
            alignItems: "flex-start",
          }}
        >
          <Box
            sx={{
              flex: "999 1 520px",
              minWidth: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 1.5,
            }}
          >
            {hits.map((hit) => {
              const first = hit.devices[0];
              const on = shown?.id === hit.id;
              return (
                <ButtonBase
                  key={hit.id}
                  data-testid="searchHit"
                  aria-pressed={on}
                  onClick={() => setPicked(hit.id)}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: 1.25,
                    p: 1.5,
                    textAlign: "left",
                    bgcolor: tokens.surface,
                    borderRadius: radius.card,
                    border: `1px solid ${on ? tokens.brand : tokens.border}`,
                    boxShadow: on ? `0 0 0 1px ${tokens.brand}` : "none",
                  }}
                >
                  <Box
                    sx={{
                      display: "grid",
                      placeItems: "center",
                      minHeight: CARD_CROP_HEIGHT,
                    }}
                  >
                    <ElementCrop
                      imageName={first.item.imageName}
                      box={first.box}
                      image={first.item}
                      width={CARD_CROP_WIDTH}
                      maxHeight={CARD_CROP_HEIGHT}
                      tone="found"
                      testId="searchCrop"
                    />
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        fontFamily: tokens.mono,
                        fontSize: type.caption,
                        color: tokens.textSecondary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={hit.row.screen}
                    >
                      {checkName(hit)}
                    </Typography>
                    {hit.row.where.includes("label") && (
                      <Typography
                        sx={{ fontSize: type.caption, color: tokens.variable }}
                      >
                        {t("search.label.place")}
                      </Typography>
                    )}
                    {hit.devices.map(({ item }) => (
                      <Box
                        key={item.id}
                        title={deviceLabel(item)}
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: radius.pill,
                          bgcolor: colourOf(deviceLabel(item)),
                        }}
                      />
                    ))}
                  </Box>
                </ButtonBase>
              );
            })}
          </Box>

          {shown && (
            <Box
              component="aside"
              data-testid="searchPreview"
              sx={{
                flex: "1 1 300px",
                maxWidth: PREVIEW_WIDTH + 20,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1.25,
                position: "sticky",
                top: 16,
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  width: PREVIEW_WIDTH,
                  maxWidth: "100%",
                  borderRadius: radius.card,
                  overflow: "hidden",
                  border: `1px solid ${tokens.borderStrong}`,
                  boxShadow: tokens.shadowShot,
                }}
              >
                <Box
                  component="img"
                  src={staticService.getImage(shown.devices[0].item.imageName)}
                  alt={checkName(shown)}
                  sx={{ display: "block", width: "100%" }}
                />
                {shown.devices[0].item.width > 0 && (
                  <Box
                    data-testid="searchBox"
                    sx={{
                      position: "absolute",
                      ...boxPercent(
                        shown.devices[0].box,
                        shown.devices[0].item.width,
                        shown.devices[0].item.height,
                      ),
                      border: `2px solid ${tokens.brand}`,
                      borderRadius: radius.control,
                      bgcolor: `color-mix(in srgb, ${tokens.brand} 12%, transparent)`,
                    }}
                  />
                )}
              </Box>
              <Button
                component={Link}
                to={placeOf(shown)}
                size="small"
                data-testid="searchOpen"
              >
                {inBuild ? t("search.openScreen") : t("search.openBaseline")}
              </Button>
            </Box>
          )}
        </Box>
      )}

      {result && rows.length < result.total && (
        <Box>
          <Button
            variant="outlined"
            onClick={showMore}
            disabled={loadingMore}
            data-testid="searchMore"
          >
            {t("search.more")}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default ScreenSearchPage;
