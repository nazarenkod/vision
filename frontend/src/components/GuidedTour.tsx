import React, { FunctionComponent } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { Button } from "@mui/material";
import { useHelpState, useTokens } from "../contexts";
import { ExploreOutlined } from "@mui/icons-material";
import { TAKE_TOUR_BUTTON_TEST_ID } from "./GuidedTour.locators";
import { isMessageKey, useT } from "../i18n";

const GuidedTour: FunctionComponent = () => {
  const [run, setRun] = React.useState(false);
  const { helpSteps } = useHelpState();
  // react-joyride paints with inline styles, so it gets real colours
  const colours = useTokens();
  const { t } = useT();

  const getHelpSteps = React.useCallback(() => {
    if (!helpSteps?.length) {
      return [];
    }

    // a key reads as its text; anything else is shown as it is
    const text = (value: Step["content"] | Step["title"]) =>
      typeof value === "string" && isMessageKey(value) ? t(value) : value;
    return helpSteps.map((step) => ({
      ...step,
      content: text(step.content),
      title: text(step.title),
      disableBeacon: true,
      hideCloseButton: true,
    }));
  }, [helpSteps, t]);

  const handleJoyrideCallback = ({ status }: CallBackProps) => {
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
    }
  };

  const handleClickStart = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();

    const [firstStep] = helpSteps;
    if (firstStep && typeof firstStep.target === "string") {
      const targetId = firstStep.target.startsWith("#")
        ? firstStep.target.slice(1)
        : firstStep.target;

      if (!document.getElementById(targetId)) {
        return;
      }
    }

    setRun(true);
  };

  return (
    <Button
      startIcon={<ExploreOutlined />}
      onClick={handleClickStart}
      data-testid={TAKE_TOUR_BUTTON_TEST_ID}
      fullWidth
      sx={{
        justifyContent: "flex-start",
        color: "inherit",
        fontWeight: 400,
        px: 1.25,
        minHeight: 38,
        "&:hover": { background: "transparent" },
      }}
    >
      <Joyride
        callback={handleJoyrideCallback}
        continuous={true}
        run={run}
        scrollToFirstStep={true}
        // left on, Joyride writes overflow: initial into <main> whenever a page
        // is too short to scroll, and later long pages scroll the whole window
        disableScrollParentFix={true}
        showProgress={true}
        showSkipButton={true}
        steps={getHelpSteps()}
        locale={{
          back: t("tour.back"),
          close: t("tour.close"),
          last: t("tour.last"),
          next: t("tour.next"),
          skip: t("tour.skip"),
        }}
        disableCloseOnEsc={true}
        styles={{
          options: {
            zIndex: 10000,
            primaryColor: colours.brand,
            backgroundColor: colours.surface,
            textColor: colours.text,
            arrowColor: colours.surface,
            overlayColor: colours.scrim,
          },
          tooltip: { borderRadius: 14, boxShadow: colours.shadowPop },
          buttonNext: {
            color: colours.brandInk,
            backgroundColor: colours.brand,
            borderRadius: 8,
            fontWeight: 600,
          },
          buttonBack: { color: colours.brand },
          buttonSkip: { color: colours.textMuted },
        }}
      />
      {t("tour.take")}
    </Button>
  );
};

export default GuidedTour;
