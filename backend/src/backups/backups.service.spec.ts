import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { BackupsService } from './backups.service';

const now = new Date('2026-10-27T12:00:00Z');
const idToken = (payload: object) => ['h', Buffer.from(JSON.stringify(payload)).toString('base64url'), 's'].join('.');
const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });

type Answer = { match: (url: string, init?: any) => boolean; reply: () => any };

describe('BackupsService with Google Drive', () => {
  let dir: string;
  let answers: Answer[];
  let calls: Array<{ url: string; init?: any }>;
  const saved = { ...process.env };
  const originalFetch = global.fetch;

  const answer = (match: Answer['match'], reply: Answer['reply']) => answers.push({ match, reply });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'backup-config-'));
    process.env.BACKUP_CONFIG_DIR = dir;
    delete process.env.BACKUP_FILES_OWNER;
    answers = [];
    calls = [];
    global.fetch = jest.fn(async (url: string, init?: any) => {
      calls.push({ url: String(url), init });
      const found = answers.find((item) => item.match(String(url), init));
      if (!found) throw new Error(`unexpected request ${url}`);
      return found.reply();
    }) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const name of ['BACKUP_CONFIG_DIR', 'BACKUP_FILES_OWNER', 'BACKUP_STATUS_FILE', 'BACKUP_REMOTE_CONFIGURED']) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  const signIn = async (
    service: BackupsService,
    tokenReply = () =>
      json(200, {
        access_token: 'at-1',
        refresh_token: 'rt-1',
        expires_in: 3600,
        id_token: idToken({ email: 'qa@privatbank.ua' }),
      })
  ) => {
    answer(
      (url) => url.includes('/device/code'),
      () =>
        json(200, {
          device_code: 'dc',
          user_code: 'ABC-DEF',
          verification_url: 'https://www.google.com/device',
          expires_in: 1800,
          interval: 5,
        })
    );
    answer((url) => url.includes('/token'), tokenReply);
    answer(
      (url, init) => url.includes('%27root%27+in+parents') && !init?.method,
      () => json(200, { files: [] })
    );
    answer(
      (url, init) => url.includes('/drive/v3/files?fields=id') && init?.method === 'POST',
      () => json(200, { id: 'folder-1' })
    );
    const code = await service.connect('cid.apps.googleusercontent.com', 'client-secret', now);
    return { code, result: await service.poll(now) };
  };

  it('connects Google Drive with a device code', async () => {
    const service = new BackupsService();
    const { code, result } = await signIn(service);

    expect(code).toEqual({
      userCode: 'ABC-DEF',
      verificationUrl: 'https://www.google.com/device',
      expiresAt: '2026-10-27T12:30:00.000Z',
      interval: 5,
    });
    expect(code).not.toHaveProperty('deviceCode');
    expect(result).toEqual({ state: 'connected', email: 'qa@privatbank.ua' });
    expect(String(calls[0].init.body)).toContain(
      'scope=openid+email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file'
    );

    const conf = readFileSync(join(dir, 'rclone.conf'), 'utf8');
    expect(conf).toContain('[vision-drive]');
    expect(conf).toContain('root_folder_id = folder-1');
    expect(statSync(join(dir, 'rclone.conf')).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, 'drive.json')).mode & 0o777).toBe(0o600);
  });

  it('waits while the code is not entered and reports a refusal', async () => {
    const service = new BackupsService();
    answer(
      (url) => url.includes('/device/code'),
      () => json(200, { device_code: 'dc', user_code: 'X', expires_in: 1800 })
    );
    let reply = json(428, { error: 'authorization_pending' });
    answer(
      (url) => url.includes('/token'),
      () => reply
    );
    await service.connect('cid', 'secret', now);

    expect(await service.poll(now)).toEqual({ state: 'pending' });
    reply = json(403, { error: 'access_denied' });
    expect(await service.poll(now)).toEqual({ state: 'failed', error: 'Access was denied in Google.' });
    expect(await service.poll(now)).toEqual({ state: 'failed', error: 'No sign-in is in progress. Start again.' });
    expect(existsSync(join(dir, 'drive.json'))).toBe(false);
  });

  it('never returns the client secret or tokens', async () => {
    const service = new BackupsService();
    await signIn(service);
    answer(
      (url) => url.includes('name+%3D+%27db%27'),
      () => json(200, { files: [] })
    );

    const shown = JSON.stringify(await service.overview(now));
    for (const secret of ['client-secret', 'rt-1', 'at-1', 'cid.apps']) {
      expect(shown).not.toContain(secret);
    }
    expect(shown).toContain('qa@privatbank.ua');
  });

  it('lists the backups in Drive with the status', async () => {
    const service = new BackupsService();
    await signIn(service);
    const status = join(dir, 'status.json');
    writeFileSync(
      status,
      JSON.stringify({ lastSuccessAt: '2026-10-27T03:17:00Z', pendingUploads: 0, runningSince: null })
    );
    process.env.BACKUP_STATUS_FILE = status;
    answer(
      (url) => url.includes('name+%3D+%27db%27'),
      () => json(200, { files: [{ id: 'db-1' }] })
    );
    answer(
      (url) => url.includes('%27db-1%27+in+parents'),
      () =>
        json(200, {
          files: [
            { name: 'vision-20261027T031700Z.tar', size: '1048576', modifiedTime: '2026-10-27T03:18:00Z' },
            { name: 'notes.txt', size: '1' },
          ],
        })
    );

    const overview = await service.overview(now);
    expect(overview.configured).toBe(true);
    expect(overview.warning).toBeNull();
    expect(overview.lastSuccessAt).toBe('2026-10-27T03:17:00Z');
    expect(overview.drive).toEqual({ connected: true, email: 'qa@privatbank.ua', folderName: 'vision-backups' });
    expect(overview.remote).toEqual({
      backups: [{ name: 'vision-20261027T031700Z.tar', size: 1048576, modifiedTime: '2026-10-27T03:18:00Z' }],
      error: null,
    });
  });

  it('tests the connection by finding the backup folder', async () => {
    const service = new BackupsService();
    expect(await service.test()).toEqual({ ok: false, error: 'Google Drive is not connected.' });
    await signIn(service);
    let reply = json(200, { id: 'folder-1', trashed: false });
    answer(
      (url) => url.includes('/files/folder-1'),
      () => reply
    );
    expect(await service.test()).toEqual({ ok: true, error: null });
    reply = json(404, { error: { message: 'File not found' } });
    expect((await service.test()).error).toContain('Reconnect Google Drive');
  });

  it('forgets the connection on disconnect', async () => {
    const service = new BackupsService();
    await signIn(service);
    answer(
      (url) => url.includes('/revoke'),
      () => json(200, {})
    );
    await service.disconnect();
    expect(existsSync(join(dir, 'drive.json'))).toBe(false);
    expect(existsSync(join(dir, 'rclone.conf'))).toBe(false);
    expect(calls.some((call) => call.url.includes('/revoke?token=rt-1'))).toBe(true);
    expect((await service.overview(now)).drive.connected).toBe(false);
  });

  it('requests a backup for the host script and keeps the settings', async () => {
    const service = new BackupsService();
    expect(await service.requestBackup(now)).toEqual({ backupRequestedAt: '2026-10-27T12:00:00.000Z' });
    expect(readFileSync(join(dir, 'backup-requested'), 'utf8').trim()).toBe('2026-10-27T12:00:00.000Z');
    expect(await service.saveSettings({ time: '2:30', keep: 10 })).toEqual({ time: '02:30', keep: 10 });
    expect(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'))).toEqual({ time: '02:30', keep: 10 });
    await expect(service.saveSettings({ time: '25:00', keep: 10 })).rejects.toThrow('Time must be HH:MM');
    const overview = await service.overview(now);
    expect(overview.settings).toEqual({ time: '02:30', keep: 10 });
    expect(overview.backupRequestedAt).toBe('2026-10-27T12:00:00.000Z');
  });
});
