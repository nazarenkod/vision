import { parseUiTree } from '../ui-tree/ui-tree.parser';
import {
  classOf,
  compilePattern,
  componentOf,
  problemCode,
  problemComponent,
  problemKeyOf,
  screenTitle,
} from './a11y-problems';

const touch = (nodeKey: string, widthDp: number, heightDp = 38) => ({
  rule: 'touch-target' as const,
  nodeKey,
  details: { widthDp, heightDp },
});

describe('componentOf', () => {
  it('takes the component id of a Compose tag, a resource id without package, nothing without an id', () => {
    expect(componentOf('id:Адреса реєстрації#PbButton')).toBe('PbButton');
    expect(componentOf('id:Адреса реєстрації#PbButton#2')).toBe('PbButton');
    expect(componentOf('id:com.bank:id/tab_0')).toBe('tab_0');
    expect(componentOf('id:com.bank:id/btn#1')).toBe('btn');
    expect(componentOf('Button:Далі')).toBeNull();
    expect(componentOf('path:/hierarchy/android.widget.ImageView[2]')).toBeNull();
  });
});

describe('problemKeyOf', () => {
  it('is one problem for the same component and tap area on any screen, another for another area', () => {
    expect(problemKeyOf(touch('id:A#PbButton', 38.2), 'Адреси')).toBe('touch-target|c:PbButton|38x38');
    expect(problemKeyOf(touch('id:B#PbButton', 37.8), 'Платежі')).toBe('touch-target|c:PbButton|38x38');
    expect(problemKeyOf(touch('id:B#PbButton', 40), 'Платежі')).toBe('touch-target|c:PbButton|40x38');
  });

  it('keeps ids apart: tab_0 and tab_1 are different elements', () => {
    expect(problemKeyOf(touch('id:com.bank:id/tab_0', 38), 's')).not.toBe(
      problemKeyOf(touch('id:com.bank:id/tab_1', 38), 's')
    );
  });

  it('makes an element without an id a problem of its screen only', () => {
    expect(problemKeyOf(touch('Button:Далі', 38), 'Адреси')).toBe('touch-target|s:Адреси|e:Button:Далі');
    expect(problemKeyOf(touch('Button:Далі', 38), 'Платежі')).not.toBe(
      problemKeyOf(touch('Button:Далі', 38), 'Адреси')
    );
  });

  it('follows the project settings per rule', () => {
    const anySize = { duplicateModes: { 'touch-target': 'component' as const } };
    expect(problemKeyOf(touch('id:A#PbButton', 38), 's', anySize)).toBe(
      problemKeyOf(touch('id:A#PbButton', 44), 's', anySize)
    );
    const perScreen = { duplicateModes: { 'touch-target': 'screen' as const } };
    expect(problemKeyOf(touch('id:A#PbButton', 38), 'Адреси', perScreen)).toBe(
      'touch-target|s:Адреси|c:PbButton|38x38'
    );
    // labels are the component's by default, whatever the screen
    expect(problemKeyOf({ rule: 'missing-label', nodeKey: 'id:x:id/scan' }, 'a')).toBe('missing-label|c:scan|');
    // two controls announced alike is about one screen
    expect(problemKeyOf({ rule: 'duplicate-label', nodeKey: 'id:x:id/scan' }, 'a')).toBe('duplicate-label|s:a|c:scan|');
  });
});

describe('problemCode and problemComponent', () => {
  it('gives a short id that is stable for the project and the key', () => {
    const code = problemCode('p1', 'touch-target|c:PbButton|38x38');
    expect(code).toMatch(/^a11y-[0-9a-f]{8}$/);
    expect(problemCode('p1', 'touch-target|c:PbButton|38x38')).toBe(code);
    expect(problemCode('p2', 'touch-target|c:PbButton|38x38')).not.toBe(code);
    expect(problemComponent('touch-target|c:PbButton|38x38')).toBe('PbButton');
    expect(problemComponent('touch-target|s:a|e:Button:x')).toBeNull();
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

describe('problem classes', () => {
  const tabs = { id: '1', name: 'Tab bar', match: '/^.*:id\\/(tab)_\\d+$/', mode: 'component' as const };
  const decor = { id: '2', name: 'Decor', rules: ['missing-label'], match: '*:id/decor_*', action: 'ignore' as const };

  it('compiles globs over the whole id, case-insensitive, and regexes as written', () => {
    expect(compilePattern('*:id/decor_*').test('com.bank:id/DECOR_1')).toBe(true);
    expect(compilePattern('*:id/decor_*').test('com.bank:id/decor')).toBe(false);
    expect(compilePattern('/PbButton$/').test('Адреса#PbButton')).toBe(true);
    expect(compilePattern('/(/')).toBeNull();
  });

  it('takes the first class whose rules and pattern match; a regex group is the component', () => {
    expect(classOf({ rule: 'touch-target', nodeKey: 'id:com.bank:id/tab_2' }, [decor, tabs])).toEqual({
      problemClass: tabs,
      component: 'tab',
    });
    // decor only takes missing labels
    expect(classOf({ rule: 'touch-target', nodeKey: 'id:com.bank:id/decor_1' }, [decor])).toBeNull();
    expect(classOf({ rule: 'missing-label', nodeKey: 'id:com.bank:id/decor_1' }, [decor])?.problemClass).toBe(decor);
  });

  it('lets a class group tab_0…tab_3 as one component problem, whatever their sizes', () => {
    const settings = { classes: [tabs] };
    expect(problemKeyOf(touch('id:com.bank:id/tab_0', 38), 'a', settings)).toBe('touch-target|c:tab|');
    expect(problemKeyOf(touch('id:com.bank:id/tab_3', 44), 'b', settings)).toBe('touch-target|c:tab|');
  });
});
