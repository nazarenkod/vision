import React from "react";
import { Alert } from "@mui/material";
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
      {warning} Check scripts/vision-backup.sh on the server (DEPLOY.md,
      backups).
    </Alert>
  );
};
