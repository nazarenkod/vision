import { handleResponse, authHeader } from "../_helpers/service.helpers";
import { API_URL } from "../_config/env.config";
import { BackupStatus } from "../types/backups";

function status(): Promise<BackupStatus> {
  return fetch(`${API_URL}/backups/status`, {
    method: "GET",
    headers: authHeader(),
  }).then(handleResponse);
}

export const backupsService = {
  status,
};
