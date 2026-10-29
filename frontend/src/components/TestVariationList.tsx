import React from "react";
import { TestVariation } from "../types";
import {
  Box,
  Card,
  CardMedia,
  CardContent,
  Button,
  ButtonBase,
  Chip,
  IconButton,
  Typography,
} from "@mui/material";
import { staticService } from "../services";
import { Link } from "react-router-dom";
import { routes } from "../constants";
import { Delete } from "@mui/icons-material";
import { BaseModal } from "./BaseModal";
import { motion, tokens } from "../theme";
import { staggered } from "./motion/Stagger";
import { EmptyState } from "./EmptyState";
import { deviceLabel } from "../_helpers/device.helper";

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

const CheckCard: React.FunctionComponent<{
  devices: TestVariation[];
  onDelete: (variation: TestVariation) => void;
  index: number;
}> = ({ devices, onDelete, index }) => {
  // a device approved nothing yet has no picture to show
  const [shownId, setShownId] = React.useState(
    (devices.find((d) => d.baselineName) ?? devices[0]).id,
  );
  const shown = devices.find((d) => d.id === shownId) ?? devices[0];
  const check = devices[0];
  return (
    <Card
      {...staggered(index, 12)}
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
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography sx={{ fontWeight: 600 }}>{check.name}</Typography>
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          <Chip
            size="small"
            label={check.branchName}
            sx={{ fontFamily: tokens.mono, fontSize: 11.5, borderRadius: 1.5 }}
          />
          {check.customTags && (
            <Chip size="small" variant="outlined" label={check.customTags} />
          )}
        </Box>
        {devices.map((device) => (
          <Box
            key={device.id}
            sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
          >
            <ButtonBase
              onClick={() => setShownId(device.id)}
              sx={{
                fontSize: 12.5,
                lineHeight: 1.35,
                textAlign: "left",
                justifyContent: "flex-start",
                flex: 1,
                py: 0.25,
                fontWeight: device.id === shown.id ? 500 : 400,
                color:
                  device.id === shown.id ? tokens.text : tokens.textSecondary,
              }}
            >
              {deviceLabel(device)}
            </ButtonBase>
            <Button
              size="small"
              component={Link}
              to={`${routes.VARIATION_DETAILS_PAGE}/${device.id}`}
            >
              History
            </Button>
            <IconButton
              onClick={() => onDelete(device)}
              size="small"
              aria-label={`Delete ${deviceLabel(device)}`}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        ))}
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

  const handleClose = () => {
    setSelectedItem(null);
  };

  return (
    <>
      {groups.length === 0 && (
        <EmptyState title="No baselines here">
          Baselines appear after the first approved screenshot, or none match
          the filters.
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
          title={"Delete baseline"}
          submitButtonText={"Delete"}
          onCancel={handleClose}
          content={
            <>
              <Typography>{`Are you sure you want to delete: ${selectedItem.name}?`}</Typography>
              <Typography variant="body2" color="textSecondary">
                Only the baseline for {deviceLabel(selectedItem)} on{" "}
                {selectedItem.branchName}.
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
