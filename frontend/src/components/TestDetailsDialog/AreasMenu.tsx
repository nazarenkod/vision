import React from "react";
import {
  Box,
  Button,
  ButtonBase,
  Paper,
  Popper,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add, ExpandLess, ExpandMore, Lock } from "@mui/icons-material";
import { IgnoreArea } from "../../types/ignoreArea";
import { tokens } from "../../theme";
import { useT } from "../../i18n";

export type AreaKind = "ignore" | "compare";

interface AreasMenuProps {
  open: boolean;
  onToggle: () => void;
  // editing needs the editor role; the count and the list do not
  canEdit: boolean;
  kind: AreaKind;
  onKind: (kind: AreaKind) => void;
  drawing: boolean;
  onDraw: () => void;
  selectedId?: string;
  onSelect: (id: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onApplyToBuild: () => void;
  areas: IgnoreArea[];
  // sent by the test with the screenshot: applied, never edited here
  testAreas: IgnoreArea[];
  suggestions: Record<string, { selector: string; element: string }>;
  onUseElement: (areaId: string) => void;
  dirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

const DashedSquare = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeDasharray="3 3"
    aria-hidden="true"
  >
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
  </svg>
);

/**
 * VRT's pixel areas behind one button (REQ-024-30): elements are the main way
 * to leave something out, areas are for what has no element. The areas keep
 * working as before; the button shows how many there are (REQ-024-32).
 */
export const AreasMenu: React.FunctionComponent<AreasMenuProps> = ({
  open,
  onToggle,
  canEdit,
  kind,
  onKind,
  drawing,
  onDraw,
  selectedId,
  onSelect,
  onDelete,
  onClear,
  onApplyToBuild,
  areas,
  testAreas,
  suggestions,
  onUseElement,
  dirty,
  onSave,
  onDiscard,
}) => {
  const { t } = useT();
  const anchor = React.useRef<HTMLButtonElement>(null);
  const count = areas.length + testAreas.length;

  const tool = (
    label: string,
    onClick: () => void,
    disabled: boolean,
    testId: string,
    pressed?: boolean,
  ) => (
    <Button
      size="small"
      variant="outlined"
      disabled={!canEdit || disabled}
      onClick={onClick}
      data-testid={testId}
      aria-pressed={pressed}
      startIcon={pressed !== undefined ? <Add fontSize="small" /> : undefined}
      sx={{
        borderRadius: "7px",
        fontSize: 12.5,
        fontWeight: pressed ? 600 : 500,
        color: pressed ? tokens.brandDark : tokens.textSecondary,
        borderColor: pressed ? tokens.brand : tokens.border,
        bgcolor: pressed ? tokens.brandSoft : tokens.surface,
      }}
    >
      {label}
    </Button>
  );

  const kindButton = (value: AreaKind, label: string) => (
    <ButtonBase
      disabled={!canEdit}
      onClick={() => onKind(value)}
      aria-pressed={kind === value}
      sx={{
        borderRadius: "6px",
        px: 1.5,
        py: 0.5,
        font: "inherit",
        fontSize: 12.5,
        fontWeight: kind === value ? 600 : 500,
        color: kind === value ? tokens.text : tokens.textSecondary,
        bgcolor: kind === value ? tokens.surface : "transparent",
        boxShadow: kind === value ? tokens.shadowShot : "none",
      }}
    >
      {label}
    </ButtonBase>
  );

  const row = (area: IgnoreArea, fromTest: boolean) => {
    const suggestion = fromTest ? undefined : suggestions[area.id];
    return (
      <Box
        key={`${fromTest ? "test" : "own"}-${area.id}`}
        data-testid="areaRow"
        onClick={() => !fromTest && onSelect(area.id)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          fontSize: 13,
          mx: -0.75,
          px: 0.75,
          py: 0.5,
          borderRadius: "6px",
          cursor: fromTest ? "default" : "pointer",
          color: fromTest ? tokens.textMuted : tokens.text,
          bgcolor: selectedId === area.id ? tokens.subtle : "transparent",
        }}
      >
        <span>
          {t("areas.area", {
            width: Math.round(area.width),
            height: Math.round(area.height),
          })}
        </span>
        {fromTest ? (
          <Box
            component="span"
            sx={{
              ml: "auto",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            <Lock sx={{ fontSize: 13 }} />
            {t("areas.fromTest")}
          </Box>
        ) : (
          suggestion &&
          canEdit && (
            <Tooltip
              title={t("areas.useElementHelp", { element: suggestion.element })}
            >
              <Button
                size="small"
                sx={{ ml: "auto", minWidth: 0, p: 0, fontSize: 12.5 }}
                data-testid="useElement"
                onClick={(event) => {
                  event.stopPropagation();
                  onUseElement(area.id);
                }}
              >
                {t("areas.useElement")}
              </Button>
            </Tooltip>
          )
        )}
      </Box>
    );
  };

  return (
    <>
      <Button
        ref={anchor}
        onClick={onToggle}
        aria-expanded={open}
        data-testid="areasButton"
        startIcon={<DashedSquare />}
        endIcon={open ? <ExpandLess /> : <ExpandMore />}
        sx={{
          height: 34,
          px: 1.25,
          color: open ? tokens.text : tokens.textSecondary,
          bgcolor: open ? tokens.subtle : "transparent",
          fontWeight: open ? 600 : 500,
          fontSize: 13.5,
        }}
      >
        {t("areas.button")}
        {count > 0 && (
          <Box
            component="span"
            data-testid="areasCount"
            sx={{
              ml: 0.75,
              fontSize: 11.5,
              fontWeight: 600,
              bgcolor: open ? tokens.surface : tokens.status.neutral.bg,
              color: tokens.status.neutral.fg,
              borderRadius: "999px",
              px: 0.9,
              lineHeight: "18px",
            }}
          >
            {count}
          </Box>
        )}
      </Button>
      {/* not modal: drawing happens on the screenshot while this stays open */}
      <Popper
        open={open}
        anchorEl={anchor.current}
        placement="bottom-end"
        sx={{ zIndex: 1300 }}
      >
        <Paper
          role="dialog"
          aria-label={t("areas.title")}
          data-testid="areasMenu"
          sx={{
            mt: 1,
            width: 340,
            borderRadius: "14px",
            boxShadow: tokens.shadowPop,
          }}
        >
          <Box
            sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 600, flexGrow: 1 }}>
                {t("areas.title")}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  bgcolor: tokens.subtle,
                  borderRadius: "8px",
                  p: "2px",
                }}
              >
                {kindButton("ignore", t("areas.ignore"))}
                {kindButton("compare", t("areas.compare"))}
              </Box>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {tool(t("areas.draw"), onDraw, false, "areaDraw", drawing)}
              {tool(t("areas.delete"), onDelete, !selectedId, "areaDelete")}
              {tool(t("areas.clear"), onClear, !areas.length, "areaClear")}
              {tool(
                t("areas.toBuild"),
                onApplyToBuild,
                !selectedId,
                "areaToBuild",
              )}
            </Box>
            {count > 0 && (
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                {areas.map((area) => row(area, false))}
                {testAreas.map((area) => row(area, true))}
              </Box>
            )}
          </Box>
          {canEdit && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 1,
                px: 2,
                py: 1.25,
                borderTop: `1px solid ${tokens.border}`,
              }}
            >
              <Button size="small" disabled={!dirty} onClick={onDiscard}>
                {t("areas.discard")}
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={!dirty}
                onClick={onSave}
                data-testid="areasSave"
              >
                {t("areas.save")}
              </Button>
            </Box>
          )}
        </Paper>
      </Popper>
    </>
  );
};
