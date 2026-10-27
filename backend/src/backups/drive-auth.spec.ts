import {
  checkSettings,
  DRIVE_SCOPES,
  emailFromIdToken,
  parseSettings,
  publicDrive,
  rcloneConf,
  readDeviceCode,
  readTokenPoll,
} from './drive-auth';

const now = new Date('2026-10-27T12:00:00Z');
const idToken = (payload: object) =>
  ['header', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'signature'].join('.');

describe('drive-auth', () => {
  it('asks Google only for the files Vision creates', () => {
    expect(DRIVE_SCOPES).toContain('https://www.googleapis.com/auth/drive.file');
    expect(DRIVE_SCOPES.filter((scope) => scope.includes('/auth/drive'))).toEqual([
      'https://www.googleapis.com/auth/drive.file',
    ]);
  });

  it('reads the device flow answers', () => {
    expect(
      readDeviceCode(
        200,
        {
          device_code: 'dc',
          user_code: 'ABC-DEF',
          verification_url: 'https://www.google.com/device',
          expires_in: 1800,
          interval: 5,
        },
        now
      )
    ).toEqual({
      deviceCode: 'dc',
      userCode: 'ABC-DEF',
      verificationUrl: 'https://www.google.com/device',
      expiresAt: '2026-10-27T12:30:00.000Z',
      interval: 5,
    });
    expect(() =>
      readDeviceCode(401, { error: 'invalid_client', error_description: 'The OAuth client was not found.' }, now)
    ).toThrow('Google did not give a code: invalid_client: The OAuth client was not found.');

    expect(readTokenPoll(428, { error: 'authorization_pending' }, now)).toEqual({ state: 'pending' });
    expect(readTokenPoll(403, { error: 'slow_down' }, now)).toEqual({ state: 'pending' });
    expect(readTokenPoll(403, { error: 'access_denied' }, now)).toEqual({
      state: 'failed',
      error: 'Access was denied in Google.',
    });
    expect(readTokenPoll(400, { error: 'expired_token' }, now)).toEqual({
      state: 'failed',
      error: 'The code expired. Start again.',
    });
    expect(
      readTokenPoll(
        200,
        { access_token: 'at', refresh_token: 'rt', expires_in: 3599, id_token: idToken({ email: 'qa@privatbank.ua' }) },
        now
      )
    ).toEqual({
      state: 'connected',
      tokens: {
        accessToken: 'at',
        refreshToken: 'rt',
        accessTokenExpiresAt: '2026-10-27T12:59:59.000Z',
        email: 'qa@privatbank.ua',
      },
    });
  });

  it('takes the email from the id token and nothing else', () => {
    expect(emailFromIdToken(idToken({ email: 'qa@privatbank.ua' }))).toBe('qa@privatbank.ua');
    expect(emailFromIdToken('not-a-token')).toBeNull();
    expect(emailFromIdToken(undefined)).toBeNull();
  });

  it('writes the rclone remote for the backup folder', () => {
    const conf = rcloneConf({
      clientId: 'cid',
      clientSecret: 'secret',
      accessToken: 'at',
      refreshToken: 'rt',
      accessTokenExpiresAt: '2026-10-27T13:00:00.000Z',
      email: 'qa@privatbank.ua',
      folderId: 'folder-1',
      folderName: 'vision-backups',
    });
    expect(conf).toContain('[vision-drive]\ntype = drive\n');
    expect(conf).toContain('scope = drive.file\n');
    expect(conf).toContain('root_folder_id = folder-1\n');
    expect(conf).toContain('"refresh_token":"rt"');
  });

  it('accepts a daily time and a number of copies', () => {
    expect(checkSettings({ time: '3:05', keep: 14 })).toEqual({ time: '03:05', keep: 14 });
    expect(() => checkSettings({ time: '24:00', keep: 7 })).toThrow('Time must be HH:MM');
    expect(() => checkSettings({ time: '03:17', keep: 0 })).toThrow('Keep between 1 and 365');
    expect(parseSettings(null)).toEqual({ time: '03:17', keep: 7 });
    expect(parseSettings('{"time": "nonsense"}')).toEqual({ time: '03:17', keep: 7 });
  });

  it('shows the connection without secrets', () => {
    expect(publicDrive(null)).toEqual({ connected: false, email: null, folderName: null });
    const shown = publicDrive({
      clientId: 'cid',
      clientSecret: 'secret',
      accessToken: 'at',
      refreshToken: 'rt',
      accessTokenExpiresAt: '',
      email: 'qa@privatbank.ua',
      folderId: 'f',
      folderName: 'vision-backups',
    });
    expect(shown).toEqual({ connected: true, email: 'qa@privatbank.ua', folderName: 'vision-backups' });
  });
});
