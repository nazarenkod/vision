import { cropAreas, draftFields, draftPrompt, draftSchema } from './bug-draft';

describe('cropAreas', () => {
  const mark = { x: 0, y: 300, width: 160, height: 30 };
  const changed = [
    { x: 0, y: 150, width: 70, height: 20 },
    { x: 0, y: 290, width: 160, height: 60 },
  ];

  it('sends crops around the marks, else around the changed areas, never whole screenshots', () => {
    expect(cropAreas([mark], changed)).toEqual([mark]);
    expect(cropAreas([], changed)).toEqual([changed[1], changed[0]]);
    expect(cropAreas([], [])).toEqual([]);
  });

  it('takes at most three areas, the largest first', () => {
    const many = [1, 5, 3, 4, 2].map((size) => ({ x: 0, y: 0, width: size, height: size }));
    expect(cropAreas(many, []).map((area) => area.width)).toEqual([5, 4, 3]);
  });
});

describe('draftPrompt', () => {
  it('asks for Ukrainian and takes only essence, steps, actual and expected', () => {
    const prompt = draftPrompt({
      note: 'кнопка оплати обрізана, Total due — так задумано',
      feature: 'Checkout',
      checkName: 'Checkout. Payment sheet',
      changes: ['Moved 28 px down: Button "Pay $48.90"'],
      areaCount: 1,
    });
    expect(prompt).toContain('Write in Ukrainian');
    expect(prompt).toContain('кнопка оплати обрізана, Total due — так задумано');
    expect(prompt).toContain('Moved 28 px down');
    expect(prompt).toMatch(/essence:.*\nsteps:.*\nactual:.*\nexpected:/);
    expect(prompt).toContain('Do not mention severity');

    const parsed = draftSchema.parse({
      essence: 'кнопка «Pay» обрізана.',
      steps: ['1. Додати товар', 'Відкрити Payment sheet'],
      actual: ' Обрізана. ',
      expected: 'Видна.',
      severity: 'S1',
      customer: 'Олена',
    });
    expect(Object.keys(parsed).sort()).toEqual(['actual', 'essence', 'expected', 'steps']);
    expect(draftFields(parsed)).toEqual({
      essence: 'кнопка «Pay» обрізана',
      steps: '1. Додати товар\n2. Відкрити Payment sheet',
      actual: 'Обрізана.',
      expected: 'Видна.',
    });
  });
});
