import {
  checkVariableText,
  insideKeep,
  MAX_CHECKED_TEXT,
  partsProblem,
  TextPart,
  VariableTextProblem,
  variableTextStatus,
} from './variable-text';

const updated: TextPart[] = [{ text: 'Оновлено о ' }, { pattern: '\\d+:\\d{2}', sample: '14:07' }];
const amount: TextPart[] = [{ text: '₴ ' }, { pattern: '\\d{1,3}(?:\\s\\d{3})*,\\d{2}', sample: '12 480,50' }];

describe('checkVariableText', () => {
  it('accepts a text whose fixed parts match and whose places fit', () => {
    expect(checkVariableText(updated, 'Оновлено о 14:07')).toEqual({ ok: true });
    expect(checkVariableText(updated, 'Оновлено о 9:12')).toEqual({ ok: true });
    expect(checkVariableText(amount, '₴ 1 250 000,00')).toEqual({ ok: true });
    expect(checkVariableText(amount, '₴ 99,00')).toEqual({ ok: true });
  });

  it('tells a changed fixed text from a value that does not fit', () => {
    expect(checkVariableText(updated, 'Updated at 14:07')).toEqual({ ok: false, reason: 'text' });
    expect(checkVariableText(updated, 'Оновлено об 14:07')).toEqual({ ok: false, reason: 'text' });
    // a tail after the last place reads as part of the value
    expect(checkVariableText(updated, 'Оновлено о 14:07 (UTC)')).toEqual({ ok: false, reason: 'pattern' });
    expect(checkVariableText(updated, 'Оновлено о undefined')).toEqual({ ok: false, reason: 'pattern' });
    expect(checkVariableText(updated, 'Оновлено о 14:7')).toEqual({ ok: false, reason: 'pattern' });
  });

  it('turns away undefined, NaN, Invalid Date and an empty place', () => {
    for (const broken of ['undefined', 'NaN', 'Invalid Date', '']) {
      expect(checkVariableText(updated, `Оновлено о ${broken}`).ok).toBe(false);
      expect(checkVariableText(amount, `₴ ${broken}`).ok).toBe(false);
    }
  });

  it('treats non-breaking and narrow spaces as spaces and ignores spaces at the edges', () => {
    expect(checkVariableText(amount, '  ₴ 12 480,50 ')).toEqual({ ok: true });
    expect(checkVariableText(updated, 'Оновлено   о 14:07')).toEqual({ ok: true });
  });

  it('checks a text marked whole by its pattern alone', () => {
    const whole: TextPart[] = [{ pattern: '\\d+\\.\\d{2},\\s+\\d+:\\d{2}' }];
    expect(checkVariableText(whole, '03.11, 09:12').ok).toBe(true);
    expect(checkVariableText(whole, 'Invalid Date').ok).toBe(false);
  });

  it('reads letters of any alphabet in a word place', () => {
    const name: TextPart[] = [{ text: 'Доброго ранку, ' }, { pattern: '\\p{L}+' }];
    expect(checkVariableText(name, 'Доброго ранку, Олено').ok).toBe(true);
    expect(checkVariableText(name, 'Доброго ранку, ').ok).toBe(false);
  });

  it('does not check a text longer than 2000 characters', () => {
    const long = `Оновлено о ${'1'.repeat(MAX_CHECKED_TEXT)}:00`;
    expect(checkVariableText(updated, long)).toEqual({ ok: false, reason: 'too-long' });
  });
});

describe('partsProblem', () => {
  it('rejects parts without a place, with a pattern that does not parse or of the wrong shape', () => {
    expect(partsProblem(updated)).toBeNull();
    expect(partsProblem([{ text: 'Оновлено о 14:07' }])).toMatch(/at least one place/);
    expect(partsProblem([{ pattern: '(' }])).toMatch(/does not parse/);
    expect(partsProblem([{ pattern: 'x'.repeat(201) }])).toMatch(/1 to 200/);
    expect(partsProblem([])).toMatch(/no parts/);
    expect(partsProblem('text')).toMatch(/no parts/);
    expect(partsProblem([{ text: 1 }])).toMatch(/not a text or a place/);
  });
});

describe('variableTextStatus', () => {
  const problem: VariableTextProblem = {
    ruleId: 'r',
    kind: 'failed',
    element: 'TextView',
    text: 'Оновлено о undefined',
    reason: 'pattern',
    bounds: { x: 0, y: 100, width: 200, height: 40 },
  };

  it('sends a run that passed on its pixels to review when a variable text did not hold', () => {
    expect(variableTextStatus('ok', [problem])).toBe('unresolved');
    expect(variableTextStatus('autoApproved', [problem])).toBe('unresolved');
    expect(variableTextStatus('ok', [])).toBe('ok');
    expect(variableTextStatus('unresolved', [problem])).toBe('unresolved');
  });

  it('does not count a failure outside the compared elements', () => {
    expect(insideKeep([problem], [{ x: 0, y: 500, width: 100, height: 50 }])).toEqual([]);
    expect(insideKeep([problem], [{ x: 0, y: 90, width: 100, height: 50 }])).toEqual([problem]);
    expect(insideKeep([problem], null)).toEqual([problem]);
  });
});
