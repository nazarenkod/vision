/** GET /backups/status (admins only). */
export interface BackupStatus {
  // false when this installation has no backups set up
  configured: boolean;
  lastSuccessAt: string | null;
  warning: string | null;
}

export interface BackupSettings {
  // daily, HH:MM in the server's time zone
  time: string;
  // database backups kept in Drive
  keep: number;
}

export interface RemoteBackup {
  name: string;
  size: number | null;
  modifiedTime: string | null;
}

/** GET /backups: never holds the client secret or tokens. */
export interface BackupsOverview extends BackupStatus {
  // false when the API cannot write settings for the backup script
  available: boolean;
  lastAttemptAt: string | null;
  lastError: string | null;
  pendingUploads: number;
  runningSince: string | null;
  backupRequestedAt: string | null;
  drive: {
    connected: boolean;
    email: string | null;
    folderName: string | null;
  };
  settings: BackupSettings;
  remote: { backups: RemoteBackup[]; error: string | null } | null;
}

/** POST /backups/drive/connect: what to enter in Google. */
export interface DriveCode {
  userCode: string;
  verificationUrl: string;
  expiresAt: string;
  interval: number;
}

export type DrivePoll =
  | { state: "pending" }
  | { state: "connected"; email: string | null }
  | { state: "failed"; error: string };
