import { ownSpeakableText } from './ui-tree.parser';
import { UiTree } from './ui-tree.types';
import { diffTrees } from './structure-diff';

export interface CrossDeviceDifference {
  key: string;
  element: string;
  field: 'text' | 'label' | 'state';
  reference: string;
  here: string;
}

export interface CrossDeviceReport {
  // elements found on both devices
  compared: number;
  // of those, the ones whose text, label or state differ
  differences: CrossDeviceDifference[];
  // on the reference device but not found here: missing, or only off screen
  notFound: Array<{ key: string; element: string }>;
  // found here but not on the reference device
  onlyHere: number;
  // full counts when the lists above were cut
  truncated?: { differences: number; notFound: number };
}

const MAX_LISTED = 30;

/**
 * Compares a run's UI tree with the same check on the reference device, for
 * information only. Positions and sizes are left out: they differ between
 * screens by nature. What can be trusted is an element found on both devices
 * with a different text, label or state. An element not found here may be
 * missing or only off screen; the report does not decide which.
 */
export function compareAcrossDevices(reference: UiTree, here: UiTree): CrossDeviceReport {
  const changes = diffTrees(reference, here, Number.POSITIVE_INFINITY);
  const hereKeys = new Set(here.nodes.map((node) => node.key));
  const compared = reference.nodes.filter(
    (node) =>
      hereKeys.has(node.key) &&
      node.visible &&
      ((node.resourceId && !node.resourceId.startsWith('android:id/')) || !!ownSpeakableText(node) || node.clickable)
  ).length;
  const differences = changes
    .filter((change) => change.kind === 'text' || change.kind === 'label' || change.kind === 'state')
    .map((change) => ({
      key: change.key,
      element: change.element,
      field: change.kind as CrossDeviceDifference['field'],
      reference: change.before ?? '',
      here: change.after ?? '',
    }));
  const notFound = changes
    .filter((change) => change.kind === 'removed')
    .map((change) => ({ key: change.key, element: change.element }));
  return {
    compared,
    differences: differences.slice(0, MAX_LISTED),
    notFound: notFound.slice(0, MAX_LISTED),
    onlyHere: changes.filter((change) => change.kind === 'added').length,
    ...(differences.length > MAX_LISTED || notFound.length > MAX_LISTED
      ? { truncated: { differences: differences.length, notFound: notFound.length } }
      : {}),
  };
}
