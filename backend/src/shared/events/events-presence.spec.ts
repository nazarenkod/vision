import { readPresence, shortName, viewersOf } from './events-presence';

describe('presence', () => {
  it('reads what a client opened and nothing else', () => {
    expect(readPresence({ buildId: 'b-1', testRunId: 'r-1', extra: 'x' }, 5)).toEqual({
      buildId: 'b-1',
      testRunId: 'r-1',
      at: 5,
    });
    expect(readPresence({ buildId: 'b-1' }, 5)).toEqual({ buildId: 'b-1', testRunId: null, at: 5 });
    expect(readPresence({ buildId: 'b 1; drop' }, 5)).toBeNull();
    expect(readPresence({ buildId: 'x'.repeat(65) }, 5)).toBeNull();
    expect(readPresence(null, 5)).toBeNull();
  });

  it('names a person by first name and the initial of the last one only', () => {
    expect(shortName({ firstName: 'Olena', lastName: 'Koval', email: 'olena@bank.ua' })).toBe('Olena K.');
    expect(shortName({ firstName: '', lastName: '', email: 'qa.lead@bank.ua' })).toBe('qa.lead');
  });

  it('counts a person with several tabs once, on the screen of the latest', () => {
    const viewers = viewersOf(
      [
        { userId: 'u1', name: 'Olena K.', presence: { buildId: 'b', testRunId: 'r1', at: 1 } },
        { userId: 'u1', name: 'Olena K.', presence: { buildId: 'b', testRunId: 'r2', at: 3 } },
        { userId: 'u2', name: 'Andrii P.', presence: { buildId: 'b', testRunId: null, at: 2 } },
        { userId: 'u3', name: 'Ira S.', presence: { buildId: 'other', testRunId: 'r1', at: 2 } },
        { userId: 'u4', name: 'Gone', presence: null },
      ],
      'b'
    );

    expect(viewers).toEqual([
      { userId: 'u2', name: 'Andrii P.', testRunId: null },
      { userId: 'u1', name: 'Olena K.', testRunId: 'r2' },
    ]);
  });
});
