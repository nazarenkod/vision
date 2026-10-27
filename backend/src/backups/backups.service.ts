import { Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { backupWarning, parseBackupStatus } from './backup-status';

export interface BackupStatusResponse {
  // false when this installation has no backups set up (the demo); then there is nothing to warn about
  configured: boolean;
  lastSuccessAt: string | null;
  warning: string | null;
}

@Injectable()
export class BackupsService {
  async status(now = new Date()): Promise<BackupStatusResponse> {
    const file = process.env.BACKUP_STATUS_FILE;
    if (!file) return { configured: false, lastSuccessAt: null, warning: null };
    const status = parseBackupStatus(await readFile(file, 'utf8').catch(() => null));
    return { configured: true, lastSuccessAt: status?.lastSuccessAt ?? null, warning: backupWarning(status, now) };
  }
}
