import { handleResponse, authHeader } from "../_helpers/service.helpers";
import { API_URL } from "../_config/env.config";
import {
  BackupSettings,
  BackupStatus,
  BackupsOverview,
  DriveCode,
  DrivePoll,
} from "../types/backups";

const JSON_HEADERS = { "Content-Type": "application/json" };

const call = <T>(method: string, path: string, body?: unknown): Promise<T> =>
  fetch(`${API_URL}/backups${path}`, {
    method,
    headers:
      body === undefined ? authHeader() : { ...JSON_HEADERS, ...authHeader() },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(handleResponse);

export const backupsService = {
  status: () => call<BackupStatus>("GET", "/status"),
  overview: () => call<BackupsOverview>("GET", ""),
  connect: (clientId: string, clientSecret: string) =>
    call<DriveCode>("POST", "/drive/connect", { clientId, clientSecret }),
  poll: () => call<DrivePoll>("POST", "/drive/poll"),
  test: () =>
    call<{ ok: boolean; error: string | null }>("POST", "/drive/test"),
  disconnect: () => call<void>("DELETE", "/drive"),
  saveSettings: (settings: BackupSettings) =>
    call<BackupSettings>("PUT", "/settings", settings),
  run: () => call<{ backupRequestedAt: string }>("POST", "/run"),
};
