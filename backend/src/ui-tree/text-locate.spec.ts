import { PNG } from 'pngjs';
import { alignPlaces, placeAreas, RecognisedWord, shrinkMask, textMask } from './text-locate';
import { placesOf, TextPart } from './variable-text';

// "Зі своєї картки *1050 +1.01 UAH 17 серпня, 13:59" with the number, sum and time marked
const parts: TextPart[] = [
  { text: 'Зі своєї картки *' },
  { pattern: '\\d+', sample: '1050' },
  { text: ' ' },
  { pattern: '[+\\-−]?\\d+\\.\\d{2}', sample: '+1.01' },
  { text: ' UAH 17 серпня, ' },
  { pattern: '\\d+:\\d{2}', sample: '13:59' },
];

// what recognition gave on a rendered history row, an icon read as noise first
const word = (text: string, x0: number, y0: number, x1: number, y1: number): RecognisedWord => ({
  text,
  bbox: { x0, y0, x1, y1 },
});
const row = [
  word('—', 74, 73, 136, 113),
  word('Зі', 206, 37, 246, 78),
  word('своєї', 271, 37, 404, 78),
  word('картки', 425, 48, 609, 88),
  word('*1051', 632, 38, 785, 78),
  word('+12.50', 969, 38, 1154, 78),
  word('UAH', 1179, 39, 1283, 78),
  word('17', 207, 106, 253, 137),
  word('серпня,', 272, 113, 435, 146),
  word('09:05', 455, 106, 570, 138),
  word('Підключай', 314, 203, 563, 244),
];

describe('placesOf', () => {
  it('gives the value of each marked place and where it is in the text', () => {
    const found = placesOf(parts, 'Зі своєї  картки *1051 +12.50 UAH 17 серпня, 09:05 ');
    expect(found.text).toBe('Зі своєї картки *1051 +12.50 UAH 17 серпня, 09:05');
    expect(found.places.map(({ value }) => value)).toEqual(['1051', '+12.50', '09:05']);
    expect(found.text.slice(found.places[1].start, found.places[1].end)).toBe('+12.50');
  });

  it('gives nothing for a text that does not hold', () => {
    expect(placesOf(parts, 'На свою картку *7101 -5.03 UAH 11 серпня, 11:41')).toBeNull();
  });

  it('keeps the numbering when a place has groups of its own', () => {
    const grouped: TextPart[] = [
      { text: 'о ' },
      { pattern: '(\\d+):(\\d{2})' },
      { text: ' — ' },
      { pattern: '\\p{L}+' },
    ];
    expect(placesOf(grouped, 'о 14:07 — Олена').places.map(({ value }) => value)).toEqual(['14:07', 'Олена']);
  });
});

describe('placeAreas', () => {
  it('finds each place among the recognised words in the order of the text', () => {
    const found = placesOf(parts, 'Зі своєї картки *1051 +12.50 UAH 17 серпня, 09:05');
    expect(placeAreas(found.text, found.places, row)).toEqual({
      areas: [
        { x: 632, y: 38, width: 153, height: 40 },
        { x: 969, y: 38, width: 185, height: 40 },
        { x: 455, y: 106, width: 115, height: 32 },
      ],
    });
  });

  it('tells a repeated value by its order: the time, not the day', () => {
    const time: TextPart[] = [{ text: '11 серпня, ' }, { pattern: '\\d+:\\d{2}' }];
    const found = placesOf(time, '11 серпня, 11:41');
    const words = [word('11', 0, 0, 30, 20), word('серпня,', 40, 0, 120, 20), word('11:41', 130, 0, 200, 20)];
    expect(placeAreas(found.text, found.places, words)).toEqual({ areas: [{ x: 130, y: 0, width: 70, height: 20 }] });
  });

  it('joins the words of a place on one line', () => {
    const date: TextPart[] = [{ pattern: '\\d+ \\p{L}+' }, { text: ', 13:59' }];
    const found = placesOf(date, '17 серпня, 13:59');
    const words = [word('17', 0, 5, 30, 25), word('серпня,', 40, 0, 120, 25), word('13:59', 130, 0, 200, 25)];
    expect(placeAreas(found.text, found.places, words)).toEqual({ areas: [{ x: 0, y: 0, width: 120, height: 25 }] });
  });

  it('names the first value it could not find', () => {
    const found = placesOf(parts, 'Зі своєї картки *1051 +12.50 UAH 17 серпня, 09:05');
    const withoutTime = row.filter((item) => item.text !== '09:05');
    expect(placeAreas(found.text, found.places, withoutTime)).toEqual({ missing: '09:05' });
  });

  it('does not take a place whose words fall on two lines', () => {
    const date: TextPart[] = [{ pattern: '\\d+ \\p{L}+' }];
    const found = placesOf(date, '17 серпня');
    expect(placeAreas(found.text, found.places, [word('17', 0, 0, 30, 20), word('серпня', 0, 40, 90, 60)])).toEqual({
      missing: '17 серпня',
    });
  });
});

