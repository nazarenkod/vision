import { readFileSync } from 'fs';
import * as path from 'path';
import { findBySelector } from './comparison-inputs';
import { matchTree, normalizeText, parseQuery, ScreenQuery, suggest } from './screen-search';
import { parseUiTree } from './ui-tree.parser';
import { UiNode, UiTree } from './ui-tree.types';

const fixture = (name: string) =>
  parseUiTree(readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8'), {
    imageWidth: 1080,
    imageHeight: 2400,
    densityDpi: 420,
  });

const node = (index: number, parent: number | null, over: Partial<UiNode>): UiNode => ({
  index,
  parent,
  depth: parent === null ? 0 : 1,
  key: `path:${index}`,
  className: 'android.widget.TextView',
  resourceId: '',
  text: '',
  label: '',
  hint: '',
  clickable: false,
  focusable: false,
  enabled: true,
  visible: true,
  accessible: true,
  bounds: { x: 0, y: index * 100, width: 400, height: 80 },
  ...over,
});

const tree = (nodes: UiNode[]): UiTree => ({
  format: 'appium-android',
  scale: 1,
  width: 1080,
  height: 2400,
  pixelsPerDp: 2.625,
  pixelsPerDpEstimated: false,
  nodes,
});

const query = (raw: string) => parseQuery(raw) as ScreenQuery;

describe('screen search', () => {
  it('finds visible text and labels ignoring case, repeated spaces and NBSP', () => {
    const screen = tree([
      node(0, null, { key: 'id:cashback', text: 'Кешбек\u00a05 %  на кафе' }),
      node(1, null, { key: 'id:hidden', text: 'кешбек 5 % на кафе', visible: false }),
      node(2, null, { key: 'id:flat', text: 'кешбек 5 % на кафе', bounds: { x: 0, y: 0, width: 0, height: 0 } }),
      node(3, null, { key: 'id:switch', label: 'КЕШБЕК 5 % на кафе' }),
    ]);

    expect(matchTree(screen, query('кешбек 5 % на   кафе')).map((match) => match.key)).toEqual([
      'id:cashback',
      'id:switch',
    ]);
  });

  it('asks for two characters before searching', () => {
    expect(parseQuery(' к ')).toEqual({ problem: 'short' });
    expect(parseQuery('   ')).toEqual({ problem: 'empty' });
    expect(parseQuery('кб')).toEqual({ kind: 'text', value: 'кб' });
  });

  it('reads quotes, brackets and currency signs as plain text', () => {
    expect(parseQuery('(₴ 100) "так"')).toEqual({ kind: 'text', value: '(₴ 100) "так"' });
  });

  it('keeps the innermost of nested matches', () => {
    const screen = tree([
      node(0, null, { key: 'id:row', label: 'Кешбек за місяць', bounds: { x: 0, y: 0, width: 1080, height: 200 } }),
      node(1, 0, { key: 'id:row_title', text: 'Кешбек за місяць', bounds: { x: 20, y: 20, width: 600, height: 60 } }),
    ]);

    expect(matchTree(screen, query('кешбек')).map((match) => match.key)).toEqual(['id:row_title']);
  });

  it('tells whether the text, the label or both matched', () => {
    const screen = tree([
      node(0, null, { key: 'id:a', text: 'Закрити' }),
      node(1, null, { key: 'id:b', label: 'Закрити' }),
      node(2, null, { key: 'id:c', text: 'Закрити', label: 'Закрити вікно' }),
    ]);

    expect(matchTree(screen, query('закрити')).map((match) => match.where)).toEqual([
      ['text'],
      ['label'],
      ['text', 'label'],
    ]);
  });

  it('finds what an element rule with the same selector finds', () => {
    const screen = fixture('android-payment.xml');
    for (const selector of ['id:btn_pay', 'class:android.widget.Button', 'text:Next', 'text:/Commission \\d+/']) {
      const rule = (findBySelector(screen, selector) ?? []).map((found) => found.key);
      expect(matchTree(screen, query(selector)).map((match) => match.key)).toEqual(rule);
      expect(rule.length).toBeGreaterThan(0);
    }
  });

  it('finds elements of a component ignoring case', () => {
    const screen = tree([
      node(0, null, { key: 'id:Оплата#PbButton', resourceId: 'Оплата#PbButton' }),
      node(1, null, { key: 'id:Скасувати#PbButton', resourceId: 'Скасувати#PbButton' }),
      node(2, null, { key: 'id:com.bank:id/pbbutton_icon', resourceId: 'com.bank:id/pbbutton_icon' }),
    ]);

    expect(parseQuery('component: pbbutton')).toEqual({ kind: 'component', value: 'pbbutton' });
    expect(matchTree(screen, query('component:pbbutton')).map((match) => match.key)).toEqual([
      'id:Оплата#PbButton',
      'id:Скасувати#PbButton',
    ]);
  });

  it('explains a selector it cannot read', () => {
    expect(parseQuery('text:/(a)\\1/')).toEqual({ problem: 'pattern' });
    expect(parseQuery('xpath:')).toHaveProperty('problem');
    expect(parseQuery('component:')).toEqual({ problem: 'empty' });
  });

  it('normalizes the way a person types', () => {
    expect(normalizeText('  Оновлено\u202fо   14:07 ')).toBe('оновлено о 14:07');
  });
});

describe('screen search suggestions', () => {
  const screens = [
    {
      check: 'Cards',
      tree: tree([
        node(0, null, {
          key: 'id:com.bank:id/cashback_tab',
          resourceId: 'com.bank:id/cashback_tab',
          text: 'Кешбек 5 %',
        }),
        node(1, null, { key: 'id:Кешбек#CashbackCard', resourceId: 'Кешбек#CashbackCard', text: 'Кешбек за місяць' }),
        node(2, null, { key: 'id:switch', resourceId: 'switch', label: 'Кешбек-сповіщення' }),
      ]),
    },
    {
      check: 'Home',
      tree: tree([
        node(0, null, {
          key: 'id:com.bank:id/cashback_tab',
          resourceId: 'com.bank:id/cashback_tab',
          text: 'Кешбек  5 %',
        }),
        node(1, null, { key: 'id:hidden', text: 'Кешбек сховано', visible: false }),
      ]),
    },
  ];

  it('suggests texts, labels, ids and components that hold the query, most screens first', () => {
    expect(suggest(screens, 'кеш')).toEqual([
      { kind: 'text', query: 'Кешбек 5 %', screens: 2 },
      { kind: 'text', query: 'Кешбек за місяць', screens: 1 },
      { kind: 'label', query: 'Кешбек-сповіщення', screens: 1 },
    ]);
    expect(suggest(screens, 'cash')).toEqual([
      { kind: 'id', query: 'id:cashback_tab', screens: 2 },
      { kind: 'component', query: 'component:CashbackCard', screens: 1 },
    ]);
  });

  it('suggests nothing for one letter or a selector already typed', () => {
    expect(suggest(screens, 'к')).toEqual([]);
    expect(suggest(screens, 'id:cash')).toEqual([]);
  });
});
