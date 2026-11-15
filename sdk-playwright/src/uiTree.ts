// Vision: the UI tree of the page, collected by the script every Vision SDK runs (spec 050).
import { readFileSync } from 'fs';
import { join } from 'path';
import { gzipSync } from 'zlib';
import type { Page } from '@playwright/test';

/** The server refuses a larger tree (spec 040); the SDK does not send it. */
export const MAX_UI_TREE_BYTES = 10 * 1024 * 1024;
/**
 * The most the server's multipart upload takes in one text field (UI_TREE_FIELD_MAX_BYTES in
 * backend/src/ui-tree/ui-tree.intake.ts): base64 of a 10 MiB tree that gzip could not shrink.
 * A larger field would fail the whole request, so the tree is left out instead.
 */
export const MAX_PACKED_UI_TREE_LENGTH = Math.ceil((MAX_UI_TREE_BYTES * 4) / 3) + 64 * 1024;

export type UiTreeCapture = 'viewport' | 'page';

let script: string | undefined;

/** web-tree/collect-tree.js, which the build puts next to this file unchanged. */
export const collectorScript = (): string => (script ??= readFileSync(join(__dirname, 'collect-tree.js'), 'utf8'));

/** The augmented HTML of the page as it is now; throws when the script cannot run. */
export const collectWebTree = (page: Pick<Page, 'evaluate'>, capture: UiTreeCapture): Promise<string> =>
  page.evaluate(`(${collectorScript()})(${JSON.stringify({ capture })})`) as Promise<string>;

export const packUiTree = (tree: string): string => gzipSync(Buffer.from(tree, 'utf8')).toString('base64');

/**
 * The packed tree, or undefined with a warning: a tree that cannot be collected or is too large
 * leaves the screenshot as it was, never fails the test (REQ-050-22).
 */
export const uiTreeFor = async (
  page: Pick<Page, 'evaluate'>,
  capture: UiTreeCapture,
  name: string
): Promise<string | undefined> => {
  let tree: string;
  try {
    tree = await collectWebTree(page, capture);
  } catch (error) {
    console.warn(`Vision: no UI tree for "${name}", collecting it failed: ${(error as Error).message}`);
    return undefined;
  }
  if (typeof tree !== 'string' || !tree) {
    console.warn(`Vision: no UI tree for "${name}", the page gave none`);
    return undefined;
  }
  const size = Buffer.byteLength(tree, 'utf8');
  if (size > MAX_UI_TREE_BYTES) {
    console.warn(`Vision: no UI tree for "${name}", it is ${size} bytes, more than ${MAX_UI_TREE_BYTES}`);
    return undefined;
  }
  const packed = packUiTree(tree);
  if (packed.length > MAX_PACKED_UI_TREE_LENGTH) {
    console.warn(
      `Vision: no UI tree for "${name}", packed it is ${packed.length} bytes, more than the upload takes (${MAX_PACKED_UI_TREE_LENGTH})`
    );
    return undefined;
  }
  return packed;
};
