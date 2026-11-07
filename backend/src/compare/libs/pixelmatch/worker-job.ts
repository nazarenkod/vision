import { computePixelmatchDiff, PixelmatchJobInput, PixelmatchJobOutput } from './pixelmatch.core';
import { computeChangeSignature, SignatureJobInput, SignatureJobOutput } from './signature.core';
import { A11yJobInput, A11yJobOutput, runA11yJob } from '../../../a11y/a11y.job';

/**
 * The jobs {@link DiffWorkerPool} runs off the event loop, discriminated by
 * `kind`. Both the worker thread and the pool's inline fallback go through
 * {@link runWorkerJob}, so the two paths cannot answer a job differently.
 */
export type WorkerJobInput = PixelmatchJobInput | SignatureJobInput | A11yJobInput;
export type WorkerJobOutput = PixelmatchJobOutput | SignatureJobOutput | A11yJobOutput;

export function runWorkerJob(input: WorkerJobInput): WorkerJobOutput {
  if (input.kind === 'a11y') return runA11yJob(input);
  return input.kind === 'signature' ? computeChangeSignature(input) : computePixelmatchDiff(input);
}