describe('textMask', () => {
  const picture = (width: number, height: number, colour: (x: number, y: number) => number[]) => {
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) png.data.set([...colour(x, y), 255], (y * width + x) * 4);
    }
    return png;
  };
  const at = (mask: PNG, x: number, y: number) => mask.data[(y * mask.width + x) * 4];

  it('makes grey text on white and white text on a coloured band black, the backgrounds white', () => {
    const mask = textMask(
      picture(40, 80, (x, y) =>
        x === 3 && y === 10
          ? [153, 153, 153]
          : y < 40
            ? [255, 255, 255]
            : x === 6 && y === 60
              ? [255, 255, 255]
              : [200, 210, 255]
      )
    );
    expect([at(mask, 3, 10), at(mask, 4, 10), at(mask, 6, 60), at(mask, 5, 60)]).toEqual([0, 255, 0, 255]);
  });

  it('keeps white the background of a row that crosses the strokes of a word', () => {
    // more than half of this row is ink, as where the letters of a short word meet
    const mask = textMask(
      picture(40, 40, (x, y) => (y === 20 && x % 3 !== 0 && x < 36 ? [76, 175, 80] : [255, 255, 255]))
    );
    expect([at(mask, 2, 20), at(mask, 3, 20), at(mask, 38, 20), at(mask, 30, 5)]).toEqual([0, 255, 255, 255]);
  });

  it('takes out the frame of a button', () => {
    const framed = (x: number, y: number) => x < 2 || y < 2 || x > 77 || y > 37 || (x === 40 && y === 20);
    const mask = textMask(picture(80, 40, (x, y) => (framed(x, y) ? [76, 175, 80] : [255, 255, 255])));
    expect([at(mask, 0, 20), at(mask, 40, 0), at(mask, 40, 20)]).toEqual([255, 255, 0]);
  });
});

describe('alignPlaces', () => {
  const timeOnly: TextPart[] = [{ text: 'Зі своєї картки *1051 +1.05 UAH 17 серпня, ' }, { pattern: '\\d+:\\d{2}' }];
  const now = placesOf(timeOnly, 'Зі своєї картки *1051 +1.05 UAH 17 серпня, 14:02');
  const values = (found: ReturnType<typeof alignPlaces>) => found?.places.map(({ value }) => value);

  it('finds a place of the snapshot on a baseline whose unmarked words differ', () => {
    expect(values(alignPlaces(now.text, now.places, 'Зі своєї картки *1050 +1.01 UAH 17 серпня, 13:59'))).toEqual([
      '13:59',
    ]);
  });

  it('takes the word in the same position when the words around changed as well', () => {
    const sumOnly: TextPart[] = [
      { text: 'Зі своєї картки *1051 ' },
      { pattern: '[+\\-−]?\\d+\\.\\d{2}' },
      { text: ' UAH' },
    ];
    const here = placesOf(sumOnly, 'Зі своєї картки *1051 +1.05 UAH');
    expect(values(alignPlaces(here.text, here.places, 'Зі своєї картки *1050 +1.01 UAH'))).toEqual(['+1.01']);
  });

  it('cannot tell a place in a row of another kind', () => {
    expect(alignPlaces(now.text, now.places, 'Повернення коштів')).toBeNull();
  });
});

describe('shrinkMask', () => {
  it('makes a mask smaller, keeping a stroke black', () => {
    const mask = new PNG({ width: 40, height: 20 });
    for (let i = 0; i < 40 * 20; i++) mask.data.set([255, 255, 255, 255], i * 4);
    // a stroke two pixels wide
    for (let y = 0; y < 20; y++) for (const x of [10, 11]) mask.data.set([0, 0, 0, 255], (y * 40 + x) * 4);
    const small = shrinkMask(mask, 0.5);
    expect([small.width, small.height]).toEqual([20, 10]);
    expect([small.data[(5 * 20 + 5) * 4], small.data[(5 * 20 + 15) * 4]]).toEqual([0, 255]);
    expect(shrinkMask(mask, 1)).toBe(mask);
  });
});
