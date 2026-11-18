import { onlyNumbersDiffer } from './number-change';
import { diffTrees } from './structure-diff';
import { findNoiseHints } from './noise-hints';
import { parseUiTree } from './ui-tree.parser';

const parse = (source: string) => parseUiTree(source, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });

// The home screen of the review on 2026-11-18: badges and rates without ids, inside a header with one
const screen = (
  bell: string,
  chat: string,
  euro: string,
  extra = ''
) => `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy index="0" class="hierarchy" rotation="0" width="1080" height="2400">
  <android.widget.FrameLayout index="0" class="android.widget.FrameLayout" text="" resource-id="" clickable="false" enabled="true" bounds="[0,0][1080,2400]" displayed="true">
    <android.view.ViewGroup index="0" class="android.view.ViewGroup" text="" resource-id="com.bank.app:id/header" clickable="false" enabled="true" bounds="[0,63][1080,300]" displayed="true">
      <android.view.View index="0" class="android.view.View" text="" content-desc="${bell}" resource-id="" clickable="true" enabled="true" bounds="[800,100][900,200]" displayed="true" />
      <android.view.View index="1" class="android.view.View" text="" content-desc="${chat}" resource-id="" clickable="true" enabled="true" bounds="[920,100][1020,200]" displayed="true" />
      ${extra}
    </android.view.ViewGroup>
    <android.view.ViewGroup index="1" class="android.view.ViewGroup" text="" resource-id="com.bank.app:id/rates" clickable="false" enabled="true" bounds="[0,2000][1080,2200]" displayed="true">
      <android.widget.TextView index="0" class="android.widget.TextView" text="${euro}" resource-id="" clickable="false" enabled="true" bounds="[40,2020][1040,2080]" displayed="true" />
    </android.view.ViewGroup>
  </android.widget.FrameLayout>
</hierarchy>`;

const baseline = parse(
  screen(
    'Сповіщення.Ви маєте 99 непрочитаних повідомлень',
    'Комунікації.Ви маєте 99 непрочитаних повідомлень',
    'Курс євро. Продаж 49 Гривень 77 копійок, . Купівля 50 Гривень 76 копійок, .'
  )
);
const current = parse(
  screen(
    'Сповіщення.Ви маєте 49 непрочитаних повідомлень',
    'Комунікації.Ви маєте 80 непрочитаних повідомлень',
    'Курс євро. Продаж 49 Гривень 73 копійки, . Купівля 50 Гривень 76 копійок, .'
  )
);

describe('onlyNumbersDiffer', () => {
  it('tells numbers changing inside a sentence, with the word after them in another form', () => {
    expect(onlyNumbersDiffer('Ви маєте 99 непрочитаних повідомлень', 'Ви маєте 49 непрочитаних повідомлень')).toBe(
      true
    );
    expect(onlyNumbersDiffer('Продаж 49 Гривень 77 копійок', 'Продаж 49 Гривень 73 копійки')).toBe(true);
    expect(onlyNumbersDiffer('Баланс 1 250,00 UAH', 'Баланс 999,10 UAH')).toBe(true);
  });

  it('counts a counter with a ceiling as a number', () => {
    expect(onlyNumbersDiffer('Ви маєте 99+ повідомлень', 'Ви маєте 49 повідомлень')).toBe(true);
  });

  it('is not a number change when words change, or the same text stays', () => {
    expect(onlyNumbersDiffer('Купуй квитки', 'Закинь на телефон')).toBe(false);
    expect(onlyNumbersDiffer('Ви маєте 49 повідомлень', 'Ви маєте 49 повідомлень')).toBe(false);
    expect(onlyNumbersDiffer('Updated at 14:07', 'Updated at undefined')).toBe(false);
    // the second word is not right after the number
    expect(onlyNumbersDiffer('Ви маєте 1 непрочитане повідомлення', 'Ви маєте 5 непрочитаних повідомлень')).toBe(false);
    // a word after an unchanged number keeps its form
    expect(onlyNumbersDiffer('49 Гривень 77 копійок', '49 Гривні 73 копійки')).toBe(false);
  });
});

