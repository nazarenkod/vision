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
 * The queue's name and the position in it, instead of "Step N/M" (REQ-031-24);
 * the name opens the other queues (REQ-031-25).
 */
export const QueueHeader: React.FunctionComponent<{
  label: string;
  position: number;
  total: number;
  current: QueueKey;
  choices: QueueChoice[];
  labelOf: (choice: QueueChoice) => string;
  onChoose: (key: QueueKey) => void;
}> = ({ label, position, total, current, choices, labelOf, onChoose }) => {
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
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      <Button
        data-testid="queueName"
        variant="outlined"
        color="inherit"
        size="small"
        endIcon={<ExpandMore />}
        aria-label={t("queue.choose")}
        aria-haspopup="menu"
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ fontWeight: 600, borderColor: tokens.borderStrong }}
      >
        {label}
      </Button>
      <Box
        component="span"
        data-testid="queuePosition"
        sx={{
          fontSize: type.caption,
          color: tokens.textSecondary,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {position} / {total}
      </Box>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {item(choices[0])}
        {choices.length > 1 && (
          <ListSubheader>{t("queue.groups")}</ListSubheader>
        )}
        {choices.slice(1).map(item)}
        {!inMenu && <ListSubheader>{t("queue.fromOverview")}</ListSubheader>}
        {!inMenu && item({ key: current, group: null, waiting: total })}
      </Menu>
    </Box>
  );
};
