import { Message } from "./translate";

/**
 * The interface's texts in English. The keys are the dictionary: uk.ts has
 * to have every one of them (ADR-0014). {name} is replaced by a parameter; a
 * plural object picks its form by {count}.
 */
export const en = {
  "language.label": "Interface language",

  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.remove": "Remove",
  "common.dismissNotification": "Dismiss notification",

  "header.home": "{brand} home",
  "header.help": "Help",
  "header.account": "Account",
  "header.manualChecks": "Manual checks (CLI)",
  "header.reportProblem": "Report a problem",
  "header.users": "Users",
  "header.backups": "Backups",
  "header.projects": "Projects",
  "header.profile": "Profile",
  "header.logout": "Logout",

  "nav.main": "Main",
  "nav.projects": "Projects",
  "nav.builds": "Builds",
  "nav.baselines": "Baselines",
  "nav.insights": "Insights",
  "nav.settings": "Project settings",
  "nav.users": "Users",
  "nav.profile": "Profile",

  "projectList.title": "Projects",
  "projectList.search": "Search",
  "projectList.searchPlaceholder": "Project name",
  "projectList.add": "Add project",
  "projectList.project": "Project",
  "projectList.mainBranch": "Main branch",
  "projectList.comparison": "Comparison",
  "projectList.created": "Created",
  "projectList.actions": "Actions",
  "projectList.jiraConnected": "Connected",
  "projectList.jiraNotSet": "Not set",
  "projectList.builds": "Builds",
  "projectList.baselines": "Baselines",
  "projectList.settings": "Settings",
  "projectList.settingsOf": "Settings of {name}",
  "projectList.deleteOf": "Delete {name}",
  "projectList.noMatch": 'No projects match "{search}"',
  "projectList.empty": "No projects yet",
  "projectList.createTitle": "Create Project",
  "projectList.create": "Create",
  "projectList.createHint":
    "Everything else starts at its default; the project's settings open next.",
  "projectList.createdToast": "{name} created",
  "projectList.deleteTitle": "Delete Project",
  "projectList.deleteConfirm": "Are you sure you want to delete: {name}?",
  "projectList.deletedToast": "{name} deleted",

  "settings.title": "Project settings",
  "settings.backToProjects": "Projects",
  "settings.tab.general": "General",
  "settings.tab.comparison": "Image comparison",
  "settings.tab.mobile": "Mobile (UI tree)",
  "settings.tab.accessibility": "Accessibility",
  "settings.tab.jira": "Jira",
  "settings.save": "Save",
  "settings.discard": "Discard changes",
  "settings.unsaved": "Unsaved changes",
  "settings.saved": "{name} settings saved",
  "settings.readOnly":
    "Only admins and editors can change project settings. You can look around.",
  "settings.hasErrors": {
    one: "Nothing was saved: one field needs fixing. Its tab is marked.",
    other:
      "Nothing was saved: {count} fields need fixing. Their tabs are marked.",
  },
  "settings.leaveTitle": "Leave without saving?",
  "settings.leaveText":
    "The changes on this page are not saved yet. If you leave, they are lost.",
  "settings.stay": "Stay",
  "settings.leave": "Leave without saving",
  "settings.default": "Default: {value}",
  "settings.resetToDefault": "Reset to default",
  "settings.on": "on",
  "settings.off": "off",
  "settings.recommended": "Recommended",
  "settings.noSuggestions":
    "Suggestions come from the project's UI trees of the last 30 days, and it has none yet. Type values by hand; suggestions appear after the first checks sent with an Appium page source.",

  "general.project": "Project",
  "general.name": "Project name",
  "general.mainBranch": "Main branch",
  "general.mainBranchHelp":
    "Approved screenshots of this branch are the baselines every other branch is compared with.",
  "general.review": "Reviewing changes",
  "general.reviewIntro":
    "How screenshots of one screen are grouped and approved in a build.",
  "general.autoApprove": "Approve known screenshots on feature branches",
  "general.autoApproveHelp":
    "A screenshot on a feature branch that is exactly one approved before for this check is approved without review. Turn off to review every change on every branch.",
  "general.groupBy": "Group checks that differ only by",
  "general.groupByHelp":
    "Checks with the same name that differ only in this are one card in the build and are reviewed together.",
  "general.axis.customTags": "Tags (language, theme…)",
  "general.axis.customTagsHelp":
    "For example, the Payment screen in English, Ukrainian and dark theme: one card with three screenshots.",
  "general.axis.os": "OS version",
  "general.axis.osHelp":
    "For example, the Payment screen on Android 13, 14 and 15: one card.",
  "general.axis.device": "Device",
  "general.axis.deviceHelp":
    "For example, the Payment screen on Pixel 7 and Galaxy S23: one card.",
  "general.axis.viewport": "Screen size",
  "general.axis.viewportHelp":
    "For example, the Payment screen at 1080×2400 and 720×1600: one card.",
  "general.axis.browser": "Browser",
  "general.axis.browserHelp":
    "For example, the Payment page in Chrome and Safari: one card.",
  "general.bulkApprove": "Approve or reject a whole group at once",
  "general.bulkApproveHelp":
    "Opens one dialog for every screenshot of a group. Only those with the same change are selected for you; different ones are left for you to look at.",
  "general.cleanup": "Cleanup",
  "general.cleanupIntro":
    "Old builds and branches are deleted to keep the disk from filling up.",
  "general.buildCount": "Builds to keep",
  "general.buildCountHelp":
    "When a new build arrives, the oldest builds over this number are deleted with their screenshots.",
  "general.branchLifetime": "Delete feature branch baselines after, days",
  "general.branchLifetimeHelp":
    "Baselines of a branch other than {branch} that got no new screenshots for this many days are deleted at night.",
  "general.days": {
    one: "{count} day",
    other: "{count} days",
  },

  "comparison.library": "How screenshots are compared",
  "comparison.libraryIntro":
    "Every new screenshot is compared with its baseline pixel by pixel. Switching resets the options below to that method's defaults.",
  "comparison.switchConfirm":
    "The options of the current method will be replaced by the new method's defaults. Switch?",
  "comparison.pixelmatch": "pixelmatch",
  "comparison.pixelmatchHelp":
    "Fast and predictable; counts pixels whose colour differs more than the threshold. Suits app screenshots.",
  "comparison.lookSame": "looks-same",
  "comparison.lookSameHelp":
    "Compares colours as people see them and can ignore the text caret. Slower than pixelmatch.",
  "comparison.odiff": "odiff",
  "comparison.odiffHelp":
    "The fastest on large images; can fail at once when the screenshot size changed.",
  "comparison.vlm": "AI model (VLM)",
  "comparison.vlmHelp":
    "A vision language model describes the difference in words. Needs Ollama or a Gemini key; much slower.",
  "comparison.options": "Options of the method",
  "comparison.threshold": "Colour threshold",
  "comparison.thresholdHelp":
    "How different a pixel's colour may be before it counts as changed, from 0 (any difference) to 1 (none). 0.1 ignores rendering noise but catches a changed colour.",
  "comparison.odiffThresholdHelp":
    "How different a pixel's colour may be before it counts as changed, from 0 (any difference) to 1 (none).",
  "comparison.ignoreAntialiasing": "Ignore anti-aliasing",
  "comparison.ignoreAntialiasingHelp":
    "Smoothed edges of text and icons differ by a pixel between runs; with this on, they are not a change.",
  "comparison.allowDiffDimensions": "Compare screenshots of different sizes",
  "comparison.allowDiffDimensionsHelp":
    "Off: a screenshot of another size than its baseline fails at once. On: they are compared over the shared area.",
  "comparison.strict": "Strict",
  "comparison.strictHelp":
    "Any colour difference is a change. Faster than a tolerance of 0.",
  "comparison.tolerance": "Tolerance",
  "comparison.toleranceHelp":
    "How far colours may be apart, as people see them (ΔE). 2.3 is the smallest difference most people notice.",
  "comparison.antialiasingTolerance": "Anti-aliasing tolerance",
  "comparison.antialiasingToleranceHelp":
    "How much brighter or darker a pixel next to a smoothed edge may be. Raise it when edges still show as changes.",
  "comparison.ignoreCaret": "Ignore the text caret",
  "comparison.ignoreCaretHelp": "A blinking cursor in a field is not a change.",
  "comparison.failOnLayoutDiff": "Fail when the size changed",
  "comparison.failOnLayoutDiffHelp":
    "A screenshot of another size than its baseline fails without comparing pixels.",
  "comparison.outputDiffMask": "Diff image shows only the changes",
  "comparison.outputDiffMaskHelp":
    "On: the diff image is the changed pixels alone. Off: they are drawn over the screenshot.",
  "comparison.provider": "Model provider",
  "comparison.providerHelp":
    "Ollama runs on your own server; Gemini is Google's service and needs an API key.",
  "comparison.model": "Model",
  "comparison.ollamaModelHelp": "A vision model installed in Ollama.",
  "comparison.ollamaNoModels":
    "Ollama returned no models; type the model's name.",
  "comparison.unknownModel": "Ollama does not have this model.",
  "comparison.geminiModelHelp": "For example gemini-1.5-pro.",
  "comparison.geminiModels": "All Gemini models",
  "comparison.apiKey": "Gemini API key",
  "comparison.apiKeyHelp": "Kept with the project and sent only to Google.",
  "comparison.prompt": "Prompt",
  "comparison.promptHelp":
    "What the model is asked about the baseline, the new screenshot and the diff.",
  "comparison.temperature": "Temperature",
  "comparison.temperatureHelp":
    "From 0 to 1. Lower gives the same answer for the same images; higher, more varied wording.",
  "comparison.useThinking": "Read the model's thinking",
  "comparison.useThinkingHelp":
    "Some models put their answer in the thinking part; turn on if answers come back empty.",

  "mobile.comparison": "Comparing screens by their UI tree",
  "mobile.comparisonIntro":
    "For screenshots sent with an Appium page source. The tree tells what each element is, so Vision can tell real changes from noise.",
  "mobile.systemBars": "Leave out status and navigation bars",
  "mobile.systemBarsHelp":
    "The clock, battery and signal change on every run. Off: they show up as differences.",
  "mobile.moves": "Compare moved elements at their new place",
  "mobile.movesHelp":
    "A banner pushed the list down: the list items are compared where they are now, so only the banner is a change. A change inside a moved element still is one.",
  "mobile.maxMove": "Only moves up to, dp",
  "mobile.maxMoveHelp":
    "An element that moved further is a change. Empty: any distance.",
  "mobile.anyDistance": "any distance",
  "mobile.hidden": "Send changes the pixels do not show to review",
  "mobile.hiddenHelp":
    "A new accessibility label, a button that became disabled or unclickable, an invisible element: the screenshot looks the same, but the check goes to review.",
  "mobile.loading": "Warn about loading states",
  "mobile.loadingHelp":
    "Spinners, skeletons and toasts on the screen mean the screenshot was taken too early; the check gets a warning.",
  "mobile.wrongScreen": "Warn about wrong screens",
  "mobile.wrongScreenHelp":
    "The UI tree looks like another screen than the baseline (the test opened the wrong one); the check gets a warning.",
  "mobile.reference": "Reference device",
  "mobile.referenceDevice": "Reference device",
  "mobile.referenceHelp":
    "Other devices of a check are compared with it element by element: a text that differs on one device shows up in review. Only for information: it never changes a status.",
  "mobile.noReference": "None",
  "mobile.checks": {
    one: "{count} check",
    other: "{count} checks",
  },
  "mobile.rules": "Element rules for every screen",
  "mobile.rulesIntro":
    "Elements whose changes do not matter on any screen: a clock, a map, an animated banner.",
  "mobile.noRules": "No rules yet.",
  "mobile.element": "Element",
  "mobile.elementSearch": "Search by id, class or text",
  "mobile.elementSearchHelp":
    "Pick one of the project's elements, or type id:…, class:… or text:….",
  "mobile.elementTypeHelp": "id:…, class:… or text:… (text:/regex/ too).",
  "mobile.onScreens": {
    one: "on {count} screen",
    other: "on {count} screens",
  },
  "mobile.ruleAction": "What to do with it",
  "mobile.ignore": "Ignore",
  "mobile.tolerate": "Allow small changes",
  "mobile.percent": "Up to, %",
  "mobile.addRule": "Add rule",
  "mobile.ignoreHelp":
    "Ignore: the element's area is left out of the comparison, wherever the element is.",
  "mobile.tolerateHelp":
    "Allow small changes: the element is a change only when more than this share of its pixels differ.",
  "mobile.ignored": "ignored",
  "mobile.toleratedUpTo": "changes up to {percent}% allowed",
  "mobile.notSeen": "not seen in 30 days",
  "mobile.removeRule": "Remove the rule for {selector}",

  "a11y.intro":
    "Each accessibility problem gets one Jira bug. A problem has an id (a11y-…) that goes into the bug's summary and labels; before filing, Vision checks its own records and Jira for it, so the same problem is never filed twice.",
  "a11y.screenTitle": "Screen name",
  "a11y.screenTitleIntro":
    "Problems and bugs name the screen they are on. Vision reads the name from the UI tree by these selectors; without a match, the check's name is used.",
  "a11y.titleFound": {
    one: "Found in the project's UI trees ({count} screen):",
    other: "Found in the project's UI trees ({count} screens):",
  },
  "a11y.titleCoverage": "names {count} of {total} screens",
  "a11y.titleUse": "Use",
  "a11y.titleUsed": "In use",
  "a11y.titleSelectors": "Selectors, first match wins",
  "a11y.titleSelectorsHelp":
    "One per line: id:Appbar#Title, id:toolbar_title, class:…, text:/regex/.",
  "a11y.sameProblem": "When two findings are the same problem",
  "a11y.sameProblemIntro":
    "Per rule, for elements with an id. One problem is one bug: filed once, it covers every screen it is on. Elements without an id are always a problem of their own screen.",
  "a11y.sameProblemFor": "Same problem when: {rule}",
  "a11y.mode.componentValue": "Same component and values",
  "a11y.mode.componentValueSame":
    "A 38×38 dp PbButton on Payment and on Profile: one problem.",
  "a11y.mode.componentValueDifferent":
    "38×38 dp and 40×40 dp PbButton: two problems.",
  "a11y.mode.component": "Same component, any values",
  "a11y.mode.componentSame":
    "Every too small PbButton on any screen, whatever its size: one problem.",
  "a11y.mode.componentDifferent": "PbButton and PbChip: two problems.",
  "a11y.mode.screen": "Each screen on its own",
  "a11y.mode.screenSame": "Two unlabelled icons on Payment: one problem.",
  "a11y.mode.screenDifferent":
    "The same icon on Payment and on Profile: two problems.",
  "a11y.mode.class": "Everything this class takes",
  "a11y.mode.rule": "As the rule says",
  "a11y.rule.touch-target": "Touch target too small",
  "a11y.rule.low-contrast": "Low text contrast",
  "a11y.rule.missing-label": "Control has no label",
  "a11y.rule.input-without-label": "Input has no label or hint",
  "a11y.rule.duplicate-label": "Same label on several controls",
  "a11y.rule.redundant-role": "Label repeats the role",
  "a11y.rule.not-accessible": "Control hidden from VoiceOver",
  "a11y.classes": "Problem classes",
  "a11y.classesIntro":
    "Exceptions to the rules above for some elements: make all tabs one problem, or ignore a known false positive. The first class that matches a finding takes it.",
  "a11y.noClasses": "No classes yet.",
  "a11y.newClass": "New class",
  "a11y.className": "Name",
  "a11y.classNamePlaceholder": "For example: Tab bar",
  "a11y.conditionsHelp":
    "A class takes a finding when every field filled in matches. Pick the project's values or type patterns; within a field, any may match.",
  "a11y.field.element": "Element id",
  "a11y.field.screen": "Screen",
  "a11y.field.className": "Element class",
  "a11y.field.label": "Element label",
  "a11y.patternHelp":
    "Exact value, glob with * and ?, or /regex/. A (group) in an element id regex is the component.",
  "a11y.classRules": "Rules",
  "a11y.everyRule": "Every rule",
  "a11y.classGroupBy": "Same problem when",
  "a11y.classAction": "Then",
  "a11y.fileBugs": "File bugs",
  "a11y.ignore": "Ignore",
  "a11y.fileBugsHelp": "Found and filed as usual, grouped as chosen above.",
  "a11y.ignoreHelp":
    "Listed with the false positives and never filed: for known exceptions.",
  "a11y.coverage": {
    one: "Takes {count} element on {screens} screens of the project",
    other: "Takes {count} elements on {screens} screens of the project",
  },
  "a11y.coverageNone":
    "Takes nothing in the project's UI trees of the last 30 days: check the patterns.",
  "a11y.addClass": "Add class",
  "a11y.ignored": "ignored",
  "a11y.up": "Up",

  "jira.title": "Jira",
  "jira.intro":
    "Lets reviewers file accessibility bugs from the review screen. Each person adds their own Jira token in their profile, so bugs are filed as them; the shared token below is used for people who have not.",
  "jira.url": "Jira URL",
  "jira.urlHelp": "The address you open Jira at.",
  "jira.token": "Shared token (optional)",
  "jira.tokenHelp":
    "Never shown again after saving. Leave empty to keep the saved one.",
  "jira.tokenSaved": "Saved. Leave empty to keep it",
  "jira.tokenWillBeRemoved": "The saved token will be removed",
  "jira.removeToken": "Remove saved token",
  "jira.email": "Shared token's account email",
  "jira.emailHelp": "Jira Cloud only: the account the shared token belongs to.",
  "jira.issueType": "Issue type",
  "jira.issueTypeHelp": "The type new bugs are created with.",
  "jira.linkType": "Link type",
  "jira.linkTypeHelp":
    "How a bug is linked to the issue a reviewer names when filing.",

  "validation.required": "Required",
  "validation.twoCharacters": "Enter at least two characters.",
  "validation.wholeNumberFrom": "Enter a whole number from {min}.",
  "validation.atLeast": "Enter a number from {min}.",
  "validation.between": "Enter a number from {min} to {max}.",
  "validation.selector": "Start with id:, class: or text:.",
  "validation.pattern": "The pattern does not compile: {error}",
  "validation.url": "Enter an address starting with http:// or https://.",
} satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;

export type Messages = Record<MessageKey, Message>;
