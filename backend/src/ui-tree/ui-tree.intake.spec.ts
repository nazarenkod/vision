import { gzipSync } from 'zlib';
import { readUiTreeXml, UI_TREE_MAX_BYTES } from './ui-tree.intake';

const tree = (body: string) => `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy>${body}</hierarchy>`;
// a tree padded to an exact size in bytes
const treeOf = (bytes: number) => {
  const head = tree('<node text="');
  const tail = '"/></hierarchy>';
  return (
    head.replace('</hierarchy>', '') + 'x'.repeat(bytes - (head.length - '</hierarchy>'.length) - tail.length) + tail
  );
};
const gzipped = (xml: string) => gzipSync(Buffer.from(xml, 'utf8')).toString('base64');
const plain = (xml: string) => Buffer.from(xml, 'utf8').toString('base64');

describe('readUiTreeXml', () => {
  it('reads a gzipped tree and a plain one alike', () => {
    const xml = tree('<node text="Pay"/>');
    expect(readUiTreeXml(gzipped(xml))).toEqual({ xml });
    expect(readUiTreeXml(plain(xml))).toEqual({ xml });
  });

  it('takes a gzipped tree of exactly 10 MiB', () => {
    const xml = treeOf(UI_TREE_MAX_BYTES);
    expect(Buffer.byteLength(xml)).toBe(UI_TREE_MAX_BYTES);
    expect(readUiTreeXml(gzipped(xml))).toEqual({ xml });
    expect(readUiTreeXml(plain(xml))).toEqual({ xml });
  });

  it('stops unpacking at 10 MiB and leaves the tree out', () => {
    // a bomb: 256 MB of one character pack into ~250 KB; only the limit is unpacked
    const bomb = gzipSync(Buffer.alloc(256 * 1024 * 1024, 'a'), { level: 9 }).toString('base64');
    const started = Date.now();
    expect(readUiTreeXml(bomb)).toEqual({ left: 'too-large', detail: `over ${UI_TREE_MAX_BYTES} bytes unpacked` });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(readUiTreeXml(gzipped(treeOf(UI_TREE_MAX_BYTES + 1)))).toMatchObject({ left: 'too-large' });
  });

  it('leaves out a plain tree over 10 MiB', () => {
    expect(readUiTreeXml(plain(treeOf(UI_TREE_MAX_BYTES + 1)))).toMatchObject({ left: 'too-large' });
  });

  it('leaves out a tree that declares entities, without expanding them', () => {
    const laughs =
      '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]>' +
      '<hierarchy><node text="&lol2;"/></hierarchy>';
    expect(readUiTreeXml(gzipped(laughs))).toEqual({
      left: 'declares-entities',
      detail: 'has a DOCTYPE or ENTITY declaration',
    });
    expect(readUiTreeXml(plain('<!doctype hierarchy><hierarchy/>'))).toMatchObject({ left: 'declares-entities' });
  });

  it('keeps the standard references Appium writes texts with', () => {
    const xml = tree('<node text="Tom &amp; Jerry &#x1F686;"/>');
    expect(readUiTreeXml(gzipped(xml))).toEqual({ xml });
  });
});
