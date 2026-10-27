/**
 * Google Drive for backups, signed in from the Backups page with a device code: Vision runs
 * on plain http inside the bank's network, and Google redirects OAuth only to https or
 * localhost. Pure functions; BackupsService does the calls and the files.
 */

// drive.file: Vision sees only the files it created, not the rest of the person's Drive
export const DRIVE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'];
export const DEVICE_CODE_URL = 'https://oauth2.googleapis.com/device/code';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';
// the rclone remote scripts/vision-backup.sh looks for in backup-config/rclone.conf
export const RCLONE_REMOTE = 'vision-drive';
export const DEFAULT_FOLDER_NAME = 'vision-backups';

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: string;
  interval: number;
}

export interface DriveTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  email: string | null;
}

export type PollResult =
  { state: 'pending' } | { state: 'connected'; tokens: DriveTokens } | { state: 'failed'; error: string };

/** Everything kept in backup-config/drive.json; never sent to the browser. */
export interface DriveConnection extends DriveTokens {
  clientId: string;
  clientSecret: string;
  folderId: string;
  folderName: string;
}

export interface BackupSettings {
  // daily, in the server's time zone
  time: string;
  // database backups kept in Drive
  keep: number;
}

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = { time: '03:17', keep: 7 };

const googleError = (body: any, fallback: string): string =>
  [body?.error, body?.error_description].filter((part) => typeof part === 'string' && part).join(': ') || fallback;

export function readDeviceCode(status: number, body: any, now: Date): DeviceCode {
  if (status !== 200 || !body?.device_code || !body?.user_code) {
    throw new Error(`Google did not give a code: ${googleError(body, `HTTP ${status}`)}`);
  }
  return {
    deviceCode: body.device_code,
    userCode: body.user_code,
    verificationUrl: body.verification_url || body.verification_uri || 'https://www.google.com/device',
    expiresAt: new Date(now.getTime() + (Number(body.expires_in) || 1800) * 1000).toISOString(),
    interval: Math.max(1, Number(body.interval) || 5),
  };
}

/** Google signs the id_token, but it came straight from Google over TLS, so its payload is trusted. */
export function emailFromIdToken(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null;
  const payload = idToken.split('.')[1];
  if (!payload) return null;
  try {
    const email = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).email;
    return typeof email === 'string' ? email : null;
  } catch {
    return null;
  }
}

/** One poll of the token endpoint while the person enters the code. */
export function readTokenPoll(status: number, body: any, now: Date): PollResult {
  if (status === 200 && body?.access_token && body?.refresh_token) {
    return {
      state: 'connected',
      tokens: {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        accessTokenExpiresAt: new Date(now.getTime() + (Number(body.expires_in) || 3600) * 1000).toISOString(),
        email: emailFromIdToken(body.id_token),
      },
    };
  }
  if (body?.error === 'authorization_pending' || body?.error === 'slow_down') return { state: 'pending' };
  if (body?.error === 'access_denied') return { state: 'failed', error: 'Access was denied in Google.' };
  if (body?.error === 'expired_token') return { state: 'failed', error: 'The code expired. Start again.' };
  if (status === 200) return { state: 'failed', error: 'Google gave no refresh token. Start again.' };
  return { state: 'failed', error: googleError(body, `Google answered HTTP ${status}.`) };
}

/** rclone's own format; rclone refreshes the access token in this file itself. */
export function rcloneConf(connection: DriveConnection): string {
  const token = JSON.stringify({
    access_token: connection.accessToken,
    token_type: 'Bearer',
    refresh_token: connection.refreshToken,
    expiry: connection.accessTokenExpiresAt,
  });
  return [
    `[${RCLONE_REMOTE}]`,
    'type = drive',
    `client_id = ${connection.clientId}`,
    `client_secret = ${connection.clientSecret}`,
    'scope = drive.file',
    `root_folder_id = ${connection.folderId}`,
    `token = ${token}`,
    '',
  ].join('\n');
}

export function checkSettings(input: any): BackupSettings {
  const time = typeof input?.time === 'string' ? input.time.trim() : '';
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new Error('Time must be HH:MM, from 00:00 to 23:59.');
  }
  const keep = Number(input?.keep);
  if (!Number.isInteger(keep) || keep < 1 || keep > 365) {
    throw new Error('Keep between 1 and 365 database backups.');
  }
  return { time: `${match[1].padStart(2, '0')}:${match[2]}`, keep };
}

export function parseSettings(raw: string | null): BackupSettings {
  if (!raw) return { ...DEFAULT_BACKUP_SETTINGS };
  try {
    return checkSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_BACKUP_SETTINGS };
  }
}

export interface PublicDrive {
  connected: boolean;
  email: string | null;
  folderName: string | null;
}

/** The only view of the connection that leaves the server: no client secret, no tokens. */
export function publicDrive(connection: DriveConnection | null): PublicDrive {
  return connection
    ? { connected: true, email: connection.email, folderName: connection.folderName }
    : { connected: false, email: null, folderName: null };
}
