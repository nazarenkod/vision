import React from "react";
import { TestVariation } from "../types";
import {
  Box,
  Card,
  CardMedia,
  CardContent,
  Chip,
  IconButton,
  Link as MuiLink,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { staticService } from "../services";
import { Link } from "react-router-dom";
import { routes } from "../constants";
import { DeleteOutline, ExpandMore } from "@mui/icons-material";
import { BaseModal } from "./BaseModal";
import { motion, tokens, type } from "../theme";
import { staggered } from "./motion/Stagger";
import { EmptyState } from "./EmptyState";
import { BranchTag, DeviceTags } from "./DeviceTags";
import { deviceLabel } from "../_helpers/device.helper";
import { useT } from "../i18n";

/**
 * Baselines grouped by check (its name and custom tags, per branch): one card
 * per check, a baseline per device inside it.
 */
export function groupByCheck(items: TestVariation[]): TestVariation[][] {
  const groups = new Map<string, TestVariation[]>();
  items.forEach((item) => {
    const key = JSON.stringify([
      item.branchName,
      item.name,
      item.customTags ?? "",
    ]);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return [...groups.values()].map((group) =>
    group.sort((a, b) => deviceLabel(a).localeCompare(deviceLabel(b))),
  );
}

/**
 * A check's card: no coloured edge; the name (two lines at most); grey tags
 * (the device, then the branch and the custom tags, three rows at most); the
 * device picker and delete at the bottom. Every card is as tall as the next,
 * so the grid keeps its rows. The whole card opens the shown device's
 * history: the name is a link stretched over the card, and only the picker
 * and delete sit above it, so they stay buttons of their own.
 */
const CARD_HEIGHT = 490;

/** Lifts a control over the card-wide link, so it gets its own clicks. */
const aboveCardLink = { position: "relative", zIndex: 1 } as const;

const CheckCard: React.FunctionComponent<{
  devices: TestVariation[];
  onDelete: (variation: TestVariation) => void;
  index: number;
}> = ({ devices, onDelete, index }) => {
  // a device approved nothing yet has no picture to show
  const [shownId, setShownId] = React.useState(
    (devices.find((d) => d.baselineName) ?? devices[0]).id,
  );
  const [menu, setMenu] = React.useState<HTMLElement | null>(null);
  const shown = devices.find((d) => d.id === shownId) ?? devices[0];
  const check = devices[0];
  const { t } = useT();
  const shownLabel = deviceLabel(shown, undefined, t);
  return (
    <Card
      {...staggered(index, 12)}
      data-testid="baselineCard"
      sx={{
        position: "relative",
        height: CARD_HEIGHT,
        display: "flex",
        flexDirection: "column",
        transition: `transform ${motion.base}ms ${motion.easing}, border-color ${motion.base}ms, box-shadow ${motion.base}ms`,
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: tokens.borderStrong,
          boxShadow: tokens.shadowShot,
        },
      }}
    >
      <CardMedia
        component="img"
        // phone screens: as tall as they are
        sx={{
          height: 300,
          flexShrink: 0,
          objectFit: "contain",
          boxSizing: "border-box",
          p: 1.25,
          background: tokens.lightbox,
          borderBottom: `1px solid ${tokens.border}`,
        }}
        image={staticService.getImage(shown.baselineName)}
        title={check.name}
      />
      <CardContent
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          gap: 1,
          p: 1.5,
          "&:last-child": { pb: 1 },
        }}
      >
        <MuiLink
          component={Link}
          to={`${routes.VARIATION_DETAILS_PAGE}/${shown.id}`}
          underline="none"
          color="inherit"
          title={check.name}
          data-testid="baselineHistory"
          sx={{
            fontWeight: 600,
            fontSize: type.body,
            flexShrink: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            overflowWrap: "anywhere",
            outline: "none",
            // the link covers the whole card, so a click anywhere opens history
            "&::after": {
              content: '""',
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
            },
            "&:focus-visible::after": {
              outline: `2px solid ${tokens.brand}`,
              outlineOffset: -2,
            },
          }}
        >
          {check.name}
        </MuiLink>
        <Box
          data-testid="baselineTags"
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 0.5,
            minWidth: 0,
            // three rows of small chips; more would push the card taller
            maxHeight: 80,
            overflow: "hidden",
          }}
        >
          {/* the device's tags flow in the same row as the branch and the tags */}
          <DeviceTags parts={shown} sx={{ display: "contents" }} />
          <BranchTag branch={check.branchName} />
          {check.customTags && <Chip size="small" label={check.customTags} />}
        </Box>
        <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
          {devices.map((device) => (
            <MenuItem
              key={device.id}
              selected={device.id === shown.id}
              aria-label={deviceLabel(device, undefined, t)}
              onClick={() => {
                setShownId(device.id);
                setMenu(null);
              }}
            >
              <DeviceTags parts={device} dense />
            </MenuItem>
          ))}
        </Menu>
        <Box
          data-testid="baselineFooter"
          sx={{ display: "flex", alignItems: "center", gap: 1, mt: "auto" }}
        >
          {devices.length > 1 && (
            <Chip
              size="small"
              variant="outlined"
              clickable
              onClick={(event) => setMenu(event.currentTarget)}
              onDelete={(event) => setMenu(event.currentTarget)}
              deleteIcon={<ExpandMore />}
              aria-haspopup="menu"
              aria-expanded={!!menu}
              label={t("baselines.devices", { count: devices.length })}
              data-testid="baselineDevices"
              sx={aboveCardLink}
            />
          )}
          <IconButton
            onClick={() => onDelete(shown)}
            size="small"
            aria-label={t("baselines.deleteOf", { device: shownLabel })}
            data-testid="baselineDelete"
            sx={{ ...aboveCardLink, ml: "auto", color: tokens.textSecondary }}
          >
            <DeleteOutline fontSize="small" />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

interface IProps {
  groups: TestVariation[][];
  onDeleteClick: (id: string) => void;
}

const TestVariationList: React.FunctionComponent<IProps> = ({
  groups,
  onDeleteClick,
}) => {
  const [selectedItem, setSelectedItem] = React.useState<TestVariation | null>(
    null,
  );

  const { t } = useT();
  const handleClose = () => {
    setSelectedItem(null);
  };

  return (
    <>
      {groups.length === 0 && (
        <EmptyState title={t("baselines.empty")}>
          {t("baselines.emptyHint")}
        </EmptyState>
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 2,
          alignItems: "start",
        }}
      >
        {groups.map((devices, index) => (
          <Box key={devices[0].id}>
            <CheckCard
              devices={devices}
              onDelete={setSelectedItem}
              index={index}
            />
          </Box>
        ))}
      </Box>

      {selectedItem && (
        <BaseModal
          open={!!selectedItem}
          title={t("baselines.deleteTitle")}
          submitButtonText={t("baselines.delete")}
          onCancel={handleClose}
          content={
            <>
              <Typography>
                {t("baselines.deleteConfirm", { name: selectedItem.name })}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {t("baselines.deleteScope", {
                  device: deviceLabel(selectedItem, undefined, t),
                  branch: selectedItem.branchName,
                })}
              </Typography>
            </>
          }
          onSubmit={() => {
            onDeleteClick(selectedItem.id);
            handleClose();
          }}
        />
      )}
    </>
  );
};

export default TestVariationList;
