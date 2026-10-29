import { IgnoreAreaDto } from 'src/test-runs/dto/ignore-area.dto';
import { AreaRect } from './pixelmatch/pixelmatch.core';

export interface ImageCompareInput {
  baseline: string;
  image: string;
  diffTollerancePercent: number;
  ignoreAreas: IgnoreAreaDto[];
  saveDiffAsFile: boolean;
  // from the UI trees (pixelmatch and VLM only): see PixelmatchJobInput
  moves?: Array<{ from: AreaRect; to: AreaRect }>;
  toleranceAreas?: Array<AreaRect & { maxDiffPercent: number }>;
  measureAreas?: AreaRect[];
}
