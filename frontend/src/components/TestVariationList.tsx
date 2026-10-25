import React from "react";
import { TestVariation } from "../types";
import {
  Box,
  Card,
  Grid,
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
import { tokens } from "../theme";

const deviceLabel = (variation: TestVariation) =>
  [variation.device, variation.os, variation.browser, variation.viewport]
    .filter(Boolean)
    .join(" · ") || "No device";

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
}> = ({ devices, onDelete }) => {
  // a device approved nothing yet has no picture to show
  const [shownId, setShownId] = React.useState(
    (devices.find((d) => d.baselineName) ?? devices[0]).id,
  );
  const shown = devices.find((d) => d.id === shownId) ?? devices[0];
  const check = devices[0];
  return (
    <Card sx={{ maxWidth: 345 }}>
      <CardMedia
        component="img"
        sx={{ height: 140, objectFit: "contain" }}
        image={staticService.getImage(shown.baselineName)}
        title={check.name}
      />
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography sx={{ fontWeight: 600 }}>{check.name}</Typography>
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          <Chip size="small" label={check.branchName} />
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
                fontSize: 13.5,
                textAlign: "left",
                justifyContent: "flex-start",
                flex: 1,
                py: 0.25,
                fontWeight: device.id === shown.id ? 600 : 400,
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
      <Grid container spacing={2}>
        {groups.length === 0 && (
          <Grid item>
            <Typography variant="h5">No variations</Typography>
          </Grid>
        )}
        {groups.map((devices) => (
          <Grid item key={devices[0].id} xs={12} sm={6} md={4}>
            <CheckCard devices={devices} onDelete={setSelectedItem} />
          </Grid>
        ))}
      </Grid>

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
