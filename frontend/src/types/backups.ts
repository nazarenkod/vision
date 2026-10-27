/** GET /backups/status (admins only). */
export interface BackupStatus {
  // false when this installation has no backups set up
  configured: boolean;
  lastSuccessAt: string | null;
  warning: string | null;
}
