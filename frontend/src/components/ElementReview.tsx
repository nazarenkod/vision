import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  ToggleButton,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { testRunService } from "../services";
import type { ElementReviewScreen, ReviewedElement } from "../types";
import { useTestRunState } from "../contexts";
import { radius, tokens, type } from "../theme";
import { useT } from "../i18n";
import { ElementCrop } from "./ElementCrop";
import { BetaChip } from "./BetaChip";
import { ChangeGroups } from "./ChangeGroups";
import { EmptyState } from "./EmptyState";
import { SlidingToggleGroup } from "./motion/SlidingToggleGroup";
import { useDecisionSnackbar } from "./useDecisionSnackbar";
import {
  decidedScreens,
  isApproveHotkey,
} from "../_helpers/elementReview.helper";

const CROP_WIDTH = 276;
const CROP_HEIGHT = 64;

const screenName = (item: ElementReviewScreen) =>
  item.customTags ? `${item.name} [${item.customTags}]` : item.name;

const Crop: React.FunctionComponent<{
  imageName: string;
  box: ElementReviewScreen["current"];
  image: { width: number; height: number };
  changed?: boolean;
  testId: string;
}> = ({ imageName, box, image, changed, testId }) =>
  box ? (
    <ElementCrop
      imageName={imageName}
      box={box}
      image={image}
      width={CROP_WIDTH}
      maxHeight={CROP_HEIGHT}
      tone={changed ? "changed" : "none"}
      testId={testId}
    />
  ) : (
    // the element appeared or disappeared: nothing to cut out on that side
    <Box
      data-testid={testId}
      sx={{
        height: 32,
        borderRadius: radius.control,
        border: `1px dashed ${tokens.borderStrong}`,
      }}
    />
  );

/**
 * Review of a build by element (055, beta): each element changed on several screens, with the
 * element cut out of every one of them, baseline over current. The screens where nothing else
 * changed are taken by one decision; the rest are left to open on their own.
 */
