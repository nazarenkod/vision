import { parseUiTree } from '../ui-tree/ui-tree.parser';
import {
  componentOf,
  facetsFromKey,
  facetsOf,
  markerQuery,
  problemCode,
  problemComponent,
  problemKeyOf,
  problemMarkers,
  screenTitle,
} from './a11y-problems';

const touch = (nodeKey: string, widthDp: number, screen = 'Адреси', heightDp = 38) =>
  facetsOf(
    { rule: 'touch-target', nodeKey, details: { widthDp, heightDp }, className: 'android.widget.Button', label: 'x' },
    screen
  );
const rule = (name: string, nodeKey: string, screen = 'a') => facetsOf({ rule: name as never, nodeKey }, screen);

describe('componentOf and facetsOf', () => {
  it('takes the component id of a Compose tag, a resource id without package, nothing without an id', () => {
    expect(componentOf('id:Адреса реєстрації#PbButton')).toBe('PbButton');
    expect(componentOf('id:Адреса реєстрації#PbButton#2')).toBe('PbButton');
    expect(componentOf('id:com.bank:id/tab_0')).toBe('tab_0');
    expect(componentOf('id:com.bank:id/btn#1')).toBe('btn');
    expect(componentOf('Button:Далі')).toBeNull();
  });

  it('keeps the facts of an issue, whatever problems are told apart by', () => {
    expect(touch('id:Адреса#PbButton#1', 38.2)).toEqual({
      rule: 'touch-target',
      element: 'Адреса#PbButton',
      nodeKey: 'id:Адреса#PbButton#1',
      component: 'PbButton',
      screen: 'Адреси',
      measure: '38x38',
      className: 'android.widget.Button',
      label: 'x',
    });
  });
});

describe('problemKeyOf', () => {
  it('is one problem for the same component and tap area on any screen, another for another area', () => {
    expect(problemKeyOf(touch('id:A#PbButton', 38.2))).toBe('touch-target|c:PbButton|38x38');
    expect(problemKeyOf(touch('id:B#PbButton', 37.8, 'Платежі'))).toBe('touch-target|c:PbButton|38x38');
    expect(problemKeyOf(touch('id:B#PbButton', 40, 'Платежі'))).toBe('touch-target|c:PbButton|40x38');
  });

  it('keeps ids apart and makes an element without an id a problem of its screen only', () => {
    expect(problemKeyOf(touch('id:com.bank:id/tab_0', 38))).not.toBe(problemKeyOf(touch('id:com.bank:id/tab_1', 38)));
    expect(problemKeyOf(touch('Button:Далі', 38))).toBe('touch-target|s:Адреси|e:Button:Далі');
    expect(problemKeyOf(touch('Button:Далі', 38, 'Платежі'))).not.toBe(problemKeyOf(touch('Button:Далі', 38)));
  });

  it('is one problem for the same component on any screen when the rule measures nothing', () => {
    expect(problemKeyOf(rule('missing-label', 'id:x:id/scan'))).toBe('missing-label|c:scan|');
    expect(problemKeyOf(rule('missing-label', 'id:y:id/scan', 'b'))).toBe('missing-label|c:scan|');
    expect(problemKeyOf(rule('not-accessible', 'id:A#PbIcon', 'b'))).toBe('not-accessible|c:PbIcon|');
  });

  it('keeps the same label a problem of its own screen', () => {
    expect(problemKeyOf(rule('duplicate-label', 'id:x:id/edit'))).toBe('duplicate-label|s:a|c:edit|');
    expect(problemKeyOf(rule('duplicate-label', 'id:x:id/edit', 'b'))).not.toBe(
      problemKeyOf(rule('duplicate-label', 'id:x:id/edit'))
    );
  });
});

describe('Jira markers', () => {
  it('labels a bug with its id, rule, component and values', () => {
    expect(problemMarkers('a11y-3f9c2a1b', touch('id:A#PbButton', 38))).toEqual([
      'a11y-3f9c2a1b',
      'a11y-touch-target',
      'a11y-component-PbButton',
      'a11y-value-38x38',
    ]);
    expect(problemMarkers('a11y-1', touch('Button:Далі', 38))).toEqual([
      'a11y-1',
      'a11y-touch-target',
      'a11y-value-38x38',
    ]);
  });

  it('searches by the markers problems are told apart with', () => {
    expect(markerQuery(touch('id:A#PbButton', 38))).toEqual([
      'a11y-touch-target',
      'a11y-component-PbButton',
      'a11y-value-38x38',
    ]);
    expect(markerQuery(rule('missing-label', 'id:x:id/scan'))).toEqual(['a11y-missing-label', 'a11y-component-scan']);
    // one screen's problem is found by its id only
    expect(markerQuery(touch('Button:Далі', 38))).toBeNull();
    expect(markerQuery(rule('duplicate-label', 'id:x:id/edit'))).toBeNull();
  });
});

describe('problemCode, problemComponent and facetsFromKey', () => {
  it('gives a short id from the key at creation', () => {
    const code = problemCode('p1', 'touch-target|c:PbButton|38x38');
    expect(code).toMatch(/^a11y-[0-9a-f]{8}$/);
    expect(problemCode('p2', 'touch-target|c:PbButton|38x38')).not.toBe(code);
    expect(problemComponent('touch-target|c:PbButton|38x38')).toBe('PbButton');
    expect(problemComponent('touch-target|s:a|e:Button:x')).toBeNull();
  });

  it('reads the facts back from keys of problems stored before facts were kept', () => {
    expect(facetsFromKey('touch-target|c:PbButton|38x38')).toMatchObject({
      rule: 'touch-target',
      component: 'PbButton',
      measure: '38x38',
    });
    expect(problemKeyOf(facetsFromKey('touch-target|c:PbButton|38x38'))).toBe('touch-target|c:PbButton|38x38');
    expect(problemKeyOf(facetsFromKey('missing-label|c:scan|'))).toBe('missing-label|c:scan|');
    expect(problemKeyOf(facetsFromKey('touch-target|s:Адреси|e:Button:Далі'))).toBe(
      'touch-target|s:Адреси|e:Button:Далі'
    );
  });
});

describe('screenTitle', () => {
  const xml = `<hierarchy width="1080" height="2400"><android.widget.FrameLayout class="android.widget.FrameLayout" bounds="[0,0][1080,2400]">
      <android.view.View class="android.view.View" resource-id="Appbar#Title" bounds="[0,60][1080,200]">
        <android.widget.TextView class="android.widget.TextView" text="Адреса проживання" bounds="[40,80][800,180]"/>
      </android.view.View>
      <android.widget.TextView class="android.widget.TextView" resource-id="com.bank:id/toolbar_title" text="Платежі" bounds="[40,300][800,380]"/>
    </android.widget.FrameLayout></hierarchy>`;
  const tree = parseUiTree(xml, { imageWidth: 1080, imageHeight: 2400 });

  it('reads the title by the project selectors, first match wins', () => {
    expect(screenTitle(tree)).toBe('Адреса проживання');
    expect(screenTitle(tree, ['id:toolbar_title', 'id:Appbar#Title'])).toBe('Платежі');
    expect(screenTitle(tree, ['id:missing', 'Appbar#Title'])).toBe('Адреса проживання');
    expect(screenTitle(tree, ['id:missing'])).toBeNull();
    expect(screenTitle(null)).toBeNull();
  });
});
