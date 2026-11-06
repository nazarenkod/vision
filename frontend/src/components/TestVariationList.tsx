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
 * A check's card as the mock-up draws it (046): no coloured edge; the name;
 * one wrapping row of grey tags (the device, then the branch and the custom
 * tags); History on the left and delete on the right. A check on several
 * devices shows one at a time, picked from a menu after its tags.
 */
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
          gap: 1,
          p: 1.5,
          "&:last-child": { pb: 1 },
        }}
      >
        <Typography sx={{ fontWeight: 600, fontSize: type.body }}>
          {check.name}
        </Typography>
        <Box
          data-testid="baselineTags"
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 0.5,
            minWidth: 0,
          }}
        >
          {/* the device's tags flow in the same row as the branch and the tags */}
          <DeviceTags parts={shown} sx={{ display: "contents" }} />
          <BranchTag branch={check.branchName} />
          {check.customTags && <Chip size="small" label={check.customTags} />}
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
            />
          )}
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
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <MuiLink
            component={Link}
            to={`${routes.VARIATION_DETAILS_PAGE}/${shown.id}`}
            underline="hover"
            data-testid="baselineHistory"
            sx={{ fontSize: type.small, fontWeight: 600, color: tokens.brand }}
          >
            {t("baselines.history")}
          </MuiLink>
          <IconButton
            onClick={() => onDelete(shown)}
            size="small"
            aria-label={t("baselines.deleteOf", { device: shownLabel })}
            data-testid="baselineDelete"
            sx={{ ml: "auto", color: tokens.textSecondary }}
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
