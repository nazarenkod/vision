import React from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { TestVariation } from "../types";
import { testVariationService, staticService } from "../services";
import {
  Box,
  Button,
  ButtonBase,
  Link as MuiLink,
  Typography,
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { routes } from "../constants";
import { motion, tokens, radius, type } from "../theme";
import { recordDate } from "../_helpers/baselineHistory.helper";
import { staggered } from "../components/motion/Stagger";
import {
  buildProjectPageUrl,
  buildTestRunLocation,
} from "../_helpers/route.helpers";
import { TestVariationDetails } from "../components/TestVariationDetails";
import { useSnackbar } from "notistack";
import { useT } from "../i18n";
import TestStatusChip from "../components/TestStatusChip";
import { Baseline } from "../types/baseline";

const TestVariationDetailsPage: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { t, formatDate } = useT();
  const { testVariationId } = useParams<{ testVariationId: string }>();
  const [testVariation, setTestVariation] = React.useState<TestVariation>();

  React.useEffect(() => {
    if (testVariationId) {
      testVariationService
        .getDetails(testVariationId)
        .then((item) => {
          setTestVariation(item);
        })
        .catch((err) =>
          enqueueSnackbar(err, {
            variant: "error",
          }),
        );
    }
  }, [testVariationId, enqueueSnackbar]);

  // newest first, as the API sends them; the one shown is compared with the
  // one before it (REQ-018-63)
  const [pickedIndex, setPickedIndex] = React.useState(0);
  React.useEffect(() => setPickedIndex(0), [testVariationId]);
  const baselines = testVariation?.baselines ?? [];
  const picked = baselines[pickedIndex];
  const before = baselines[pickedIndex + 1];

  const openTestRun = (baseline: Baseline) => {
    const { testRun } = baseline;
    if (testRun && testVariation) {
      navigate({
        pathname: buildProjectPageUrl(testVariation.projectId),
        ...buildTestRunLocation(testRun.buildId, testRun.id),
      });
    }
  };

  const pane = (
    title: string,
    baseline: Baseline | undefined,
    testId: string,
  ) => (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        background: tokens.lightbox,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          height: 36,
          bgcolor: tokens.surface,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        <Typography
          variant="overline"
          sx={{ fontWeight: 600, letterSpacing: "0.06em", color: tokens.text }}
        >
          {title}
        </Typography>
        {baseline && (
          <Typography
            data-testid={`${testId}Date`}
            sx={{ fontSize: type.small, color: tokens.textMuted }}
          >
            {recordDate(baseline.createdAt, formatDate)}
          </Typography>
        )}
      </Box>
      <Box sx={{ p: 2, display: "grid", placeItems: "center", minHeight: 320 }}>
        {baseline ? (
          <Box
            component="img"
            key={baseline.id}
            data-testid={testId}
            src={staticService.getImage(baseline.baselineName)}
            alt={`${title}: ${testVariation?.name ?? ""}`}
            className="v-enter"
            sx={{
              maxWidth: "100%",
              maxHeight: 640,
              objectFit: "contain",
              boxShadow: tokens.shadowShot,
              borderRadius: radius.control,
            }}
          />
        ) : (
          <Typography color="textSecondary">
            {t("baselines.nothingBefore")}
          </Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ px: 4, py: 3 }}>
      {testVariation && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box
            className="v-enter"
            sx={{ display: "flex", flexDirection: "column", gap: 1 }}
          >
            <Button
              component={Link}
              to={`${routes.VARIATION_LIST_PAGE}/${testVariation.projectId}`}
              startIcon={<ArrowBack />}
              size="small"
              sx={{
                alignSelf: "flex-start",
                color: tokens.textSecondary,
                px: 1,
              }}
            >
              {t("baselines.title")}
            </Button>
            <Typography
              variant="overline"
              sx={{ color: tokens.textMuted, lineHeight: 1 }}
            >
              {t("baselines.historyTitle")}
            </Typography>
            <Typography variant="h4" component="h1">
              {testVariation.name}
            </Typography>
            <TestVariationDetails testVariation={testVariation} />
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "320px minmax(0, 1fr)" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <Box
              component="ol"
              aria-label={t("baselines.newestFirst")}
              sx={{
                listStyle: "none",
                m: 0,
                p: 1,
                bgcolor: tokens.surface,
                border: `1px solid ${tokens.border}`,
                borderRadius: radius.card,
                position: "relative",
                // the line the record dots sit on
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: 21,
                  top: 22,
                  bottom: 22,
                  width: 2,
                  bgcolor: tokens.border,
                },
              }}
            >
              {baselines.map((baseline, index) => {
                const on = index === pickedIndex;
                return (
                  <Box
                    component="li"
                    key={baseline.id}
                    data-testid="historyEntry"
                    data-picked={on ? "true" : "false"}
                    {...staggered(index, baselines.length)}
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1,
                      p: 1,
                      borderRadius: radius.control,
                      bgcolor: on ? tokens.brandSoft : "transparent",
                      transition: `background-color ${motion.base}ms ${motion.easing}`,
                      "&:hover": {
                        bgcolor: on ? tokens.brandSoft : tokens.subtle,
                      },
                    }}
                  >
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 10,
                        height: 10,
                        mt: 0.75,
                        ml: 0.5,
                        borderRadius: radius.control,
                        flexShrink: 0,
                        position: "relative",
                        zIndex: 1,
                        bgcolor: on ? tokens.brand : tokens.borderStrong,
                        boxShadow: `0 0 0 3px ${tokens.surface}`,
                        transform: on ? "scale(1.2)" : "none",
                        transition: `transform ${motion.base}ms ${motion.spring}, background-color ${motion.base}ms`,
                      }}
                    />
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 0.25,
                      }}
                    >
                      <ButtonBase
                        onClick={() => setPickedIndex(index)}
                        aria-pressed={on}
                        sx={{
                          width: "100%",
                          minWidth: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          textAlign: "left",
                          gap: 0.25,
                          borderRadius: radius.control,
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            alignItems: "center",
                            width: "100%",
                          }}
                        >
                          {/* the date and the time in one line (REQ-046-55) */}
                          <Typography
                            data-testid="historyDate"
                            sx={{ fontWeight: 600, whiteSpace: "nowrap" }}
                          >
                            {recordDate(baseline.createdAt, formatDate)}
                          </Typography>
                          {index === 0 && (
                            <Typography
                              component="span"
                              sx={{
                                fontSize: type.caption,
                                fontWeight: 600,
                                color: tokens.brandDark,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {`· ${t("baselines.inUse")}`}
                            </Typography>
                          )}
                          {baseline.testRun && (
                            <Box sx={{ ml: "auto" }}>
                              <TestStatusChip
                                status={baseline.testRun.status}
                              />
                            </Box>
                          )}
                        </Box>
                        {baseline.user && (
                          <Typography
                            variant="body2"
                            color="textSecondary"
                            sx={{ overflowWrap: "anywhere" }}
                          >
                            {`${baseline.user.firstName} ${baseline.user.lastName} <${baseline.user.email}>`}
                          </Typography>
                        )}
                      </ButtonBase>
                      {baseline.testRun && (
                        <MuiLink
                          component="button"
                          type="button"
                          onClick={() => openTestRun(baseline)}
                          sx={{
                            fontSize: type.small,
                            fontWeight: 600,
                            textAlign: "left",
                          }}
                        >
                          {t("baselines.openInReview")}
                        </MuiLink>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1px",
                bgcolor: tokens.border,
                border: `1px solid ${tokens.border}`,
                borderRadius: radius.card,
                overflow: "hidden",
              }}
            >
              {pane(t("baselines.selected"), picked, "historyPicked")}
              {pane(t("baselines.previous"), before, "historyBefore")}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default TestVariationDetailsPage;
