import { deviceAllowed, deviceRejection, invalidAllowedDevice, parseAllowedDevices } from './allowed-devices';
import { parseUiTreeSettings } from '../ui-tree/comparison-inputs';

const allowed = [
  { device: 'Pixel 7', os: 'Android 15' },
  { device: 'iPhone 17', os: '26.*' },
];

const snapshot = (device?: string, os?: string) => ({ name: 'Payment', device, os });

describe('allowed devices', () => {
  it('reads the allowed devices from the project settings', () => {
    const settings = parseUiTreeSettings(
      JSON.stringify({
        allowedDevices: [
          { device: ' Pixel 7 ', os: 'Android 15' },
          { device: 'pixel 7', os: 'android 15' },
          { device: 'Galaxy S23' },
          'iPhone 17',
          { device: 'iPhone 17', os: '26.*' },
        ],
      })
    );
    expect(settings.allowedDevices).toEqual(allowed);
    expect(parseUiTreeSettings(null).allowedDevices).toEqual([]);
    expect(parseAllowedDevices({ device: 'Pixel 7' })).toEqual([]);
  });

  it('allows any device when the list is empty', () => {
    expect(deviceRejection([], snapshot('Pixel 6', 'Android 13'), 'AOS')).toBeNull();
    expect(deviceRejection([], snapshot(), 'AOS')).toBeNull();
  });

  it('allows a device and OS that match an entry', () => {
    expect(deviceRejection(allowed, snapshot('Pixel 7', 'Android 15'), 'AOS')).toBeNull();
  });

  it('rejects a device or OS that matches no entry', () => {
    expect(deviceRejection(allowed, snapshot('Pixel 6', 'Android 15'), 'AOS')).not.toBeNull();
    expect(deviceRejection(allowed, snapshot('Pixel 7', 'Android 14'), 'AOS')).not.toBeNull();
    // a pair from two different entries is not allowed
    expect(deviceRejection(allowed, snapshot('Pixel 7', '26.1'), 'AOS')).not.toBeNull();
  });

  it('rejects a snapshot without a device or OS', () => {
    expect(deviceRejection(allowed, snapshot(undefined, 'Android 15'), 'AOS')).toContain('without a device');
    expect(deviceRejection(allowed, snapshot('Pixel 7', ' '), 'AOS')).toContain('without an OS');
    expect(deviceRejection(allowed, snapshot(), 'AOS')).toContain('without a device and OS');
  });

  it('names the check, what was sent, the allowed list and the project', () => {
    expect(deviceRejection(allowed, snapshot('Pixel 6', 'Android 13'), 'AOS')).toBe(
      'Device not allowed in project "AOS": check "Payment" was sent from device "Pixel 6", OS "Android 13". ' +
        'Allowed: "Pixel 7" / "Android 15", "iPhone 17" / "26.*". ' +
        'Run on an allowed device or add it in Project settings > Devices.'
    );
    expect(deviceRejection(allowed, { ...snapshot('Pixel 6', 'Android 13'), customTags: 'dark' }, 'AOS')).toContain(
      'check "Payment [dark]"'
    );
  });

  it('ignores case and surrounding spaces', () => {
    expect(deviceAllowed(allowed, ' pixel 7 ', 'ANDROID 15 ')).toBe(true);
    expect(deviceAllowed([{ device: ' PIXEL 7', os: 'android 15 ' }], 'Pixel 7', 'Android 15')).toBe(true);
  });

  it('matches the OS exactly unless the entry ends in .*', () => {
    expect(deviceAllowed(allowed, 'Pixel 7', 'Android 15.1')).toBe(false);
    expect(deviceAllowed(allowed, 'Pixel 7', 'Android 1')).toBe(false);
    expect(deviceAllowed([{ device: 'iPhone 17', os: '26.1' }], 'iPhone 17', '26.1')).toBe(true);
    expect(deviceAllowed([{ device: 'iPhone 17', os: '26.1' }], 'iPhone 17', '26.2')).toBe(false);
  });

  it('takes 26.* for 26, 26.1 and 26.2.1 but not 260 or 27.0', () => {
    for (const os of ['26', '26.1', '26.2', '26.2.1']) expect(deviceAllowed(allowed, 'iPhone 17', os)).toBe(true);
    for (const os of ['260', '27.0', '2', '']) expect(deviceAllowed(allowed, 'iPhone 17', os)).toBe(false);
  });

  it('refuses a * anywhere but a trailing .* of the OS', () => {
    expect(invalidAllowedDevice({ device: 'Pixel 7', os: 'Android 15' })).toBeNull();
    expect(invalidAllowedDevice({ device: 'iPhone 17', os: '26.*' })).toBeNull();
    for (const entry of [
      { device: 'Pixel *', os: 'Android 15' },
      { device: 'iPhone 17', os: '*' },
      { device: 'iPhone 17', os: '.*' },
      { device: 'iPhone 17', os: '26*' },
      { device: 'iPhone 17', os: '2*.1' },
      { device: 'iPhone 17', os: '26.*.*' },
    ]) {
      expect(invalidAllowedDevice(entry)).toContain('only supported at the end of the OS version');
    }
    expect(invalidAllowedDevice({ device: 'Pixel 7', os: ' ' })).toContain('needs both');
  });
});
