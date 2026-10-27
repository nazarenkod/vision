import React from "react";
import { Alert, Link } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { routes } from "../constants";
import { useUserState } from "../contexts";
import { backupsService } from "../services";

// Only admins can act on a failing backup, so only they see it; a failed request stays silent.
export const BackupWarning: React.FunctionComponent = () => {
  const { user } = useUserState();
  const isAdmin = user?.role === "admin";
  const [warning, setWarning] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isAdmin) {
      setWarning(null);
      return;
    }
    let active = true;
    backupsService
      .status()
      .then((status) => active && setWarning(status.warning))
      .catch(() => active && setWarning(null));
    return () => {
      active = false;
    };
  }, [isAdmin]);

  if (!warning) return null;
  return (
    <Alert
      severity="warning"
      data-testid="backupWarning"
      sx={{ borderRadius: 0 }}
    >
      {warning}{" "}
      <Link component={RouterLink} to={routes.BACKUPS_PAGE}>
        Open Backups
      </Link>
    </Alert>
  );
};
