export interface DiffPiece {
  text: string;
  // the word is not on the other side; spaces between words never are
  changed: boolean;
}

export interface WordDiff {
  before: DiffPiece[];
  after: DiffPiece[];
}

// words and the spaces between them, so the text reads back exactly as it was
const split = (text: string) => text.split(/(\s+)/).filter(Boolean);
const isSpace = (piece: string) => /^\s+$/.test(piece);

/**
 * What differs between two texts, word by word (REQ-069-05): the longest run
 * of words both share stays plain, the rest is marked on its own side. A word
 * is what lies between spaces, so "11:25" and "11:26" differ as a whole.
 */
export function wordDiff(before: string, after: string): WordDiff {
  const a = split(before);
  const b = split(after);
  const words = (pieces: string[]) =>
    pieces
      .map((text, index) => ({ text, index }))
      .filter((piece) => !isSpace(piece.text));
  const wa = words(a);
  const wb = words(b);
  // longest common subsequence of the words; texts here are tens of words long
  const table = Array.from({ length: wa.length + 1 }, () =>
    new Array<number>(wb.length + 1).fill(0),
  );
  for (let i = wa.length - 1; i >= 0; i--)
    for (let j = wb.length - 1; j >= 0; j--)
      table[i][j] =
        wa[i].text === wb[j].text
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
  const keptA = new Set<number>();
  const keptB = new Set<number>();
  for (let i = 0, j = 0; i < wa.length && j < wb.length;) {
    if (wa[i].text === wb[j].text) {
      keptA.add(wa[i].index);
      keptB.add(wb[j].index);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  const mark = (pieces: string[], kept: Set<number>) =>
    pieces.map((text, index) => ({
      text,
      changed: !isSpace(text) && !kept.has(index),
    }));
  return { before: mark(a, keptA), after: mark(b, keptB) };
}
