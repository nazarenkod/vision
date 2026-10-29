import { Step } from "react-joyride";

// content and title are dictionary keys (src/i18n): GuidedTour shows their text

export const LOCATOR_LOGIN_FORM = "loginform-1";
export const LOCATOR_BUILD_DETAILS = "build-details";
export const LOCATOR_RESET_FILTER = "reset-filter";
export const LOCATOR_TEST_VARIATION_SELECT_BRANCH = "select-branch";
export const LOCATOR_TEST_VARIATION_MERGE_TOGGLE = "merge-branches";
export const LOCATOR_PROJECT_LIST_PAGE_PROJECT_LIST = "projectlist-1";
export const LOCATOR_PROJECT_PAGE_SELECT_PROJECT = "select-project";
export const LOCATOR_PROJECT_PAGE_BUILD_LIST = "build-list";
export const LOCATOR_PROJECT_PAGE_BUILD_DETAILS = "build-details";
export const LOCATOR_PROJECT_PAGE_TEST_RUN_LIST = "test-run-list";
export const LOCATOR_TEST_VARIATION_LIST_PAGE_SELECT_PROJECT = "select-project";
export const LOCATOR_TEST_VARIATION_LIST_PAGE_SELECT_BRANCH = "select-branch";
export const LOCATOR_TEST_VARIATION_LIST_PAGE_SELECT_RESET_FILTER =
  "reset-filter";

export const LOGIN_PAGE_STEPS: Step[] = [
  {
    target: `#${LOCATOR_LOGIN_FORM}`,
    content: "tour.loginAdmin",
  },
  {
    target: `#${LOCATOR_LOGIN_FORM}`,
    content: "tour.loginRegister",
  },
];

export const PROJECT_LIST_PAGE_STEPS: Step[] = [
  {
    target: `#${LOCATOR_PROJECT_LIST_PAGE_PROJECT_LIST}`,
    content: "tour.projectList",
    title: "tour.projectListTitle",
  },
];

export const PROJECT_PAGE_STEPS: Step[] = [
  {
    target: `#${LOCATOR_PROJECT_PAGE_SELECT_PROJECT}`,
    content: "tour.selectProject",
  },
  {
    target: `#${LOCATOR_PROJECT_PAGE_BUILD_LIST}`,
    content: "tour.buildList",
  },
  {
    target: `#${LOCATOR_PROJECT_PAGE_BUILD_LIST}`,
    content: "tour.noBuilds",
  },
  {
    target: `#${LOCATOR_PROJECT_PAGE_BUILD_DETAILS}`,
    content: "tour.buildDetails",
  },
  {
    target: `#${LOCATOR_PROJECT_PAGE_TEST_RUN_LIST}`,
    content: "tour.testRuns",
  },
];

export const TEST_VARIATION_LIST_PAGE = [
  {
    target: `#${LOCATOR_TEST_VARIATION_LIST_PAGE_SELECT_PROJECT}`,
    title: "tour.variationsTitle",
    content: "tour.variationsProject",
  },
  {
    // the form itself waits behind this button
    target: `#${LOCATOR_TEST_VARIATION_MERGE_TOGGLE}`,
    title: "tour.mergeTitle",
    content: "tour.merge",
  },
  {
    target: `#${LOCATOR_TEST_VARIATION_LIST_PAGE_SELECT_RESET_FILTER}`,
    content: "tour.filtered",
  },
];
