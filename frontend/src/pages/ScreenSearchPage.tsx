import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  InputAdornment,
  TextField,
  ToggleButton,
  Typography,
} from "@mui/material";
import { SearchOutlined } from "@mui/icons-material";
import { projectsService, buildsService, staticService } from "../services";
import {
  ScreenSearchItem,
  ScreenSearchResult,
  ScreenSearchRow,
} from "../types";
import { useProjectFromAddress } from "../contexts";
import { radius, tokens, type } from "../theme";
import { useT } from "../i18n";
import { DeviceTags } from "../components/DeviceTags";
import { SlidingToggleGroup } from "../components/motion/SlidingToggleGroup";
import { routes } from "../constants";
import {
  buildProjectPageUrl,
  buildTestRunLocation,
} from "../_helpers/route.helpers";
import {
  boxPercent,
  encodeBoxes,
  isSearchable,
} from "../_helpers/screenSearch.helper";

// a pause in typing, not every key, asks the server
const TYPING_PAUSE_MS = 300;

const PROBLEM_KEY = {
  pattern: "search.problem.pattern",
  prefix: "search.problem.prefix",
} as const;

const checkName = (row: ScreenSearchRow) =>
  row.customTags ? `${row.name} [${row.customTags}]` : row.name;

const Thumbnail: React.FunctionComponent<{
  item: ScreenSearchItem;
  to: string | { pathname: string; search: string };
}> = ({ item, to }) => {
  const { t } = useT();
  const device = [item.device, item.os].filter(Boolean).join(" · ");
  return (
    <Box
      component={Link}
      to={to}
      aria-label={t("search.open", { device })}
      data-testid="searchThumbnail"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
        textDecoration: "none",
        color: tokens.textSecondary,
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: 120,
          aspectRatio: `${item.width || 9} / ${item.height || 19}`,
          borderRadius: radius.control,
          border: `1px solid ${tokens.border}`,
          overflow: "hidden",
          bgcolor: tokens.subtle,
        }}
      >
        <Box
          component="img"
          src={staticService.getImage(
            item.imageThumbnailName ?? item.imageName,
          )}
          alt=""
          loading="lazy"
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        {item.width > 0 &&
          item.boxes.map((box, index) => (
            <Box
              key={index}
              data-testid="searchBox"
              sx={{
                position: "absolute",
                ...boxPercent(box, item.width, item.height),
                border: `2px solid ${tokens.brand}`,
                borderRadius: radius.control,
                bgcolor: `color-mix(in srgb, ${tokens.brand} 14%, transparent)`,
              }}
            />
          ))}
      </Box>
      <DeviceTags parts={item} dense />
    </Box>
  );
};

const ResultRow: React.FunctionComponent<{
  row: ScreenSearchRow;
  projectId: string;
  buildId: string | null;
}> = ({ row, projectId, buildId }) => {
  const { t } = useT();
  const placeOf = (item: ScreenSearchItem) =>
    buildId
      ? {
          pathname: buildProjectPageUrl(projectId),
          ...buildTestRunLocation(buildId, item.id, { tab: "all" }),
        }
      : `${routes.VARIATION_DETAILS_PAGE}/${item.id}?${new URLSearchParams({
          highlight: encodeBoxes(item.boxes),
          // the outlines belong to this baseline; a newer one gets none
          on: item.imageName ?? "",
        })}`;
  return (
    <Box
      component="section"
      data-testid="searchRow"
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-start",
        gap: 2.5,
        p: 2,
        bgcolor: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: radius.card,
      }}
    >
      <Box
        sx={{
          flex: "1 1 240px",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
        }}
      >
        <Typography
          sx={{
            fontFamily: tokens.mono,
            fontSize: type.body,
            fontWeight: 500,
            overflowWrap: "anywhere",
          }}
        >
          {checkName(row)}
        </Typography>
        <Typography sx={{ fontSize: type.small, color: tokens.textSecondary }}>
          {row.screen !== row.name && `${row.screen} · `}
          {t("search.matches", { count: row.matches })}
          {row.where.includes("label") && ` · ${t("search.label.place")}`}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
        {row.items.map((item) => (
          <Thumbnail key={item.id} item={item} to={placeOf(item)} />
        ))}
      </Box>
    </Box>
  );
};

/**
 * Search of the project's screens by their UI trees (053): a text, a label or a selector, in the
 * latest baselines or in one build. The query lives in the address, so a link shows the same.
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
  // the page is opened to type in: `/` lands in the field, as in most tools
  const field = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => field.current?.focus(), []);

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

  const problem =
    result?.problem && result.problem !== "empty"
      ? result.problem === "short"
        ? t("search.short")
        : t(
            PROBLEM_KEY[result.problem as keyof typeof PROBLEM_KEY] ??
              "search.problem.other",
          )
      : null;

  return (
    <Box
      sx={{
        px: 4,
        py: 3,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxWidth: 1180,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <TextField
          inputRef={field}
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
                <SearchOutlined sx={{ color: tokens.textMuted }} />
              </InputAdornment>
            ),
            sx: {
              fontFamily: /^(id|class|text|xpath|component):/i.test(typed)
                ? tokens.mono
                : undefined,
            },
          }}
          sx={{ flex: "1 1 420px", bgcolor: tokens.surface }}
        />
        {buildId && (
          <SlidingToggleGroup
            size="small"
            exclusive
            value={inBuild ? "build" : "baselines"}
            onChange={(_, value) => value && setScope(value)}
          >
            <ToggleButton value="baselines" data-testid="searchInBaselines">
              {t("search.baselines")}
            </ToggleButton>
            <ToggleButton value="build" data-testid="searchInBuild">
              {t("search.build", { number: buildNumber ?? "…" })}
            </ToggleButton>
          </SlidingToggleGroup>
        )}
      </Box>

      {error && (
        <Typography color="error" sx={{ fontSize: type.body }}>
          {t("search.failed", { error })}
        </Typography>
      )}

      {result && !result.problem && (
        <Box
          data-testid="searchSummary"
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1.75,
            fontSize: type.small,
            color: tokens.textSecondary,
          }}
        >
          {result.total > 0 ? (
            <span>
              <Box component="strong" sx={{ color: tokens.text }}>
                {t("search.checks", { count: result.total })}
              </Box>
              {" · "}
              {t("search.matches", {
                count: result.rows.reduce((sum, row) => sum + row.matches, 0),
              })}
            </span>
          ) : (
            <span>{t("search.nothing")}</span>
          )}
          {result.withoutTree > 0 && (
            <Box component="span" sx={{ color: tokens.textMuted }}>
              {t("search.withoutTree", { count: result.withoutTree })}
            </Box>
          )}
        </Box>
      )}

      {result?.rows.map((row) => (
        <ResultRow
          key={`${row.name}\n${row.customTags}`}
          row={row}
          projectId={projectId}
          buildId={inBuild ? buildId : null}
        />
      ))}

      {result && result.rows.length < result.total && (
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
