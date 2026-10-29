import React, { FunctionComponent } from "react";
import Joyride, { CallBackProps, STATUS } from "react-joyride";
import { Button } from "@mui/material";
import { useHelpState, useTokens } from "../contexts";
import { ExploreOutlined } from "@mui/icons-material";
import { TAKE_TOUR_BUTTON_TEST_ID } from "./GuidedTour.locators";

const GuidedTour: FunctionComponent = () => {
  const [run, setRun] = React.useState(false);
  const { helpSteps } = useHelpState();
  // react-joyride paints with inline styles, so it gets real colours
  const colours = useTokens();

  const getHelpSteps = React.useCallback(() => {
    if (!helpSteps?.length) {
      return [];
    }

    for (const step of helpSteps) {
      step.disableBeacon = true;
      step.hideCloseButton = true;
    }

    return helpSteps;
  }, [helpSteps]);

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
      Take a tour
    </Button>
  );
};

export default GuidedTour;
