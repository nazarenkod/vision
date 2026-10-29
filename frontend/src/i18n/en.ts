import { Message } from "./translate";

/**
 * The interface's texts in English. The keys are the dictionary: uk.ts has
 * to have every one of them (ADR-0016). {name} is replaced by a parameter; a
 * plural object picks its form by {count}.
 */
export const en = {
  "language.label": "Interface language",

  "common.cancel": "Cancel",
  "common.remove": "Remove",
  "common.add": "Add",
  "common.ignore": "Ignore",
  "common.saved": "Saved",
  "common.dismissNotification": "Dismiss notification",

  "header.home": "{brand} home",
  "header.help": "Help",
  "header.account": "Account",
  "header.manualChecks": "Manual checks (CLI)",
  "header.reportProblem": "Report a problem",
  "header.profile": "Profile",
  "header.projects": "Projects",
  "header.users": "Users",
  "header.backups": "Backups",
  "header.lightTheme": "Light theme",
  "header.darkTheme": "Dark theme",
  "header.logout": "Logout",

  "nav.main": "Main",
  "nav.projects": "Projects",
  "nav.builds": "Builds",
  "nav.baselines": "Baselines",
  "nav.insights": "Insights",
  "nav.users": "Users",
  "nav.profile": "Profile",

  "projectList.title": "Projects",
  "projectList.search": "Search",
  "projectList.searchPlaceholder": "Project name",
  "projectList.add": "Add project",
  "projectList.project": "Project",
  "projectList.mainBranch": "Main branch",
  "projectList.comparison": "Comparison",
  "projectList.jira": "Jira",
  "projectList.created": "Created",
  "projectList.actions": "Actions",
  "projectList.jiraConnected": "Connected",
  "projectList.jiraNotSet": "Not set",
  "projectList.builds": "Builds",
  "projectList.baselines": "Baselines",
  "projectList.editOf": "Edit {name}",
  "projectList.deleteOf": "Delete {name}",
  "projectList.noMatch": 'No projects match "{search}"',
  "projectList.empty": "No projects yet",
  "projectList.createTitle": "New project",
  "projectList.create": "Create project",
  "projectList.createdToast": "{name} created",
  "projectList.deletedToast": "{name} deleted",

  "deleteProject.title": "Delete {name}?",
  "deleteProject.confirm":
    "All builds, baselines and their history go with it. Type {name} to confirm.",
  "deleteProject.nameLabel": "Project name to confirm",
  "deleteProject.submit": "Delete forever",

  "settings.title": "Settings",
  "settings.backToProjects": "Projects",
  "settings.sections": "Settings sections",
  "settings.find": "Find a setting",
  "settings.unsavedMark": "unsaved changes",
  "settings.noSuchProject": "No such project",
  "settings.maybeDeleted": "It may have been deleted.",
  "settings.nothingMatches": "Nothing matches “{query}”",
  "settings.nothingMatchesHint":
    "Try another word, or clear the search to see every section.",
  "settings.saved": "Saved",
  "settings.unsavedIn": "Unsaved changes in {sections}",
  "settings.discard": "Discard",
  "settings.save": "Save changes",
  "settings.conflictTitle":
    "Someone saved these settings after you opened the page",
  "settings.conflictChanged": "Changed since: {sections}.",
  "settings.conflictHint":
    "Reload to see their version and lose your changes, or save yours over theirs.",
  "settings.reload": "Reload settings",
  "settings.saveOver": "Save over",
  "settings.leaveTitle": "Leave without saving?",
  "settings.leaveText": "Unsaved changes in {sections} will be lost.",
  "settings.stay": "Stay",
  "settings.leave": "Leave",
  "settings.dangerText":
    "{title} All builds, baselines and their history go with it. This cannot be undone.",
  "settings.dangerTitle": "Delete this project.",
  "settings.deleteProject": "Delete project",
  "settings.meta.mobileOn": "{count} of 5 on",
  "settings.meta.classes": { one: "{count} class", other: "{count} classes" },
  "settings.meta.set": "set",
  "settings.meta.notSet": "not set",

  "section.general": "General",
  "section.review": "Review",
  "section.comparison": "Image comparison",
  "section.mobile": "Mobile screenshots",
  "section.rules": "Element rules",
  "section.a11y": "Accessibility problems",
  "section.jira": "Jira",
  "section.danger": "Danger zone",
  "section.comparisonIntro":
    "How a checkpoint is compared with its baseline. Below the engines: the settings of the one you pick.",
  "section.mobileIntro":
    "Applies to screenshots sent with an Appium page source.",
  "section.rulesIntro":
    "For every screen of the project. A rule names an element by id, class or text; text takes a /regex/.",
  "section.a11yIntro":
    "One bug per problem. A problem has an id (a11y-…) that goes into the Jira bug's summary and labels; Vision checks its own records and Jira for it before filing.",
  "section.jiraIntro":
    "Lets reviewers file accessibility bugs from the review screen. Each person adds their own Jira token in their profile, so bugs are filed as them. A shared token here is used for people who have not added one.",

  "general.name": "Project name",
  "general.mainBranch": "Main branch",
  "general.buildCount": "Number of builds to keep",
  "general.branchLifetime": "Max branch lifetime (days)",
  "general.newProjectHint":
    "Mobile screenshots, accessibility and Jira are set up in the project's settings, which open right after it is created.",

  "review.autoApprove": "Auto approve feature",
  "review.bulkApprove": "Bulk approve/reject variations",
  "review.bulkApproveHelp":
    "Review and bulk approve or reject a screen's variations (e.g. all locales) in one dialog. Only variations with the same change are pre-selected; different ones are left for manual review.",
  "review.groupBy": "Group variations by",
  "review.groupByHelp":
    "Which test-variation axis differs within a group. Screens that match on everything except this axis are grouped in the test run list and reviewed together — e.g. customTags for per-locale screenshots.",

  "comparison.library": "Image comparison library",
  "comparison.engines": "Image comparison",
  "comparison.pixelmatchHelp":
    "Pixel by pixel. Fast and predictable; the default.",
  "comparison.lookSameHelp":
    "Forgives anti-aliasing and the text caret. Good for text-heavy screens.",
  "comparison.odiffHelp":
    "The fastest on big screenshots. Can fail on any layout change.",
  "comparison.vlmHelp":
    "Asks a vision model whether a change matters. Slower; needs a provider.",
  "comparison.allowDiffDimensions": "Allow diff dimensions",
  "comparison.allowDiffDimensionsHelp":
    "Enable comparison of images with different sizes.",
  "comparison.ignoreAntialiasing": "Ignore anti-aliasing",
  "comparison.ignoreAntialiasingHelp":
    "Ignore detecting and ignoring anti-aliased pixels.",
  // upstream's spelling, kept so English reads as before
  "comparison.ignoreAntialiasingLooksSame": "Ignore anti-alliasing",
  "comparison.threshold": "Pixel diff threshold",
  "comparison.thresholdHelp":
    "The threshold of how much a pixel can deviate until it is detected as change (0-1).",
  "comparison.strict": "Strict",
  "comparison.tolerance": "Tolerance",
  "comparison.toleranceHelp":
    "Default tolerance in non-strict mode is 2.3 which is enough for the most cases. Setting tolerance to 0 will produce the same result as strict: true, but strict mode is faster. Attempt to set tolerance in strict mode will produce an error.",
  "comparison.antialiasingTolerance": "Antialiasing tolerance",
  "comparison.antialiasingToleranceHelp":
    "Minimum difference in brightness (zero by default) between the darkest/lightest pixel (which is adjacent to the antialiasing pixel) and theirs adjacent pixels.",
  "comparison.ignoreCaret": "Ignore carret",
  "comparison.outputDiffMask": "Output diff mask",
  "comparison.failOnLayoutDiff": "Fail on layout diff",
  "comparison.provider": "VLM Provider",
  "comparison.model": "Model",
  "comparison.modelRequired": "Model is required",
  "comparison.loadingModels": "Loading models...",
  "comparison.noModels": "No models available. Enter model name manually.",
  "comparison.unknownModel": "Selected model is not in the available list.",
  "comparison.ollamaModelHelp":
    "The Ollama model name to use for image comparison. Models are fetched from the Ollama service.",
  "comparison.geminiModel": "Gemini Model",
  "comparison.geminiModelHelp":
    "The Google Gemini model to use for image comparison.",
  "comparison.geminiModelName": "Gemini model name.",
  "comparison.geminiModels": "View all available models",
  "comparison.geminiKey": "Gemini API key",
  "comparison.geminiKeyNew": "Gemini API Key",
  "comparison.geminiKeyRequired": "API key is required",
  "comparison.geminiKeyHelp":
    "Your Google Gemini API key. Get one from https://makersuite.google.com/app/apikey",
  "comparison.geminiKeyEnter": "Enter your Google Gemini API key",
  "comparison.prompt": "Prompt",
  "comparison.promptRequired": "Prompt is required",
  "comparison.promptHelp":
    "The prompt text that will be sent to the VLM to analyze image differences.",
  "comparison.temperature": "Temperature",
  "comparison.temperatureHelp":
    "Controls the randomness of the VLM response. Lower values (0-0.3) produce more consistent results, higher values (0.7-1) produce more creative responses.",
  "comparison.temperatureShortHelp":
    "Controls response randomness (0-1). Lower values are more consistent.",
  "comparison.useThinking": "Use Thinking",
  "comparison.useThinkingHelp": "Enable thinking mode for the VLM model.",

  "mobile.title": "Mobile screenshots (UI tree)",
  "mobile.systemBars": "Leave out status and navigation bars",
  "mobile.systemBarsHelp": "Clock, battery and signal change on every run.",
  "mobile.moves": "Compare moved elements at their new place",
  "mobile.movesHelp":
    "An element that only moved (a banner pushed the list down) is not a difference; a change inside it still is.",
  "mobile.hidden": "Send hidden changes to review",
  "mobile.hiddenHelp":
    "A new label, a disabled or unclickable control, an invisible button: changes the pixels do not show.",
  "mobile.loading": "Warn about loading states",
  "mobile.loadingHelp":
    "Spinners, skeletons and toasts mean the screenshot was taken too early.",
  "mobile.wrongScreen": "Warn about wrong screens",
  "mobile.wrongScreenHelp":
    "The UI tree looks like another screen than the baseline.",
  "mobile.reference": "Reference device",
  "mobile.referenceHelp":
    "Other devices of a check are compared with it element by element, for information; it never changes a status.",
  "mobile.noReference": "None",
  "mobile.checks": { one: "({count} check)", other: "({count} checks)" },
  "mobile.maxMove": "Only moves up to, dp (empty for any)",

  "rules.title": "Element rules for every screen",
  "rules.ignored": "ignored",
  "rules.element": "Element",
  "rules.elementPlaceholder": "id:clock or class:MapView",
  "rules.elementHelp": "id:, class: or text: (text takes a /regex/)",
  "rules.selectorError":
    "Start with id:, class: or text:, for example id:banner",
  "rules.tolerate": "Tolerate",

  "a11y.title": "Accessibility problems",
  "a11y.intro":
    "One bug per problem. A problem has an id (a11y-…) that goes into the Jira bug's summary and labels; Vision checks its own records and Jira for it before filing, and marks problems found in Jira as filed.",
  "a11y.screenTitle": "Screen title in the UI tree",
  "a11y.screenTitleHelp":
    "One selector per line, first match wins: id:Appbar#Title, id:toolbar_title, class:…, text:/regex/. Without a match, the check's name is the screen.",
  "a11y.sameProblem": "Same problem when",
  "a11y.sameProblemIntro":
    "Per rule, for elements with an id. A component's problem holds on every screen with it: filed once, covered everywhere. Elements without an id are always a problem of their own screen.",
  "a11y.sameProblemFor": "Same problem when: {rule}",
  "a11y.mode.componentValue": "Same component and values",
  "a11y.mode.component": "Same component, any values",
  "a11y.mode.screen": "Each screen on its own",
  "a11y.mode.class": "Everything this class takes",
  "a11y.rule.touchTarget": "Touch target too small",
  "a11y.rule.lowContrast": "Low text contrast",
  "a11y.rule.missingLabel": "Control has no label",
  "a11y.rule.inputWithoutLabel": "Input has no label or hint",
  "a11y.rule.duplicateLabel": "Same label on several controls",
  "a11y.rule.redundantRole": "Label repeats the role",
  "a11y.rule.notAccessible": "Control hidden from VoiceOver",
  "a11y.classes": "Problem classes",
  "a11y.howMatching": "How matching works",
  "a11y.howMatchingText":
    "First match wins. A class takes an issue when every field filled in matches; within a field, one pattern per line, any may match. Patterns are globs with * and ?, or /regex/; a group in an element id regex becomes the component, so {example} makes tab_0…tab_3 one problem. “Everything this class takes” makes all of it one problem; “Ignore” lists it with the false positives and never files it. Problem ids never change with these settings: what is one problem is worked out again from what each problem was filed for.",
  "a11y.checkedAt": "Checked {position}",
  "a11y.everyRule": "every rule",
  "a11y.ignored": "ignored",
  "a11y.rulesSetting": "rule's setting",
  "a11y.up": "Up",
  "a11y.field.element": "Element id",
  "a11y.field.screen": "Screen",
  "a11y.field.className": "Element class",
  "a11y.field.label": "Element label",
  "a11y.className": "Name",
  "a11y.patternHelp": "One pattern per line",
  "a11y.required": "Required",
  "a11y.classRules": "Rules",
  "a11y.classRulesHelp": "Empty for every rule",
  "a11y.classRuleSetting": "Rule's setting",
  "a11y.classAction": "Then",
  "a11y.fileBugs": "File bugs",
  "a11y.addClass": "Add class",

  "jira.title": "Jira",
  "jira.intro":
    "Lets reviewers file accessibility bugs from the review screen. Each person adds their own Jira token in their profile, so bugs are filed as them. A shared token here is optional: it is used for people who have not added one.",
  "jira.url": "Jira URL",
  "jira.token": "Shared token (optional)",
  "jira.email": "Shared token's account email (Jira Cloud only)",
  "jira.issueType": "Issue type",
  "jira.linkType": "Link type",

  "secret.replace": "Replace",
  "secret.removedOnSave": "Removed on save",
  "secret.undo": "Undo",
  "secret.keepSaved": "Leave empty to keep the saved one",

  "validation.twoCharacters": "Enter at least two characters.",
  "validation.greaterThan": "Enter greater than {min}",
  "validation.lessThan": "Enter less than {max}",
  "validation.atLeast": "Enter greater than or equal to {min}",
  "validation.atMost": "Enter less than or equal to {max}",
} satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;

export type Messages = Record<MessageKey, Message>;
