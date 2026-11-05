import React from "react";
import { Box, Button, ListSubheader, Menu, MenuItem } from "@mui/material";
import { Check, ExpandMore } from "@mui/icons-material";
import { tokens, type } from "../../theme";
import { useT } from "../../i18n";
import {
  QueueChoice,
  QueueKey,
  sameQueue,
} from "../../_helpers/reviewQueue.helper";

/**
 * The queue's name after "N of M in" (REQ-031-24, REQ-046-05); the name opens
 * the other queues (REQ-031-25). The position itself is StepProgress's.
 */
export const QueueHeader: React.FunctionComponent<{
  label: string;
  total: number;
  current: QueueKey;
  choices: QueueChoice[];
  labelOf: (choice: QueueChoice) => string;
  onChoose: (key: QueueKey) => void;
}> = ({ label, total, current, choices, labelOf, onChoose }) => {
  const { t } = useT();
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const inMenu = choices.some((choice) => sameQueue(choice.key, current));
  const item = (choice: QueueChoice) => (
    <MenuItem
      key={labelOf(choice) + JSON.stringify(choice.key)}
      selected={sameQueue(choice.key, current)}
      onClick={() => {
        setAnchor(null);
        onChoose(choice.key);
      }}
      sx={{ gap: 1, minWidth: 260 }}
    >
      <Box sx={{ width: 18, display: "grid", color: tokens.brand }}>
        {sameQueue(choice.key, current) && <Check sx={{ fontSize: 16 }} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>{labelOf(choice)}</Box>
      <Box
        component="span"
        sx={{
          fontSize: type.caption,
          fontVariantNumeric: "tabular-nums",
          color: tokens.textMuted,
        }}
      >
        {choice.waiting}
      </Box>
    </MenuItem>
  );
  return (
    <>
      <Button
        data-testid="queueName"
        variant="text"
        color="inherit"
        size="small"
        endIcon={<ExpandMore />}
        aria-label={t("queue.choose")}
        aria-haspopup="menu"
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          minWidth: 0,
          px: 0.75,
          fontSize: type.small,
          fontWeight: 500,
          color: tokens.textSecondary,
          "& .MuiButton-endIcon": { ml: 0.25 },
        }}
      >
        {label}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {item(choices[0])}
        {choices.length > 1 && (
          <ListSubheader>{t("queue.groups")}</ListSubheader>
        )}
        {choices.slice(1).map(item)}
        {!inMenu && <ListSubheader>{t("queue.fromOverview")}</ListSubheader>}
        {!inMenu && item({ key: current, group: null, waiting: total })}
      </Menu>
    </>
  );
};
