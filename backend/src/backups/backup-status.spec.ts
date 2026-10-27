import { backupWarning, parseBackupStatus } from './backup-status';
import { BackupsService } from './backups.service';
import { mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const now = new Date('2026-10-27T12:00:00Z');
const status = (lastSuccessAt: string | null, lastError: string | null = null) => ({
  lastAttemptAt: '2026-10-27T03:17:00Z',
  lastSuccessAt,
  lastError,
  pendingUploads: 0,
  runningSince: null,
});

describe('backupWarning', () => {
  it('stays quiet while the last backup is at most 26 hours old', () => {
    expect(backupWarning(status('2026-10-27T03:17:00Z'), now)).toBeNull();
    expect(backupWarning(status('2026-10-26T10:00:00Z'), now)).toBeNull();
  });

  it('warns when the last successful backup is older than 26 hours', () => {
    expect(backupWarning(status('2026-10-26T03:17:00Z', 'could not upload the images'), now)).toBe(
      'The last backup is 32 hours old. Last attempt: could not upload the images.'
    );
  });

  it('warns when there has never been a successful backup', () => {
    expect(backupWarning(status(null), now)).toBe('Vision has not been backed up yet.');
    expect(backupWarning(null, now)).toBe('Vision has not been backed up yet.');
  });

  it('reads the status file and ignores what it does not understand', () => {
    expect(parseBackupStatus('{"lastSuccessAt": "2026-10-27T03:17:00Z", "pendingUploads": 2}')).toEqual({
      lastAttemptAt: null,
      lastSuccessAt: '2026-10-27T03:17:00Z',
      lastError: null,
      pendingUploads: 2,
      runningSince: null,
    });
    expect(parseBackupStatus('not json')).toBeNull();
    expect(parseBackupStatus('')).toBeNull();
  });
});

describe('BackupsService', () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const name of ['BACKUP_STATUS_FILE', 'BACKUP_REMOTE_CONFIGURED', 'BACKUP_CONFIG_DIR']) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  it('stays quiet when backups are not configured', async () => {
    delete process.env.BACKUP_REMOTE_CONFIGURED;
    delete process.env.BACKUP_CONFIG_DIR;
    expect(await new BackupsService().status(now)).toEqual({ configured: false, lastSuccessAt: null, warning: null });
  });

  it('warns when backups are configured but no status was written yet', async () => {
    process.env.BACKUP_REMOTE_CONFIGURED = 'true';
    process.env.BACKUP_STATUS_FILE = join(mkdtempSync(join(tmpdir(), 'backup-status-')), 'status.json');
    expect((await new BackupsService().status(now)).warning).toBe('Vision has not been backed up yet.');
  });

  it('reports the last successful backup from the status file', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'backup-status-')), 'status.json');
    writeFileSync(file, JSON.stringify(status('2026-10-27T03:17:00Z')));
    process.env.BACKUP_STATUS_FILE = file;
    process.env.BACKUP_REMOTE_CONFIGURED = 'true';
    expect(await new BackupsService().status(now)).toEqual({
      configured: true,
      lastSuccessAt: '2026-10-27T03:17:00Z',
      warning: null,
    });
  });
});
