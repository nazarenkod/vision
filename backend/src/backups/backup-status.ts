/** What scripts/vision-backup.sh writes after every run (demo-data/backup-status/status.json). */
export interface BackupStatus {
  lastAttemptAt: string | null;
  // the last time a backup reached the remote (Google Drive)
  lastSuccessAt: string | null;
  lastError: string | null;
  // local backups still waiting for upload
  pendingUploads: number;
}

// A nightly backup a couple of hours late is fine; a missed night is not (RPO 24 h).
export const STALE_AFTER_HOURS = 26;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

export function parseBackupStatus(raw: string | null | undefined): BackupStatus | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      lastAttemptAt: text(parsed.lastAttemptAt),
      lastSuccessAt: text(parsed.lastSuccessAt),
      lastError: text(parsed.lastError),
      pendingUploads: Number.isFinite(parsed.pendingUploads) ? parsed.pendingUploads : 0,
    };
  } catch {
    return null;
  }
}

/** The warning admins see, or null when the last backup is recent enough. */
export function backupWarning(status: BackupStatus | null, now: Date): string | null {
  const why = status?.lastError ? ` Last attempt: ${status.lastError}.` : '';
  const success = status?.lastSuccessAt ? Date.parse(status.lastSuccessAt) : NaN;
  if (!status || Number.isNaN(success)) {
    return `Vision has not been backed up yet.${why}`;
  }
  const hours = Math.floor((now.getTime() - success) / 3_600_000);
  if (hours <= STALE_AFTER_HOURS) return null;
  return `The last backup is ${hours} hours old.${why}`;
}