export const ElementReview: React.FunctionComponent<{ buildId: string }> = ({
  buildId,
}) => {
  const { t } = useT();
  const { enqueueSnackbar } = useSnackbar();
  const announce = useDecisionSnackbar();
  const { testRuns } = useTestRunState();
  const [params, setParams] = useSearchParams();
  const [elements, setElements] = React.useState<ReviewedElement[] | null>(
    null,
  );
  const [unpicked, setUnpicked] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  // refetch when a decision changes what still needs one
  const pendingKey = React.useMemo(
    () =>
      testRuns
        .filter((run) => run.buildId === buildId && run.status === "unresolved")
        .map((run) => run.id)
        .sort()
        .join(","),
    [testRuns, buildId],
  );

  React.useEffect(() => {
    let current = true;
    testRunService
      .getElements(buildId)
      .then((found) => current && setElements(found))
      .catch(
        (error) =>
          current &&
          enqueueSnackbar(t("elements.loadFailed", { error: String(error) }), {
            variant: "error",
          }),
      );
    return () => {
      current = false;
    };
    // t is stable for a language; a new one does not need a refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildId, pendingKey, enqueueSnackbar]);

  const key = params.get("element");
  const element =
    elements?.find((item) => item.key === key) ?? elements?.[0] ?? null;
  const picked = React.useMemo(
    () => (element ? decidedScreens(element, unpicked) : []),
    [element, unpicked],
  );

  const choose = (next: string) => {
    setUnpicked(new Set());
    setParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.set("element", next);
        return params;
      },
      { replace: true },
    );
  };

  const toggle = (id: string) =>
    setUnpicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const decide = React.useCallback(
    async (action: "approve" | "reject") => {
      if (!picked.length || busy) return;
      const ids = picked.map((item) => item.id);
      setBusy(true);
      try {
        const decision =
          action === "approve"
            ? await testRunService.approveBulk(
                ids,
                picked.some((item) => item.merge),
              )
            : await testRunService.rejectBulk(ids);
        announce(action, ids.length, decision);
        setUnpicked(new Set());
      } catch (error) {
        enqueueSnackbar(`${error}`, { variant: "error" });
      } finally {
        setBusy(false);
      }
    },
    [picked, busy, announce, enqueueSnackbar],
  );

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isApproveHotkey(event)) return;
      event.preventDefault();
      decide("approve");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide]);

  if (!elements) return null;
  if (!element) {
    return <EmptyState title={t("elements.noElements")} />;
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2.5,
        alignItems: "flex-start",
      }}
    >
      <Box
        component="nav"
        aria-label={t("elements.elementsView")}
        sx={{
          flex: "1 1 240px",
          maxWidth: 300,
          p: 1,
          bgcolor: tokens.surface,
          border: `1px solid ${tokens.border}`,
          borderRadius: radius.card,
          display: "flex",
          flexDirection: "column",
          gap: 0.25,
        }}
      >
        {elements.map((item) => {
          const on = item.key === element.key;
          const most = elements[0].screens;
          return (
            <ButtonBase
              key={item.key}
              aria-pressed={on}
              data-testid="reviewElement"
              onClick={() => choose(item.key)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                px: 1.5,
                py: 1.25,
                borderRadius: radius.control,
                justifyContent: "flex-start",
                textAlign: "left",
                bgcolor: on ? tokens.brandSoft : "transparent",
                color: on ? tokens.brandDark : tokens.text,
                fontWeight: on ? 600 : 500,
                fontSize: type.body,
              }}
            >
              <Box
                component="span"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.name}
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: type.small,
                  color: tokens.textSecondary,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {item.screens}
              </Box>
              <Box
                aria-hidden
                sx={{
                  width: 48,
                  height: 6,
                  borderRadius: radius.pill,
                  bgcolor: tokens.border,
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    height: "100%",
                    width: `${Math.round((item.screens / most) * 100)}%`,
                    bgcolor: on ? tokens.brand : tokens.textMuted,
                  }}
                />
              </Box>
            </ButtonBase>
          );
        })}
      </Box>

      <Box
        component="section"
        aria-labelledby="reviewElementName"
        sx={{
          flex: "999 1 600px",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
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
          <Typography
            id="reviewElementName"
            component="h2"
            sx={{ fontSize: type.section, fontWeight: 600 }}
          >
            {element.name}
          </Typography>
          <Typography
            sx={{
              fontFamily: tokens.mono,
              fontSize: type.caption,
              color: tokens.textMuted,
            }}
          >
            {element.key}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="outlined"
            color="error"
            disabled={!picked.length || busy}
            onClick={() => decide("reject")}
            data-testid="reviewReject"
          >
            {t("elements.reject", { count: picked.length })}
          </Button>
          <Button
            variant="contained"
            disabled={!picked.length || busy}
            onClick={() => decide("approve")}
            data-testid="reviewApprove"
          >
            {t("elements.approve", { count: picked.length })}
          </Button>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 1.5,
          }}
        >
          {element.items.map((item) => {
            const on = item.only && !unpicked.has(item.id);
            return (
              <Box
                key={item.id}
                data-testid="reviewScreen"
                sx={{
                  p: 1.5,
                  bgcolor: tokens.surface,
                  border: `1px solid ${tokens.border}`,
                  borderRadius: radius.card,
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.75,
                  opacity: on ? 1 : 0.55,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Checkbox
                    size="small"
                    checked={on}
                    disabled={!item.only}
                    onChange={() => toggle(item.id)}
                    inputProps={{ "aria-label": t("elements.pick") }}
                    sx={{ p: 0.5 }}
                  />
                  <Typography
                    title={screenName(item)}
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
                  >
                    {screenName(item)}
                  </Typography>
                  {!item.only && (
                    <Typography
                      title={t("elements.alsoElsewhere")}
                      data-testid="reviewElsewhere"
                      sx={{
                        fontSize: type.caption,
                        fontWeight: 600,
                        color: tokens.status.changed.fg,
                      }}
                    >
                      +1
                    </Typography>
                  )}
                </Box>
                <Crop
                  imageName={item.baselineName}
                  box={item.baseline}
                  image={{
                    width: item.baselineWidth,
                    height: item.baselineHeight,
                  }}
                  testId="reviewBaseline"
                />
                <Crop
                  imageName={item.imageName}
                  box={item.current}
                  image={{ width: item.width, height: item.height }}
                  changed
                  testId="reviewCurrent"
                />
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

/** The Changes tab: groups of the same change, or (beta) the elements that changed (055). */
export const ChangesTab: React.FunctionComponent<{ buildId: string }> = ({
  buildId,
}) => {
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const byElement = params.get("by") === "elements";
  const setView = (view: "screens" | "elements") =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (view === "elements") next.set("by", "elements");
        else {
          next.delete("by");
          next.delete("element");
        }
        return next;
      },
      { replace: true },
    );
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 3,
          pt: 2,
        }}
      >
        <SlidingToggleGroup
          size="small"
          exclusive
          value={byElement ? "elements" : "screens"}
          onChange={(_, value) => value && setView(value)}
          aria-label={t("elements.views")}
        >
          <ToggleButton value="screens" data-testid="changesByScreens">
            {t("elements.screensView")}
          </ToggleButton>
          <ToggleButton value="elements" data-testid="changesByElements">
            {t("elements.elementsView")}
          </ToggleButton>
        </SlidingToggleGroup>
        <BetaChip />
      </Box>
      {byElement ? (
        <Box sx={{ px: 3, py: 2 }}>
          <ElementReview buildId={buildId} />
        </Box>
      ) : (
        <ChangeGroups buildId={buildId} />
      )}
    </Box>
  );
};
