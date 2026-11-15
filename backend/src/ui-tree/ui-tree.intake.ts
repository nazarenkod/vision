import { gunzipSync } from 'zlib';

/**
 * The most a UI tree may take once unpacked (040): real Appium page sources are tens of KB to a
 * few MB, and the SDK leaves out anything bigger, so nothing a test sends today is cut.
 */
export const UI_TREE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * The most a form field may carry: a tree is base64 of at most 10 MiB, even if gzip gained
 * nothing (a third more, plus slack). Multer's own 1 MiB would refuse the whole snapshot of a
 * large page before its tree is even read (050).
 */
export const UI_TREE_FIELD_MAX_BYTES = Math.ceil((UI_TREE_MAX_BYTES * 4) / 3) + 64 * 1024;

const GZIP_MAGIC = [0x1f, 0x8b];

export type UiTreeIntake = { xml: string } | { left: 'too-large' | 'declares-entities'; detail: string };

/**
 * Reads the tree a client sent (base64 of XML, gzipped or not) without trusting it: unpacking
 * stops at the limit, so a few KB that inflate to gigabytes cost no more than a real tree, and a
 * tree with a DOCTYPE never reaches the parser, since that is the only place entities that
 * expand into each other can be declared; only a web page's bare `<!DOCTYPE html>` is let in (050). The standard ones (&amp;, &#x1F686;) stay: Appium
 * writes texts with them.
 */
export function readUiTreeXml(uiTreeBase64: string, maxBytes = UI_TREE_MAX_BYTES): UiTreeIntake {
  let bytes = Buffer.from(uiTreeBase64, 'base64');
  if (bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1]) {
    try {
      bytes = gunzipSync(bytes, { maxOutputLength: maxBytes });
    } catch (error) {
      if ((error as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') {
        return { left: 'too-large', detail: `over ${maxBytes} bytes unpacked` };
      }
      throw error;
    }
  } else if (bytes.length > maxBytes) {
    return { left: 'too-large', detail: `${bytes.length} bytes, over ${maxBytes}` };
  }
  const xml = bytes.toString('utf8');
  // the one DOCTYPE a web page has (050) declares nothing: HTML has no entities of its own
  const declarations = xml.replace(/^(\s*<!--[\s\S]*?-->)*\s*<!DOCTYPE\s+html\s*>/i, '');
  if (/<!(DOCTYPE|ENTITY)/i.test(declarations)) {
    return { left: 'declares-entities', detail: 'has a DOCTYPE or ENTITY declaration' };
  }
  return { xml };
}
