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

export interface InlinePiece {
  text: string;
  // a word only the old text has, only the new one, or both
  kind: "same" | "removed" | "added";
}

/**
 * A changed text as one line (REQ-074-04): the shared words once, and where
 * they differ the old words crossed out right before the new ones, so the
 * reader does not compare two whole sentences by eye.
 */
export function inlineDiff(before: string, after: string): InlinePiece[] {
  const diff = wordDiff(before, after);
  const words = (pieces: DiffPiece[]) =>
    pieces.filter((piece) => !isSpace(piece.text));
  const a = words(diff.before);
  const b = words(diff.after);
  const out: InlinePiece[] = [];
  const push = (text: string, kind: InlinePiece["kind"]) => {
    const last = out[out.length - 1];
    // neighbouring words of one kind read as one run
    if (last && last.kind === kind) last.text += ` ${text}`;
    else {
      if (last) out.push({ text: " ", kind: "same" });
      out.push({ text, kind });
    }
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    while (i < a.length && a[i].changed) push(a[i++].text, "removed");
    while (j < b.length && b[j].changed) push(b[j++].text, "added");
    if (i < a.length && j < b.length) {
      push(a[i].text, "same");
      i++;
      j++;
    }
  }
  // the single spaces between runs belong to the plain text around them
  return out.reduce<InlinePiece[]>((all, piece) => {
    const last = all[all.length - 1];
    if (last && last.kind === "same" && piece.kind === "same")
      last.text += piece.text;
    else all.push({ ...piece });
    return all;
  }, []);
}
