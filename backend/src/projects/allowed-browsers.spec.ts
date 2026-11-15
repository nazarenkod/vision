import { browserAllowed, invalidAllowedBrowser, parseAllowedBrowsers, snapshotRejection } from './allowed-browsers';

const check = { name: 'Checkout', customTags: '' };

describe('allowed browsers', () => {
  it('reads browser, version and window size entries from the project settings', () => {
    expect(
      parseAllowedBrowsers([
        { browser: ' Chrome ', version: '131.*', viewport: '1280 × 720' },
        { browser: 'chrome', version: '131.*', viewport: '1280x720' },
        { browser: '', version: '1' },
        'Firefox',
        { browser: 'Firefox' },
      ])
    ).toEqual([
      { browser: 'Chrome', version: '131.*', viewport: '1280x720' },
      { browser: 'Firefox', version: '', viewport: '' },
    ]);
    expect(parseAllowedBrowsers(null)).toEqual([]);
  });

  it('treats an empty version or window size as any', () => {
    const allowed = parseAllowedBrowsers([{ browser: 'Chrome' }, { browser: 'Firefox', version: '133.*' }]);

    expect(browserAllowed(allowed, 'chrome', '', '')).toBe(true);
    expect(browserAllowed(allowed, 'CHROME', '131.0.6778', '375x812')).toBe(true);
    expect(browserAllowed(allowed, 'firefox', '133.0.3', '1920x1080')).toBe(true);
    expect(browserAllowed(allowed, 'firefox', '134.0', '1920x1080')).toBe(false);
    expect(browserAllowed(allowed, 'webkit', '18', '')).toBe(false);
    // an empty list lets any browser in (REQ-050-51, as REQ-029-03)
    expect(
      snapshotRejection({ allowedDevices: [], allowedBrowsers: [] }, { ...check, browser: 'webkit' }, 'Web')
    ).toBeNull();
  });

  it('matches the window size whatever the separator', () => {
    const allowed = parseAllowedBrowsers([{ browser: 'Chrome', version: '', viewport: '1280×720' }]);
    expect(browserAllowed(allowed, 'chrome', '131', '1280x720')).toBe(true);
    expect(browserAllowed(allowed, 'chrome', '131', '1280x800')).toBe(false);
  });

  it('holds a snapshot with a browser to the browsers and one without to the devices', () => {
    const lists = {
      allowedDevices: [{ device: 'Pixel 7', os: 'Android 15' }],
      allowedBrowsers: parseAllowedBrowsers([{ browser: 'Chrome', version: '131.*', viewport: '1280x720' }]),
    };

    expect(snapshotRejection(lists, { ...check, device: 'Pixel 7', os: 'Android 15' }, 'Shop')).toBeNull();
    expect(snapshotRejection(lists, { ...check, device: 'Pixel 9', os: 'Android 15' }, 'Shop')).toMatch(
      /^Device not allowed in project "Shop"/
    );
    expect(
      snapshotRejection(lists, { ...check, browser: 'Chrome', browserVersion: '131.0.1', viewport: '1280x720' }, 'Shop')
    ).toBeNull();
    // the browser decides which list, whatever device the test also named
    expect(
      snapshotRejection(
        lists,
        {
          ...check,
          browser: 'Chrome',
          browserVersion: '132.0',
          viewport: '1280x720',
          device: 'Pixel 7',
          os: 'Android 15',
        },
        'Shop'
      )
    ).toBe(
      'Browser not allowed in project "Shop": check "Checkout" was sent from browser "Chrome", version "132.0", ' +
        'window "1280x720". Allowed: "Chrome" / "131.*" / "1280x720". Run in an allowed browser or add it in ' +
        'Project settings > Devices.'
    );
  });

  it('refuses a wildcard anywhere but at the end of the version', () => {
    expect(invalidAllowedBrowser({ browser: 'Chrome', version: '131.*', viewport: '1280x720' })).toBeNull();
    expect(invalidAllowedBrowser({ browser: 'Chrome' })).toBeNull();
    expect(invalidAllowedBrowser({ browser: '' })).toMatch(/needs a browser/);
    expect(invalidAllowedBrowser({ browser: 'Chrome*' })).toMatch(/only supported at the end/);
    expect(invalidAllowedBrowser({ browser: 'Chrome', version: '1*.0' })).toMatch(/only supported at the end/);
    expect(invalidAllowedBrowser({ browser: 'Chrome', version: '.*' })).toMatch(/only supported at the end/);
    expect(invalidAllowedBrowser({ browser: 'Chrome', viewport: 'wide' })).toMatch(/look like 1280x720/);
  });
});