describe('diffTrees for numbers that changed', () => {
  it('shows an element without an id whose number changed as one text change, not appeared and gone', () => {
    const changes = diffTrees(baseline, current);

    expect(changes.map((change) => change.kind)).toEqual(['label', 'label', 'text']);
    expect(changes[0]).toMatchObject({
      before: 'Сповіщення.Ви маєте 99 непрочитаних повідомлень',
      after: 'Сповіщення.Ви маєте 49 непрочитаних повідомлень',
    });
    expect(changes[2]).toMatchObject({
      before: expect.stringContaining('77 копійок'),
      after: expect.stringContaining('73 копійки'),
    });
  });

  it("keeps the element's own key on a paired change", () => {
    const [bell] = diffTrees(baseline, current);
    const node = current.nodes.find((item) => item.label.startsWith('Сповіщення'));

    expect(bell.key).toBe(node?.key);
    expect(bell.key).toBe('View:Сповіщення.Ви маєте 49 непрочитаних повідомлень');
  });

  it('leaves appeared and gone when the words changed, not the numbers', () => {
    const words = parse(
      screen(
        'Купуй квитки',
        'Комунікації.Ви маєте 99 непрочитаних повідомлень',
        'Курс євро. Продаж 49 Гривень 77 копійок, .'
      )
    );
    const other = parse(
      screen(
        'Закинь на телефон',
        'Комунікації.Ви маєте 99 непрочитаних повідомлень',
        'Курс євро. Продаж 49 Гривень 77 копійок, .'
      )
    );

    expect(diffTrees(words, other).map((change) => change.kind)).toEqual(['added', 'removed']);
  });

  it('pairs the one look-alike when the element around has no twin on the baseline', () => {
    const renamed = (tree: string) => tree.replace('com.bank.app:id/header', 'com.bank.app:id/header_new');
    const changes = diffTrees(
      baseline,
      parse(
        renamed(
          screen(
            'Сповіщення.Ви маєте 49 непрочитаних повідомлень',
            'Комунікації.Ви маєте 99 непрочитаних повідомлень',
            'Курс євро. Продаж 49 Гривень 77 копійок, . Купівля 50 Гривень 76 копійок, .'
          )
        )
      )
    );

    expect(changes.filter((change) => change.key.startsWith('View:Сповіщення')).map((change) => change.kind)).toEqual([
      'label',
    ]);
  });

  it('pairs nothing when two look-alikes on the baseline could be either', () => {
    const rates = (id: string, ...texts: string[]) => `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy index="0" class="hierarchy" rotation="0" width="1080" height="2400">
  <android.view.ViewGroup index="0" class="android.view.ViewGroup" text="" resource-id="com.bank.app:id/${id}" clickable="false" enabled="true" bounds="[0,2000][1080,2400]" displayed="true">
    ${texts
      .map(
        (text, i) =>
          `<android.widget.TextView index="${i}" class="android.widget.TextView" text="${text}" resource-id="" clickable="false" enabled="true" bounds="[40,${2020 + i * 80}][1040,${2080 + i * 80}]" displayed="true" />`
      )
      .join('')}
  </android.view.ViewGroup>
</hierarchy>`;
    const changes = diffTrees(
      parse(rates('rates', 'Продаж 49 Гривень 77 копійок', 'Продаж 49 Гривень 78 копійок')),
      parse(rates('rates_new', 'Продаж 49 Гривень 73 копійки'))
    );

    const rows = changes.filter((change) => change.key.startsWith('TextView:'));
    expect(rows.map((change) => change.kind).sort()).toEqual(['added', 'removed', 'removed']);
  });

  it('names the element of the current tree on each change of it', () => {
    const [bell] = diffTrees(baseline, current);

    expect(bell.index).toBe(current.nodes.find((node) => node.key === bell.key)?.index);
  });
});

describe('findNoiseHints for numbers that changed', () => {
  const regions = [
    { x: 820, y: 120, width: 40, height: 40 },
    { x: 400, y: 2030, width: 80, height: 40 },
  ];
  const hint = (changes = diffTrees(baseline, current), areas = regions) =>
    findNoiseHints({ regions: areas, diffPercent: 0.2, imageWidth: 1080, imageHeight: 2400, tree: current, changes });

  it('says only numbers changed, naming each element with its texts before and after', () => {
    const [numbers, ...rest] = hint();

    expect(rest).toEqual([]);
    expect(numbers.kind).toBe('numbers');
    expect(numbers.numbers?.map((item) => item.element)).toEqual([
      'View "Сповіщення.Ви маєте 49 непрочитаних повідомлень"',
      'View "Комунікації.Ви маєте 80 непрочитаних повідомлень"',
      expect.stringContaining('TextView "Курс євро. Продаж 49 Гривень 73 копійки'),
    ]);
    expect(numbers.numbers?.[0]).toMatchObject({
      index: current.nodes.find((node) => node.label.startsWith('Сповіщення'))?.index,
      before: 'Сповіщення.Ви маєте 99 непрочитаних повідомлень',
    });
  });

  it('says nothing about numbers when something else changed too', () => {
    const extra = parse(
      screen(
        'Сповіщення.Ви маєте 49 непрочитаних повідомлень',
        'Комунікації.Ви маєте 80 непрочитаних повідомлень',
        'Курс євро. Продаж 49 Гривень 73 копійки, . Купівля 50 Гривень 76 копійок, .',
        '<android.widget.Button index="2" class="android.widget.Button" text="Новинка" resource-id="com.bank.app:id/promo" clickable="true" enabled="true" bounds="[40,100][300,200]" displayed="true" />'
      )
    );

    expect(hint(diffTrees(baseline, extra)).map((item) => item.kind)).not.toContain('numbers');
    // a changed area outside the elements whose numbers changed
    expect(
      hint(undefined, [...regions, { x: 40, y: 1000, width: 200, height: 50 }]).map((item) => item.kind)
    ).not.toContain('numbers');
  });

  it('tells numbers that changed in a label alone, with no pixels changed', () => {
    expect(hint(undefined, []).map((item) => item.kind)).toEqual(['numbers']);
  });
});
