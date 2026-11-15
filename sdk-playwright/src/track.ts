// Ported from Visual Regression Tracker sdk-js 5.9.0 (src/helpers/track.helper.ts), Apache-2.0;
// see ../NOTICE. Same outcomes: "new" and "unresolved" fail the test unless soft assertions are on.
import { TestRunResponse, TestStatus } from './types';

interface Outcome {
  fails: boolean;
  message: string;
}

const getOutcome = ({ status, url }: TestRunResponse): Outcome | undefined => {
  switch (status) {
    case TestStatus.new:
      return { fails: true, message: `No baseline: ${url}` };
    case TestStatus.unresolved:
      return { fails: true, message: `Difference found: ${url}` };
    case TestStatus.ok:
    case TestStatus.approved:
    case TestStatus.autoApproved:
      return undefined;
    case TestStatus.failed:
      return { fails: false, message: `Rejected: ${url}` };
    default:
      return { fails: false, message: `Unknown test run status "${status}": ${url}` };
  }
};

export const processTestRun = (testRunResponse: TestRunResponse, enableSoftAssert?: boolean): void => {
  const outcome = getOutcome(testRunResponse);
  if (!outcome) return;
  if (!outcome.fails) {
    console.warn(outcome.message);
  } else if (enableSoftAssert) {
    console.error(outcome.message);
  } else {
    throw new Error(outcome.message);
  }
};

export const shouldStopRetry = (result: TestRunResponse): boolean => result.status !== TestStatus.unresolved;

export const trackWithRetry = async (
  trackFn: () => Promise<TestRunResponse>,
  retryLimit = 2,
  enableSoftAssert?: boolean
): Promise<TestRunResponse> => {
  const result = await trackFn();
  if (retryLimit <= 0 || shouldStopRetry(result)) {
    processTestRun(result, enableSoftAssert);
    return result;
  }
  console.info(`Diff found... Remaining retry attempts **${retryLimit}**`);
  return trackWithRetry(trackFn, retryLimit - 1, enableSoftAssert);
};
