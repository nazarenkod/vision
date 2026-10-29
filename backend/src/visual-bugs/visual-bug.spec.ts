import { bugDescription, bugSummary, environmentText, featureOf, normalizeMarks } from './visual-bug';

const description = (extra: Partial<Parameters<typeof bugDescription>[0]> = {}) =>
  bugDescription({
    environment: 'AOS 14 · PIXEL_4_XL, build #128 (release/7.4). UI-проблеми відтворюються на всіх девайсах.',
    steps: '1. Додати товар у кошик\n2. Відкрити Checkout → Payment sheet',
    actual: 'Кнопка «Pay» обрізана знизу.',
    expected: 'Кнопка «Pay» повністю видна.',
    hasBaseline: true,
    check: { name: 'Checkout. Payment sheet', customTags: '' },
    build: { number: 128 },
    url: 'https://vision/test/123',
    ...extra,
  });

describe('featureOf', () => {
  it('takes the feature the test sent', () => {
    expect(featureOf({ featureName: ' Оплата ', name: 'Checkout. Payment sheet' })).toBe('Оплата');
  });

  it('takes the feature from the check name before the first dot when none is sent', () => {
    expect(featureOf({ featureName: null, name: 'Checkout. Payment sheet' })).toBe('Checkout');
    expect(featureOf({ featureName: '  ', name: 'Login' })).toBe('Login');
  });
});

describe('bugSummary', () => {
  it('starts with Automation and the feature', () => {
    expect(bugSummary('Checkout', ' кнопка «Pay»  обрізана ')).toBe('[Automation] [Checkout] кнопка «Pay» обрізана');
  });

  it('keeps the Automation prefix whole in a long summary', () => {
    const summary = bugSummary('Checkout', 'дуже '.repeat(80));
    expect(summary.length).toBeLessThanOrEqual(250);
    expect(summary.startsWith('[Automation] [Checkout] дуже')).toBe(true);
  });

  it('shortens a long feature and keeps its brackets from closing the tag', () => {
    const summary = bugSummary(`[New] ${'Ф'.repeat(100)}`, 'суть');
    expect(summary).toMatch(/^\[Automation\] \[\(New\) Ф+\] суть$/);
    expect(summary.indexOf('] суть')).toBeLessThanOrEqual('[Automation] ['.length + 60);
  });
});

describe('environmentText', () => {
  it('writes OS, device, build and branch and notes every device', () => {
    expect(
      environmentText(
        { os: 'AOS 14', device: 'PIXEL_4_XL', branchName: 'release/7.4' },
        { number: 128, branchName: 'x' }
      )
    ).toBe('AOS 14 · PIXEL_4_XL, build #128 (release/7.4). UI-проблеми відтворюються на всіх девайсах.');
  });

  it('falls back to the browser and viewport and leaves out what it does not know', () => {
    expect(environmentText({ browser: 'chromium', viewport: '1800x1600' }, null)).toBe(
      'chromium · 1800x1600. UI-проблеми відтворюються на всіх девайсах.'
    );
  });
});

describe('bugDescription', () => {
  it('orders the sections: environment, steps, actual, expected, then the service lines', () => {
    const text = description();
    const at = (part: string) => text.indexOf(part);
    expect(at('h3. Оточення')).toBe(0);
    expect(at('h3. Оточення')).toBeLessThan(at('h3. Кроки'));
    expect(at('h3. Кроки')).toBeLessThan(at('h3. Фактичний результат'));
    expect(at('h3. Фактичний результат')).toBeLessThan(at('h3. Очікуваний результат'));
    expect(at('h3. Очікуваний результат')).toBeLessThan(at('----'));
  });

  it('puts the checkpoint into the actual result and the baseline into the expected one', () => {
    const text = description();
    const actual = text.slice(text.indexOf('h3. Фактичний'), text.indexOf('h3. Очікуваний'));
    const expected = text.slice(text.indexOf('h3. Очікуваний'), text.indexOf('----'));
    expect(actual).toContain('!checkpoint.png|thumbnail!');
    expect(expected).toContain('!baseline.png|thumbnail!');
    expect(description({ hasBaseline: false })).not.toContain('baseline.png');
  });

  it('ends with the check, the build and a link back to the review', () => {
    const tail = description({ check: { name: 'Checkout. Payment sheet', customTags: 'dark' } }).split('----')[1];
    expect(tail).toContain('Перевірка: Checkout. Payment sheet (dark) · збірка #128');
    expect(tail).toContain('[Відкрити у Vision|https://vision/test/123]');
  });
});

describe('normalizeMarks', () => {
  it('numbers marks in order, rounds them and drops empty ones', () => {
    expect(
      normalizeMarks([
        { x: 1.4, y: 2.6, width: 10, height: 0 },
        { x: 1.4, y: 2.6, width: 10.2, height: 20, element: 'id:pay' },
        { x: 0, y: 0, width: 5, height: 5 },
      ])
    ).toEqual([
      { n: 1, x: 1, y: 3, width: 10, height: 20, element: 'id:pay' },
      { n: 2, x: 0, y: 0, width: 5, height: 5 },
    ]);
  });
});
