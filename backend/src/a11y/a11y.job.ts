import { UiTree } from '../ui-tree/ui-tree.types';
import { A11yNorms } from './a11y-norms';
import { findViolations } from './a11y.rules';
import { A11yViolation, RgbaImage } from './a11y.types';

/**
 * The accessibility rules of one screen as a job for the comparison worker pool. Contrast samples
 * the screenshot under every text element, so a large tree kept the event loop busy for seconds
 * and stopped the API for every team while it ran (VIS-SEC-004); in a worker it holds one thread,
 * and the pool's timeout stops it.
 */
export interface A11yJobInput {
  kind: 'a11y';
  tree: UiTree;
  image?: RgbaImage;
  norms: A11yNorms;
}

export interface A11yJobOutput {
  violations: A11yViolation[];
}

export function runA11yJob(input: A11yJobInput): A11yJobOutput {
  return { violations: findViolations(input.tree, input.image, input.norms) };
}
