import { gzipSync } from 'zlib';
import { randomBytes } from 'crypto';
import { readUiTreeXml, UI_TREE_FIELD_MAX_BYTES, UI_TREE_MAX_BYTES } from './ui-tree.intake';

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

  it('lets in the bare doctype of a web page and nothing more', () => {
    const page = '<!DOCTYPE html><html><body><button>Pay</button></body></html>';
    expect(readUiTreeXml(plain(page))).toEqual({ xml: page });
    expect(readUiTreeXml(plain(`<!-- saved -->\n<!doctype HTML>\n<html></html>`))).toHaveProperty('xml');
    // a second doctype, an internal subset or an entity still never reach a parser
    for (const sneaky of [
      '<!DOCTYPE html><!DOCTYPE x [<!ENTITY a "b">]><html></html>',
      '<!DOCTYPE html [<!ENTITY a "b">]><html></html>',
      '<!DOCTYPE html><html><!ENTITY a "b"></html>',
    ]) {
      expect(readUiTreeXml(plain(sneaky))).toMatchObject({ left: 'declares-entities' });
    }
  });

  it('holds a web page to the same limit as an Appium tree', () => {
    const page = (bytes: number) => {
      const head = '<!DOCTYPE html><html><body><p>';
      const tail = '</p></body></html>';
      return head + 'x'.repeat(bytes - head.length - tail.length) + tail;
    };
    expect(readUiTreeXml(gzipped(page(UI_TREE_MAX_BYTES)))).toHaveProperty('xml');
    expect(readUiTreeXml(gzipped(page(UI_TREE_MAX_BYTES + 1)))).toMatchObject({ left: 'too-large' });
    expect(readUiTreeXml(plain(page(UI_TREE_MAX_BYTES + 1)))).toMatchObject({ left: 'too-large' });
  });

  it('lets a form field carry any tree under the limit, even one gzip cannot shrink', () => {
    // random bytes do not compress: the base64 of such a tree is the longest a client sends
    const field = gzipped(randomBytes(UI_TREE_MAX_BYTES / 2).toString('hex'));
    expect(field.length).toBeLessThanOrEqual(UI_TREE_FIELD_MAX_BYTES);
  });
});
