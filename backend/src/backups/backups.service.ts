import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { chown, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { backupWarning, parseBackupStatus } from './backup-status';
import {
  BackupSettings,
  checkSettings,
  DEFAULT_FOLDER_NAME,
  DEVICE_CODE_URL,
  DRIVE_FILES_URL,
  DRIVE_SCOPES,
  DriveConnection,
  FOLDER_MIME,
  parseSettings,
  PublicDrive,
  publicDrive,
  rcloneConf,
  readDeviceCode,
  readTokenPoll,
  REVOKE_URL,
  TOKEN_URL,
} from './drive-auth';

export interface BackupStatusResponse {
  // false when this installation has no backups set up (the demo); then there is nothing to warn about
  configured: boolean;
  lastSuccessAt: string | null;
  warning: string | null;
}

export interface RemoteBackup {
  name: string;
  size: number | null;
  modifiedTime: string | null;
}

export interface BackupsOverview extends BackupStatusResponse {
  // false when the API cannot reach the folder shared with the host scripts
  available: boolean;
  lastAttemptAt: string | null;
  lastError: string | null;
  pendingUploads: number;
  runningSince: string | null;
  backupRequestedAt: string | null;
  drive: PublicDrive;
  settings: BackupSettings;
  remote: { backups: RemoteBackup[]; error: string | null } | null;
}

export type PollResponse =
  { state: 'pending' } | { state: 'connected'; email: string | null } | { state: 'failed'; error: string };

interface PendingSignIn {
  clientId: string;
  clientSecret: string;
  deviceCode: string;
  expiresAt: string;
}

const FILES = {
  drive: 'drive.json',
  rclone: 'rclone.conf',
  settings: 'settings.json',
  request: 'backup-requested',
};

/**
 * Backups are made by scripts/vision-backup.sh on the host (ADR-0013); this service writes what
 * it reads (Drive connection, settings, a request) into BACKUP_CONFIG_DIR and reads its status.
 */
@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);
  private pending: PendingSignIn | null = null;
  private accessToken: { value: string; expiresAt: number } | null = null;

  private get configDir(): string | null {
    return process.env.BACKUP_CONFIG_DIR || null;
  }

  private requireConfigDir(): string {
    const dir = this.configDir;
    if (!dir) throw new BadRequestException('Backups cannot be set up here: BACKUP_CONFIG_DIR is not set.');
    return dir;
  }

  private async read(name: string): Promise<string | null> {
    const dir = this.configDir;
    return dir ? readFile(join(dir, name), 'utf8').catch(() => null) : null;
  }

  // The host script runs as a user of the host, not as root like this container.
  private async write(name: string, content: string, secret = false): Promise<void> {
    const dir = this.requireConfigDir();
    await mkdir(dir, { recursive: true });
    const path = join(dir, name);
    await writeFile(path, content, { mode: secret ? 0o600 : 0o644 });
    const owner = /^(\d+):(\d+)$/.exec(process.env.BACKUP_FILES_OWNER ?? '');
    if (owner) {
      await chown(path, Number(owner[1]), Number(owner[2])).catch((error) =>
        this.logger.warn(`Could not give ${path} to ${owner[0]}: ${error.message}`)
      );
    }
  }

  private async connection(): Promise<DriveConnection | null> {
    const raw = await this.read(FILES.drive);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async status(now = new Date()): Promise<BackupStatusResponse> {
    const connected = !!(await this.connection());
    const configured = connected || process.env.BACKUP_REMOTE_CONFIGURED === 'true';
    if (!configured) return { configured: false, lastSuccessAt: null, warning: null };
    const status = parseBackupStatus(await this.readStatus());
    return { configured: true, lastSuccessAt: status?.lastSuccessAt ?? null, warning: backupWarning(status, now) };
  }

  private async readStatus(): Promise<string | null> {
    const file = process.env.BACKUP_STATUS_FILE;
    return file ? readFile(file, 'utf8').catch(() => null) : null;
  }

  async overview(now = new Date()): Promise<BackupsOverview> {
    const [summary, connection, rawStatus, settings, request] = await Promise.all([
      this.status(now),
      this.connection(),
      this.readStatus(),
      this.read(FILES.settings),
      this.read(FILES.request),
    ]);
    const status = parseBackupStatus(rawStatus);
    return {
      ...summary,
      available: !!this.configDir,
      lastAttemptAt: status?.lastAttemptAt ?? null,
      lastError: status?.lastError ?? null,
      pendingUploads: status?.pendingUploads ?? 0,
      runningSince: status?.runningSince ?? null,
      backupRequestedAt: request?.trim() || null,
      drive: publicDrive(connection),
      settings: parseSettings(settings),
      remote: connection ? await this.listRemote(connection) : null,
    };
  }

  // ---- connecting Google Drive with a device code -------------------------------------

  async connect(clientId: string, clientSecret: string, now = new Date()) {
    this.requireConfigDir();
    if (!clientId?.trim() || !clientSecret?.trim()) {
      throw new BadRequestException('Enter the Client ID and the Client secret of the OAuth client.');
    }
    const response = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      body: new URLSearchParams({ client_id: clientId.trim(), scope: DRIVE_SCOPES.join(' ') }),
    });
    let code;
    try {
      code = readDeviceCode(response.status, await response.json().catch(() => null), now);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
    this.pending = {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      deviceCode: code.deviceCode,
      expiresAt: code.expiresAt,
    };
    // the device code itself stays here; the person needs only the user code
    return {
      userCode: code.userCode,
      verificationUrl: code.verificationUrl,
      expiresAt: code.expiresAt,
      interval: code.interval,
    };
  }

  async poll(now = new Date()): Promise<PollResponse> {
    const pending = this.pending;
    if (!pending) return { state: 'failed', error: 'No sign-in is in progress. Start again.' };
    if (Date.parse(pending.expiresAt) <= now.getTime()) {
      this.pending = null;
      return { state: 'failed', error: 'The code expired. Start again.' };
    }
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: pending.clientId,
        client_secret: pending.clientSecret,
        device_code: pending.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const result = readTokenPoll(response.status, await response.json().catch(() => null), now);
    if (result.state === 'pending') return result;
    this.pending = null;
    if (result.state === 'failed') return result;

    const folderName = DEFAULT_FOLDER_NAME;
    let folderId: string;
    try {
      folderId = await this.ensureFolder(result.tokens.accessToken, folderName);
    } catch (error) {
      return { state: 'failed', error: `Signed in, but the backup folder could not be made: ${error.message}` };
    }
    const connection: DriveConnection = {
      ...result.tokens,
      clientId: pending.clientId,
      clientSecret: pending.clientSecret,
      folderId,
      folderName,
    };
    await this.write(FILES.drive, JSON.stringify(connection, null, 2), true);
    await this.write(FILES.rclone, rcloneConf(connection), true);
    this.accessToken = { value: connection.accessToken, expiresAt: Date.parse(connection.accessTokenExpiresAt) };
    return { state: 'connected', email: connection.email };
  }

  async disconnect(): Promise<void> {
    const dir = this.requireConfigDir();
    const connection = await this.connection();
    this.pending = null;
    this.accessToken = null;
    if (connection) {
      // revoking is a courtesy; forgetting the token here is what matters
      await fetch(`${REVOKE_URL}?token=${encodeURIComponent(connection.refreshToken)}`, { method: 'POST' }).catch(
        () => null
      );
    }
    await rm(join(dir, FILES.drive), { force: true });
    await rm(join(dir, FILES.rclone), { force: true });
  }

  async test(): Promise<{ ok: boolean; error: string | null }> {
    const connection = await this.connection();
    if (!connection) return { ok: false, error: 'Google Drive is not connected.' };
    try {
      const token = await this.token(connection);
      const response = await fetch(`${DRIVE_FILES_URL}/${connection.folderId}?fields=id,trashed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.trashed) {
        return {
          ok: false,
          error: `The backup folder is not reachable (HTTP ${response.status}). Reconnect Google Drive.`,
        };
      }
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  // ---- settings and requests for the host script ------------------------------------

  async saveSettings(input: unknown): Promise<BackupSettings> {
    let settings: BackupSettings;
    try {
      settings = checkSettings(input);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
    await this.write(FILES.settings, JSON.stringify(settings) + '\n');
    return settings;
  }

  async requestBackup(now = new Date()): Promise<{ backupRequestedAt: string }> {
    const at = now.toISOString();
    await this.write(FILES.request, at + '\n');
    return { backupRequestedAt: at };
  }

  // ---- Google Drive calls -------------------------------------------------------------

  private async token(connection: DriveConnection): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt - 60_000 > Date.now()) return this.accessToken.value;
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: connection.clientId,
        client_secret: connection.clientSecret,
        refresh_token: connection.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.access_token) {
      throw new Error(`Google refused the saved sign-in (${body?.error ?? response.status}). Reconnect Google Drive.`);
    }
    this.accessToken = { value: body.access_token, expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000 };
    return body.access_token;
  }

  private async findFiles(token: string, query: string, fields: string, orderBy?: string): Promise<any[]> {
    const params = new URLSearchParams({ q: query, fields: `files(${fields})`, pageSize: '100', spaces: 'drive' });
    if (orderBy) params.set('orderBy', orderBy);
    const response = await fetch(`${DRIVE_FILES_URL}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(`Google Drive answered HTTP ${response.status}: ${body?.error?.message ?? ''}`.trim());
    return body?.files ?? [];
  }

  // drive.file lets Vision see only folders it made, so an older one of the same name is reused
  private async ensureFolder(token: string, name: string): Promise<string> {
    const found = await this.findFiles(
      token,
      `name = '${name}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`,
      'id'
    );
    if (found[0]?.id) return found[0].id;
    const response = await fetch(`${DRIVE_FILES_URL}?fields=id`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.id) throw new Error(`Google Drive answered HTTP ${response.status}`);
    return body.id;
  }

  private async listRemote(connection: DriveConnection): Promise<{ backups: RemoteBackup[]; error: string | null }> {
    try {
      const token = await this.token(connection);
      const db = await this.findFiles(
        token,
        `name = 'db' and mimeType = '${FOLDER_MIME}' and '${connection.folderId}' in parents and trashed = false`,
        'id'
      );
      if (!db[0]?.id) return { backups: [], error: null };
      const files = await this.findFiles(
        token,
        `'${db[0].id}' in parents and trashed = false`,
        'name,size,modifiedTime',
        'name desc'
      );
      return {
        backups: files
          .filter((file) => /^vision-[0-9TZ]+\.tar$/.test(file.name))
          .map((file) => ({
            name: file.name,
            size: file.size ? Number(file.size) : null,
            modifiedTime: file.modifiedTime ?? null,
          })),
        error: null,
      };
    } catch (error) {
      return { backups: [], error: error.message };
    }
  }
}
