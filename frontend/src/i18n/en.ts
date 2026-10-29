import { BRAND } from "../constants/brand";
import { Message } from "./translate";

/**
 * The interface's texts in English. The keys are the dictionary: uk.ts has
 * to have every one of them (ADR-0017). {name} is replaced by a parameter; a
 * plural object picks its form by {count}.
 */
export const en = {
  "language.label": "Interface language",

  "common.cancel": "Cancel",
  "common.remove": "Remove",
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
  // the field is narrow: Ukrainian needs a shorter placeholder than its label
  "settings.findPlaceholder": "Find a setting",
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
  "settings.meta.rulesOn": "{count} of {total} on",
  "settings.meta.set": "set",
  "settings.meta.notSet": "not set",

  "section.general": "General",
  "section.review": "Review",
  "section.comparison": "Image comparison",
  "section.mobile": "Mobile screenshots",
  "section.a11y": "Accessibility",
  "section.jira": "Jira",
  "section.danger": "Danger zone",
  "section.comparisonIntro":
    "How a checkpoint is compared with its baseline. Below the engines: the settings of the one you pick.",
  "section.mobileIntro":
    "Applies to screenshots sent with an Appium page source.",
  "section.a11yIntro":
    "What Vision checks on every screenshot sent with a UI tree, by your team's norms.",
  "section.jiraIntro":
    "Lets reviewers file accessibility bugs from the review screen. Each person adds their own Jira token in their profile, so bugs are filed as them. A shared token here is used for people who have not added one.",

  "general.name": "Project name",
  "general.mainBranch": "Main branch",
  "general.buildCount": "Number of builds to keep",
  "general.branchLifetime": "Max branch lifetime (days)",
  "general.newProjectHint":
    "Mobile screenshots, accessibility and Jira are set up in the project's settings, which open right after it is created.",

  "review.autoApprove": "Auto approve feature",

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
  "mobile.maxMove": "Only moves up to, dp (empty for any)",

  "a11y.norm.touchTarget": "Minimum touch target",
  "a11y.norm.contrast": "Minimum contrast",
  "a11y.norm.android": "Android",
  "a11y.norm.ios": "iOS",
  "a11y.norm.text": "Text",
  "a11y.norm.large": "Large text",
  "a11y.norm.default": "Default {value}",
  "a11y.norm.reset": "Reset",
  "a11y.norm.whole": "A whole number from {min} to {max}",
  "a11y.norm.range": "From {min} to {max}, one decimal",
  "a11y.norm.iosOnly": "iOS only",
  "a11y.norm.advice": "advice, not counted",
  "a11y.norm.applies":
    "A looser norm also hides issues on screenshots already received; a stricter one finds new issues from the next screenshots.",
  "a11y.rule.touchTarget": "Touch target too small",
  "a11y.rule.lowContrast": "Low text contrast",
  "a11y.rule.missingLabel": "Control has no label",
  "a11y.rule.inputWithoutLabel": "Input has no label or hint",
  "a11y.rule.duplicateLabel": "Same label on several controls",
  "a11y.rule.redundantRole": "Label repeats the role",
  "a11y.rule.notAccessible": "Control hidden from VoiceOver",

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

  // status
  "testStatus.new": "new",
  "testStatus.unresolved": "unresolved",
  "testStatus.failed": "failed",
  "testStatus.approved": "approved",
  "testStatus.autoApproved": "autoApproved",
  "testStatus.ok": "ok",
  "buildStatus.passed": "passed",
  "buildStatus.unresolved": "unresolved",
  "buildStatus.failed": "failed",

  // builds
  "builds.clearSelection": "Clear selection",
  "builds.selectAll": "Select all ({total})",
  "builds.deletedMany": {
    one: "{count} build(s) deleted",
    other: "{count} build(s) deleted",
  },
  "builds.deleteFailed": {
    one: "Failed to delete {count} build(s)",
    other: "Failed to delete {count} build(s)",
  },
  "builds.search": "Search build",
  "builds.searchPlaceholder": "Search by CI build id",
  "builds.deleteSelected": "Delete {count} selected",
  "builds.loadFailed": "Builds could not be loaded",
  "builds.noMatch": 'No builds match "{search}"',
  "builds.empty": "No builds",
  "builds.stop": "Stop",
  "builds.editCiBuild": "Edit CI Build",
  "builds.delete": "Delete",
  "builds.editTitle": "Edit CI Build ID",
  "builds.edit": "Edit",
  "builds.editText": "Edit the ci build id for build: #{number}",
  "builds.newCiBuildId": "New CI Build Id",
  "builds.deleteTitle": "Delete Build",
  "builds.deleteConfirm": "Are you sure you want to delete build: #{number}?",
  "builds.deleted": "Build #{number} deleted",
  "builds.deleteManyTitle": "Delete Builds",
  "builds.deleteManyConfirm": {
    one: "Are you sure you want to delete {count} build(s)?",
    other: "Are you sure you want to delete {count} build(s)?",
  },
  "builds.deleteManyHint": "This also removes their test runs.",
  "builds.lastRun": " · last run {date}",
  "builds.statusBar":
    "{unresolved} unresolved, {failed} failed, {passed} passed",
  "builds.total": { one: "{value} total", other: "{value} total" },
  "builds.unresolved": {
    one: "{value} unresolved",
    other: "{value} unresolved",
  },
  "builds.failed": { one: "{value} failed", other: "{value} failed" },
  "builds.passed": { one: "{value} passed", other: "{value} passed" },
  "builds.a11yNew": {
    one: "{value} new accessibility issues",
    other: "{value} new accessibility issues",
  },
  "builds.views": "Build views",
  "builds.changes": "Changes",
  "builds.toReview": "{count} to review",
  "builds.allTests": "All tests · {count}",
  "builds.accessibility": "Accessibility",
  "builds.a11yNewPill": { one: "{count} new", other: "{count} new" },

  // runs
  "runs.name": "Name",
  "runs.tags": "Tags",
  "runs.status": "Status",
  "runs.noMatch": "No test runs match the filters",
  "runs.cardsSelected": {
    one: "{count} card selected",
    other: "{count} cards selected",
  },
  "runs.cardsPerPage": "Cards per page:",
  "runs.selectBuild": "Select build from list",
  "runs.selectAllRuns": "Select all runs",
  "runs.select": "Select {name}",
  "runs.table": "Table",
  "runs.tableView": "Table view",
  "runs.grid": "Grid",
  "runs.gridView": "Grid view",
  "runs.compact": "Compact",
  "runs.compactDensity": "Compact density",
  "runs.standard": "Standard",
  "runs.standardDensity": "Standard density",
  "runs.comfortable": "Comfortable",
  "runs.comfortableDensity": "Comfortable density",
  "runs.diffHelp": "Toggle diff. Hotkey: D",
  "runs.showDiff": "Show diff",
  "runs.searchByName": "Search by name",
  "runs.tag": "Tag",
  "runs.anyTag": "Any tag",
  "runs.anyStatus": "Any status",
  "runs.reset": "Reset",

  // bulk
  "bulk.clearIgnoreTitle": "Clear Ignore Area For Selected Items",
  "bulk.approveTitle": "Approve Test Runs",
  "bulk.rejectTitle": "Reject Test Runs",
  "bulk.deleteTitle": "Delete Test Runs",
  "bulk.downloadTitle": "Download Test Runs",
  "bulk.approve": "Approve",
  "bulk.reject": "Reject",
  "bulk.delete": "Delete",
  "bulk.download": "Download",
  "bulk.clear": "Clear",
  "bulk.approveConfirm": {
    one: "Are you sure you want to approve {count} items?",
    other: "Are you sure you want to approve {count} items?",
  },
  "bulk.rejectConfirm": {
    one: "Are you sure you want to reject {count} items?",
    other: "Are you sure you want to reject {count} items?",
  },
  "bulk.deleteConfirm": {
    one: "Are you sure you want to delete {count} items?",
    other: "Are you sure you want to delete {count} items?",
  },
  "bulk.downloadConfirm": {
    one: "Are you sure you want to download {count} items?",
    other: "Are you sure you want to download {count} items?",
  },
  "bulk.clearConfirm": {
    one: "Are you sure you want to clear {count} items?",
    other: "Are you sure you want to clear {count} items?",
  },
  "bulk.processed": {
    one: "{count} test runs processed.",
    other: "{count} test runs processed.",
  },
  "bulk.approveRows": "Approve unresolved in selected rows.",
  "bulk.approveCards": "Approve unresolved in selected cards.",
  "bulk.rejectRows": "Reject unresolved in selected rows.",
  "bulk.rejectCards": "Reject unresolved in selected cards.",
  "bulk.downloadRows": "Download images for selected rows.",
  "bulk.downloadCards": "Download images for selected cards.",
  "bulk.deleteRows": "Delete selected rows.",
  "bulk.deleteCards": "Delete selected cards.",
  "bulk.clearRows": "Clear ignore areas for selected rows.",
  "bulk.clearCards": "Clear ignore areas for selected cards.",

  // baselines
  "baselines.title": "Baselines",
  "baselines.checks": { one: "{count} check", other: "{count} checks" },
  "baselines.merge": "Merge branches",
  "baselines.perPage": "Per page",
  "baselines.history": "History",
  "baselines.deleteOf": "Delete {device}",
  "baselines.empty": "No baselines here",
  "baselines.emptyHint":
    "Baselines appear after the first approved screenshot, or none match the filters.",
  "baselines.deleteTitle": "Delete baseline",
  "baselines.delete": "Delete",
  "baselines.deleteConfirm": "Are you sure you want to delete: {name}?",
  "baselines.deleteScope": "Only the baseline for {device} on {branch}.",
  "baselines.mergeStarted": "Merge started in build: {id}",
  "baselines.fromBranch": "From branch",
  "baselines.toBranch": "To branch",
  "baselines.mergeSubmit": "Merge",
  "baselines.historyTitle": "Baseline history",
  "baselines.newestFirst": "Baselines, newest first",
  "baselines.current": "Current",
  "baselines.thisOne": "This one",
  "baselines.beforeIt": "Before it",
  "baselines.nothingBefore": "Nothing before it",
  "baselines.testRun": "Test Run",
  "baselines.tag.os": "OS",
  "baselines.tag.device": "Device",
  "baselines.tag.customTags": "Custom Tags",
  "baselines.tag.browser": "Browser",
  "baselines.tag.viewport": "Viewport",

  // filters
  "filters.all": "All",
  "filters.name": "Name",
  "filters.os": "OS",
  "filters.device": "Device",
  "filters.browser": "Browser",
  "filters.viewport": "Viewport",
  "filters.customTags": "Custom tags",
  "filters.status": "Status",
  "filters.branch": "Branch",
  "filters.reset": "Reset",
  "filters.project": "Project",
  "filters.selectProject": "Select project",

  // review
  "review.applyIgnoreArea":
    "Apply selected ignore area to all images in this build.",
  "review.ignoreSaved": "Ignore areas are updated.",
  "review.compareSaved":
    "Selected area has been inverted to ignore areas and saved.",
  "review.ignoreAppliedAll":
    "Ignore areas are updated in all images in this build.",
  "review.error": "There was an error : {error}",
  "review.ignoreUnknown":
    "There was an error determining which ignore area to apply.",
  "review.clearIgnore": "Clears all ignore areas.",
  "review.history": "History",
  "review.toggleDiff": "Toggle diff. Hotkey: D",
  "review.toggleDiffLabel": "Toggle diff",
  "review.step": "Step {current}/{total}: ",
  "review.overlay": "Overlay",
  "review.fadeHelp": "Fade the checkpoint out to see the baseline through it",
  "review.fade": "Fade",
  "review.fadeLabel": "Fade to the baseline",
  "review.blendHelp":
    "Blend the two as a difference: what matches goes black, and a shift shows as an offset ghost",
  "review.sizeDiffers":
    "Image height/width differ from baseline! Cannot calculate diff!",
  "review.commentUpdated": "Comment updated",
  "review.zoomIn": "Zoom In",
  "review.zoomOut": "Zoom Out",
  "review.originalSize": "Original size",
  "review.fit": "Fit into screen",
  "review.hotkeyLeft": "Hotkey: ArrowLeft",
  "review.hotkeyRight": "Hotkey: ArrowRight",
  "review.goNext": "Go to the next after Approve/Reject",
  "review.yes": "Yes",
  "review.applyIgnoreConfirm":
    "All images in the current build will be re-compared with new ignore area taken into account. Are you sure?",
  "review.baseline": "Baseline",
  "review.checkpoint": "Checkpoint",
  "review.loading": "Loading...",
  "review.branch": "Branch: {branch}",
  "review.uploadIgnore":
    "Contains noneditable ignore areas applied during image upload.",
  "review.attr.os": "OS",
  "review.attr.device": "Device",
  "review.attr.browser": "Browser",
  "review.attr.viewport": "Viewport",
  "review.attr.customTags": "Custom Tags",
  "review.vlmHelp":
    "AI-generated description of the differences found by the Vision Language Model (VLM).",
  "review.vlm": "VLM Analysis:",
  "review.diffMeterHelp":
    "{diff}% of pixels differ; the tolerance is {tolerance}% (diffTollerancePercent in the track call)",
  "review.diff": "Diff",
  "review.steps": "{approved} approved, {rejected} rejected, {waiting} waiting",
  "review.mergeHelp": "Will replace target branch baseline if accepted",
  "review.mergeInto": "merge into: {branch}",
  "review.hotkey": "Hotkey: {key}",
  "review.approve": "Approve",
  "review.reject": "Reject",
  "review.devices": "Devices",
  "review.approveAll": "Approve all {count}",
  "review.approveDevicesTitle": {
    one: "Approve {count} devices?",
    other: "Approve {count} devices?",
  },
  "review.approveDevicesText":
    "Each becomes the baseline for its device: {devices}.",
  "review.comments": "Comments",
  "review.commentPlaceholder": "Add any additional data here",
  "review.save": "Save",
  "review.notAvailable": "Not available",
  "review.unsavedTitle": "You have not saved ignore areas",
  "review.discard": "Discard",
  "review.discardConfirm": "Are you sure you want to discard changes?",

  // panel
  "panel.linked": "Linked {key}",
  "panel.noSuggestions": "No suggestions",
  "panel.copied": "Copied",
  "panel.ignoreAreaAdded":
    "Ignore area added; the screenshot is compared again",
  "panel.new": "New",
  "panel.existing": "Existing",
  "panel.bug": "Bug ",
  "panel.filing": "A bug is being filed…",
  "panel.codeHelp":
    "Problem id: in the Jira bug's summary and labels. Click to copy.",
  "panel.problemOf": "A problem of {component}: ",
  "panel.elsewhereIgnored":
    "{prefix}marked as a false positive on screen “{screen}”. It holds here too; nothing to file.",
  "panel.elsewhereFiling":
    "{prefix}a bug is being filed on screen “{screen}”. It holds here too; nothing to file.",
  "panel.elsewhereFiled":
    "{prefix}filed on screen “{screen}”. It holds here too; nothing to file.",
  "panel.alsoFiled": "Also filed for it:",
  "panel.suggested": "Suggested",
  "panel.copy": "Copy",
  "panel.unlinked": "Unlinked",
  "panel.unlinkEverywhere": "Unlink on every screen",
  "panel.unlink": "Unlink bug",
  "panel.createBug": "Create Jira bug",
  "panel.linkExisting": "Link existing",
  "panel.falsePositive": "False positive",
  "panel.noTree":
    "No UI tree came with this screenshot. Send the Appium page source with it (in the Java SDK: {code}), or check the screen with the Vision CLI, to check accessibility.",
  "panel.treeFailed": "The UI tree could not be checked.",
  "panel.checkedFrom": "Checked from the {platform} UI tree.",
  "panel.newCount": "{count} new",
  "panel.compared":
    "Compared with the baseline: {new}, {existing} existing, {fixed} fixed{reported}.",
  "panel.withBug": ", {count} with a bug",
  "panel.noBaselineTree":
    "The baseline has no UI tree, so every issue counts as new.",
  "panel.estimated": " Sizes are estimated: the client sent no screen density.",
  "panel.addToken":
    "Add your Jira token in your profile to file bugs from here.",
  "panel.addUrl":
    "Add the Jira URL in project settings to file bugs from here.",
  "panel.fileAll": "Create Jira bugs for all {count} open problems",
  "panel.resolved":
    "{key} is no longer found on this screen. The bug can probably be closed.",
  "panel.askingAi": "Asking AI…",
  "panel.suggestLabels": "Suggest labels with AI",
  "panel.noIssues": "No accessibility issues found on this screen.",
  "panel.falsePositives": "False positives ({count})",
  "panel.onScreen": " (on screen “{screen}”)",
  "panel.restored": "Restored",
  "panel.restoreEverywhere": "Restore on every screen",
  "panel.restore": "Restore",
  "panel.ruleAddedProject":
    "Rule added for every screen; the build is compared again",
  "panel.ruleAdded": "Rule added; the screenshot is compared again",
  "panel.ignore": "Ignore",
  "panel.noDetails": "No details about this change.",
  "panel.invisible": "Changes the screenshot does not show",
  "panel.ignoreArea": "Ignore area",
  "panel.nothingChanged": "Nothing changed against the baseline.",
  "panel.changedAreas": "Changed areas",
  "panel.spots": "Changed in {count} spots",
  "panel.areaAt": "{width} × {height} px at {x}, {y}",
  "panel.fromTree": "From the UI tree",
  "panel.moved": "Compared at their new place",
  "panel.movedHelp":
    "These moved without changing, so the move alone is not counted:",
  "panel.down": "down {count} dp",
  "panel.up": "up {count} dp",
  "panel.right": "right {count} dp",
  "panel.left": "left {count} dp",
  "panel.systemBars":
    "Status and navigation bars are left out (project setting).",
  "panel.ruleRemoved": "Rule removed; compared again",
  "panel.addRuleButton": "Add element rule",
  "panel.details": "Review details",
  "panel.accessibility": "Accessibility",
  "panel.changes": "Changes",
  "panel.linkTitle": "Link an existing Jira issue",
  "panel.linkHelp":
    "The issue will be shown on this problem on every later build.",
  "panel.jiraIssue": "Jira issue",
  "panel.looksLike": "Looks like ABC-123",
  "panel.cancel": "Cancel",
  "panel.link": "Link",
  "panel.fpTitle": "Mark as false positive",
  "panel.fpHelp":
    "This issue stops counting on this screen in every later build and device. You can restore it from the list of false positives.",
  "panel.why": "Why (optional)",
  "panel.fpDone": "Marked as false positive",
  "panel.allowSmall": "Allow small changes",
  "panel.ignoreElement": "Ignore element",
  "panel.element": "Element",
  "panel.elementPlaceholder": "Type to search: Pay, balance, toolbar…",
  "panel.foundBy": "Found by {by}, outlined on the screenshot",
  "panel.noElements": "This screenshot has no elements to choose from",
  "panel.hideSelector": "Hide selector",
  "panel.matchDifferently": "Match differently",
  "panel.selector": "Selector",
  "panel.selectorHelp":
    "For a whole kind of element or a pattern: class:ImageButton, text:/\\d+:\\d+/ (any time), id:banner",
  "panel.whatToDo": "What to do",
  "panel.ignoreAnywhere": "Ignore it wherever it is",
  "panel.allowInside": "Allow small changes inside it",
  "panel.share": "Share of the element that may change, %",
  "panel.where": "Where",
  "panel.thisScreenOf": "This screen ({name})",
  "panel.everyScreen": "Every screen of the project",
  "panel.addRule": "Add rule",

  // groups
  "groups.textOf": "Text of {element}: “{before}” → “{after}”",
  "groups.labelOf": "Label of {element}: “{before}” → “{after}”",
  "groups.appeared": "{element} appeared",
  "groups.disappeared": "{element} disappeared",
  "groups.resized": "{element} resized {before} → {after} dp",
  "groups.state": "{element}: {before} → {after}",
  "groups.moved": "{element} moved",
  "groups.intended": "Likely intended",
  "groups.regression": "Possible regression",
  "groups.noise": "Probably noise",
  "groups.open": "Open {name} {variant}",
  "groups.hiddenHelp":
    "Elements changed in ways the screenshot does not show: labels, states, invisible controls",
  "groups.hidden": "{count} hidden",
  "groups.loadFailed": "Cannot load change groups: {error}",
  "groups.ignoreAdded": "Ignore area added; the screenshots are compared again",
  "groups.empty": "Nothing needs a decision in this build",
  "groups.emptyHint":
    "Every screenshot matches its baseline or has been reviewed.",
  "groups.collapse": "Collapse group",
  "groups.expand": "Expand group",
  "groups.newScreenshots": "New screenshots",
  "groups.withoutBaseline": "{count} without a baseline",
  "groups.sameOnScreens": {
    one: "Changed the same way on {count} screens",
    other: "Changed the same way on {count} screens",
  },
  "groups.sameChange": {
    one: "Same change in {count} screenshots",
    other: "Same change in {count} screenshots",
  },
  "groups.oneScreenshot": "1 screenshot",
  "groups.screens": { one: " · {count} screens", other: " · {count} screens" },
  "groups.ignoreStatusBar": "Ignore status bar",
  "groups.ignoreArea": "Ignore this area",
  "groups.rejectAll": "Reject all",
  "groups.reject": "Reject",
  "groups.acceptBaselines": "Accept as baselines",
  "groups.approveAll": "Approve all {count}",
  "groups.approve": "Approve",
  "groups.explain": "Explain this change",
  "groups.byRules": "Decided by rules, no AI call",
  "groups.model": "Model: {model}",
  "groups.openFirst": "Open the first one to step through all of them",
  "groups.more": "+ {count} more",
  "groups.approveTitle": {
    one: "Approve {count} screenshot?",
    other: "Approve {count} screenshots?",
  },
  "groups.rejectTitle": {
    one: "Reject {count} screenshot?",
    other: "Reject {count} screenshots?",
  },
  "groups.approveText":
    "They become the new baselines for their screens and devices.",
  "groups.rejectText":
    "They stay as they are and the build keeps failing until fixed.",
  "groups.working": " Working…",

  // bug
  "bug.filed": "Filed {keys}",
  "bug.linkedAlready": "Filed already, linked: {keys}",
  "bug.titleMany": {
    one: "Create Jira bugs for {count} problems",
    other: "Create Jira bugs for {count} problems",
  },
  "bug.title": "Create Jira bug",
  "bug.task": "Task",
  "bug.looksLike": "Looks like ABC-123",
  "bug.taskHelp":
    "The bug goes under this task, into its project. Remembered for this screen.",
  "bug.issueType": "Issue type",
  "bug.subtask": " (sub-task)",
  "bug.linkAs": "Link to the task as",
  "bug.subtaskOf": "Created as a sub-task of {key}.",
  "bug.andMore": "{summary} and {count} more",
  "bug.fromTask": " (from the task)",
  "bug.problemId":
    "Problem id {code}: in the summary, labels and description, to find the bug in Jira.",
  "bug.problemIdMany":
    "Problem id {code} and one per problem: in the summary, labels and description, to find the bug in Jira.",
  "bug.everyScreen": " One bug for {component} on every screen.",
  "bug.theClass": "the class",
  "bug.labels": "Labels:",
  "bug.description":
    "Description: service, screen, actual and expected result, device, element; screenshot with the problem outlined.",
  "bug.onePerProblem":
    " One bug per problem: the same issue on several elements of one component goes into one bug with all of them.",
  "bug.existingFiled":
    "Filed already as {key} from screen “{screen}”. Creating will not file another one.",
  "bug.existingFiling":
    "A bug is being filed right now from screen “{screen}”. Creating will not file another one.",
  "bug.existingIgnored":
    "Marked as a false positive from screen “{screen}”. Creating will not file another one.",
  "bug.found":
    "Jira has {issues} with {code}: it will be linked instead of filing a new bug.",
  "bug.filedBefore":
    "{code} was filed before as {keys} (done). The problem is back, so a new bug makes sense.",
  "bug.cannotAsk":
    "Jira requires fields Vision cannot ask for here: {fields}. Fill them on {key} or pick another issue type.",
  "bug.progress": "{done} of {total}",
  "bug.cancel": "Cancel",
  "bug.createMany": {
    one: "Create {count} bugs",
    other: "Create {count} bugs",
  },
  "bug.create": "Create bug",
  "bug.typeName": "Type a name",
  "bug.nobody": "Nobody found",
  "bug.searchByName": "Search by name",

  // a11ySummary
  "a11ySummary.empty": "No accessibility data in this build",
  "a11ySummary.emptyHint":
    "Accessibility is checked when a screenshot comes with its Appium page source. In Java or Kotlin add {code} to the TestRunOptions; for manual testing use the CLI (help menu, Manual checks).",
  "a11ySummary.intro":
    "{checked} of {total} screenshots came with a UI tree. Issues are compared with each screen's baseline, so only issues this build introduced count as new. Filed bugs and false positives do not count.",
  "a11ySummary.newIssues": "New issues",
  "a11ySummary.openIssues": "All open issues",
  "a11ySummary.screensChecked": "Screens checked",
  "a11ySummary.screensWithNew": "Screens with new issues",
  "a11ySummary.screen": "Screen",
  "a11ySummary.device": "Device",
  "a11ySummary.new": "New",
  "a11ySummary.open": "Open issues",
  "a11ySummary.screenshot": "Screenshot",

  // insights
  "insights.deleted": {
    one: "Deleted {count} baselines",
    other: "Deleted {count} baselines",
  },
  "insights.title": "Insights",
  "insights.period": "Period",
  "insights.lastDays": "Last {count} days",
  "insights.loadFailed": "Could not load the insights.",
  "insights.partial":
    "Stored history starts on {date} (the oldest build kept: the project is younger, or older builds were removed by its build limit). “Unused” means unused since then.",
  "insights.baselines": "baselines",
  "insights.unusedFor": "unused for {count} days",
  "insights.changedOf": "of {count} runs changed",
  "insights.flips": "flips (changed, then back)",
  "insights.a11yIssues": "accessibility issues",
  "insights.waiting": "waiting for a decision",
  "insights.median": "median time to a decision",
  "insights.hours": "{count} h",
  "insights.unused": "Unused baselines",
  "insights.unusedHint":
    "Nothing was compared with these in the last {count} days: the screen was renamed, removed from the tests, or the device is gone. Deleting a baseline removes its images and history.",
  "insights.unusedHintPartial":
    "Nothing was compared with these in the last {count} days of history: the screen was renamed, removed from the tests, or the device is gone. Deleting a baseline removes its images and history.",
  "insights.selectNone": "Select none",
  "insights.selectAll": "Select all",
  "insights.delete": "Delete {count}",
  "insights.allUsed": "Every baseline was used.",
  "insights.check": "Check",
  "insights.device": "Device",
  "insights.branch": "Branch",
  "insights.lastUsed": "Last used",
  "insights.idleDays": "Idle, days",
  "insights.select": "Select {name}",
  "insights.neverApproved": "never approved",
  "insights.unstable": "Unstable screens",
  "insights.unstableHint":
    "Flips: the screen differed, then matched the same baseline again with nobody changing it. That is the screen moving, not the app: animations, data, timing. Screens that change on most runs or get new baselines often are listed after them.",
  "insights.noUnstable": "No screen changed often enough to stand out.",
  "insights.devices": "Devices",
  "insights.runs": "Runs",
  "insights.changed": "Changed",
  "insights.flipsColumn": "Flips",
  "insights.rejected": "Rejected",
  "insights.newBaselines": "New baselines",
  "insights.lastChange": "Last change",
  "insights.hotspots": "Accessibility hotspots",
  "insights.hotspotsHint":
    "Screens with the most issues in their newest screenshot (the worst device counts), with the bugs filed and false positives marked on them.",
  "insights.noHotspots":
    "No accessibility issues, or no screenshots came with a UI tree.",
  "insights.issues": "Issues",
  "insights.new": "New",
  "insights.bugsFiled": "Bugs filed",
  "insights.falsePositives": "False positives",
  "insights.frequent": "Most frequent issues",
  "insights.frequentHint":
    "Across the newest screenshot of each check: what to fix once, in a shared component or style, to clear many screens.",
  "insights.nothingToRank": "Nothing to rank.",
  "insights.noise": "Noise that gets approved",
  "insights.noiseHint":
    "Tiny changes (under 0.2 %) approved again and again. A tolerance, or an element rule for the part that moves, would stop sending them to review.",
  "insights.noNoise": "No screen keeps getting tiny changes approved.",
  "insights.tinyApproved": "{count} tiny changes approved in {runs} runs",
  "insights.quality": "Hidden changes",
  "insights.qualityHint":
    "Screens whose elements changed in ways the pixels did not show, run after run.",
  "insights.noQuality": "No screen stands out.",
  "insights.withHidden": "{count} with hidden changes",
  "insights.ofRuns": "of {count} runs",
  "insights.coverage": "Device coverage",
  "insights.coverageHint":
    "Checks that run on other devices of the main branch but not on this one.",
  "insights.fullCoverage": "Every device runs every check.",
  "insights.missing": "{device}: {missing} missing of {total}",
  "insights.deleteTitle": {
    one: "Delete {count} baselines?",
    other: "Delete {count} baselines?",
  },
  "insights.deleteSubmit": "Delete",
  "insights.deleteText":
    "Their images and history go too. A check that runs again later comes back as new.",

  // role
  "role.admin": "Admin",
  "role.editor": "Editor",
  "role.guest": "Guest",

  // profile
  "profile.userUpdated": "User updated",
  "profile.passwordUpdated": "Password updated",
  "profile.title": "Profile",
  "profile.details": "User details",
  "profile.firstName": "First name",
  "profile.lastName": "Last name",
  "profile.validEmail": "Enter valid email address",
  "profile.email": "Email address",
  "profile.update": "Update",
  "profile.changePassword": "Change password",
  "profile.newPassword": "New password",
  "profile.examples": "Configuration examples",
  "profile.configFile": "Config file",
  "profile.env": "ENV variables",
  "profile.configHelp":
    "Save as vrt.json in project root. Could be overridden with ENV variables",
  "profile.envHelp": "Add Environment variables inside CI environment",
  "profile.apiKey": "Api key",
  "profile.apiKeyHelp": "For the SDK, the CLI and the MCP server.",
  "profile.hide": "Hide",
  "profile.show": "Show",
  "profile.hideKey": "Hide API key",
  "profile.showKey": "Show API key",
  "profile.copied": "Copied",
  "profile.copy": "Copy",
  "profile.copyKey": "Copy API key",
  "profile.jiraRemoved": "Jira token removed",
  "profile.jiraSaved": "Jira token saved",
  "profile.jiraIntro":
    "Your own token: accessibility bugs are filed as you, and Jira is searched with your rights. Server or Data Center: a personal access token. Jira Cloud: an API token and your account email.",
  "profile.jiraEmail": "Email (Jira Cloud only)",
  "profile.newToken": "New token",
  "profile.token": "Token",
  "profile.tokenReplace": "Saved; type to replace",
  "profile.tokenSaved": "A token is saved. It is never shown again.",
  "profile.tokenNotSet":
    "Not set: Jira works only where the project has a shared token.",
  "profile.save": "Save",
  "profile.removeToken": "Remove token",
  "profile.geminiIntro":
    "Your own key from Google AI Studio: AI drafts bugs from the comparison on it, so what it costs is yours to decide.",
  "profile.geminiGetKey": "Get a key",
  "profile.geminiKey": "Gemini API key",
  "profile.newKey": "New key",
  "profile.geminiKeySaved": "A key is saved. It is never shown again.",
  "profile.geminiKeyNotSet":
    "Not set: you fill bugs from the comparison in yourself.",
  "profile.geminiSaved": "Gemini key saved",
  "profile.geminiRemoved": "Gemini key removed",
  "profile.removeKey": "Remove key",
  "reportBug.needGeminiKey":
    "Add your Gemini API key in your profile to let AI fill these.",
  "reportBug.openProfile": "Open profile",
  "profile.appearance": "Appearance",
  "profile.appearanceHelp":
    "Follows the system until you choose. Remembered in this browser.",
  "profile.system": "System",
  "profile.light": "Light",
  "profile.dark": "Dark",
  "profile.password": "Password",
  "profile.togglePassword": "toggle password visibility",

  // users
  "users.title": "Users",
  "users.people": { one: "{count} person", other: "{count} people" },
  "users.search": "Search people",
  "users.email": "Email",
  "users.firstName": "First name",
  "users.lastName": "Last name",
  "users.lastSignIn": "Last sign-in",
  "users.role": "Role",
  "users.updated": "Updated",
  "users.setPasswordHelp":
    "Set a password for the selected user (after a restore, people have none).",
  "users.setPasswordFor": "Set password for {email}",
  "users.setPasswordTitle": "Set password",
  "users.passwordSet": "Password set",
  "users.newPassword": "New password",
  "users.deleteRows": "Delete selected rows.",
  "users.notYourself": "You cannot delete yourself.",
  "users.removed": "Removed",

  // backups
  "backups.never": "never",
  "backups.lastDaysLabel": "Last {count} days: {missed} without a backup",
  "backups.dayKept": "{date}: backed up",
  "backups.dayMissing": "{date}: no backup",
  "backups.dayOld": "{date}: older than the kept copies",
  "backups.lastDays": "Last {count} days",
  "backups.missed": " · {count} without a backup",
  "backups.noneMissed": " · none missed",
  "backups.requested": "Backup asked for; it starts within 5 minutes",
  "backups.scheduleSaved": "Backup schedule saved",
  "backups.title": "Backups",
  "backups.now": "Back up now",
  "backups.unavailable":
    "Backups cannot be set up from here yet: update Vision with ./scripts/vision.sh up -d --build, then reload this page.",
  "backups.status": "Status",
  "backups.lastAttemptError": "Last attempt: {error}",
  "backups.lastSuccess": "Last successful backup:",
  "backups.lastAttempt": "Last attempt: {when}",
  "backups.waitingUpload": "Waiting for upload: {count}",
  "backups.running": "A backup is running since {when}.",
  "backups.askedAt":
    "Asked for at {when}; the server starts it within 5 minutes.",
  "backups.schedule": "Schedule",
  "backups.dailyAt": "Back up every day at",
  "backups.dailyAtHelp": "Server time",
  "backups.keep": "Keep in Drive",
  "backups.keepUnit": { one: "copy", other: "copies" },
  "backups.keepHelp": "Older database copies are deleted",
  "backups.save": "Save",
  "backups.inDrive": "In Google Drive",
  "backups.backup": "Backup",
  "backups.uploaded": "Uploaded",
  "backups.size": "Size",
  "backups.noneInDrive": "No backups in Drive yet.",
  "backups.driveConnectedAs": "Google Drive connected as {email}",
  "backups.connected":
    "Connected as {email}. Backups go to the folder {folder} on its My Drive; Vision sees only the files it made there.",
  "backups.unknownAccount": "unknown account",
  "backups.reachable": "The backup folder is reachable",
  "backups.test": "Test connection",
  "backups.disconnect": "Disconnect",
  "backups.openUrl":
    "Open {url} on any device, sign in with your work Google account and enter:",
  "backups.waitingCode":
    "Waiting for the confirmation; the code works until {time}.",
  "backups.cancel": "Cancel",
  "backups.clientHelp":
    "An OAuth client of the type “TVs and Limited Input devices” from the bank's Google Cloud project (DEPLOY.md, backups). The secret stays on the server and is never shown again.",
  "backups.clientId": "Client ID",
  "backups.clientSecret": "Client secret",
  "backups.startAgain": "Start again",
  "backups.connect": "Connect",
  "backups.open": "Open Backups",

  // auth
  "auth.sso": "Sign in with SSO",
  "auth.validEmail": "Enter a valid email.",
  "auth.email": "Email address",
  "auth.signIn": "Sign in",
  "auth.noAccount": "No account?",
  "auth.createOne": "Create one",
  "auth.created": "Successfully created account.",
  "auth.firstName": "First name",
  "auth.lastName": "Last name",
  "auth.createAccount": "Create account",
  "auth.haveAccount": "Have an account?",
  "auth.createTitle": "Create an account",

  // brand
  "brand.tagline": BRAND.tagline,

  // tour
  "tour.take": "Take a tour",
  "tour.back": "Back",
  "tour.close": "Close",
  "tour.last": "Last",
  "tour.next": "Next",
  "tour.skip": "Skip",
  "tour.loginAdmin":
    "Default admin account: visual-regression-tracker@example.com / 123456. Make sure to change default password.",
  "tour.loginRegister": "Create new account without restrictions.",
  "tour.projectListTitle": "Project List",
  "tour.projectList":
    "Default project is created after first start, feel free to edit/add/delete projects.",
  "tour.selectProject":
    "Select the project for which you want to view details.",
  "tour.buildList": "List of Builds",
  "tour.noBuilds":
    "If you see 'No Builds', please run your image comparison from any client.",
  "tour.buildDetails": "Brief details for selected build.",
  "tour.testRuns": "TestRuns for selected build.",
  "tour.variationsTitle":
    "Shows all the historical record of baselines by Name + Branch + OS + Browser + Viewport + Device",
  "tour.variationsProject": "Select the project you want to act on.",
  "tour.mergeTitle": "Merge from one branch to another",
  "tour.merge":
    "Open Merge branches and select the branch from/to which you want to merge the variations.",
  "tour.filtered":
    "Only filtered items are displayed/merged to the target branch.",

  // undo
  "undo.approved": "Approved",
  "undo.rejected": "Rejected",
  "undo.approvedMany": {
    one: "Approved {count} screenshots",
    other: "Approved {count} screenshots",
  },
  "undo.rejectedMany": {
    one: "Rejected {count} screenshots",
    other: "Rejected {count} screenshots",
  },
  "undo.undone": "Undone",
  "undo.failed": "Could not undo: {error}",
  "undo.undo": "Undo",

  // states
  "states.tryAgain": "Try again",
  "states.routeError": "Something went wrong on this page.",

  // manual
  "manual.copied": "Copied",
  "manual.copy": "Copy",
  "manual.copyCommand": "Copy command",
  "manual.title": "Manual checks",
  "manual.intro":
    "Send the screen you are testing to {brand}: it is compared with the baseline of the check, and accessibility issues, hidden changes and wrong screens are reported, with a link to the review. Needs Python 3; adb for an Android device or emulator, or an Appium session for iOS.",
  "manual.step1": "Get the CLI",
  "manual.step2": "Connect it, once",
  "manual.keyHelp":
    "The key is yours (profile page); sending needs the editor role. Checks go to the branch “manual” and are compared with the main branch’s baselines. To compare with the autotests’ baselines pixel by pixel, add --device and --os named as in the autotests.",
  "manual.step3": "Check a screen",
  "manual.sources":
    "From the connected Android device. Other sources: --serial for one of several devices, --appium http://127.0.0.1:4723 for an Appium session (Android or iOS), --simulator for the iOS simulator (screenshot only), --png file.png --xml file.xml for saved files. A state of a screen is its own check: “Payment – error”.",
  "manual.many": "Many screens in one build",
  "manual.mcp": "From an AI assistant (MCP)",
  "manual.mcpHelp":
    "Any MCP client can run “python3 vision.py mcp” as a stdio server. Its tools: vision_check, vision_devices, vision_session.",
  "manual.close": "Close",

  // groups
  "groups.alsoElsewhere":
    "The component changed the same way on {runs} too, but those changed elsewhere as well and are reviewed on their own.",
  "groups.uiTree": "UI TREE",

  // panel
  "panel.sameIssue": {
    one: "The same issue on {count} elements of {component}: one problem, one bug.",
    other:
      "The same issue on {count} elements of {component}: one problem, one bug.",
  },

  // device
  "device.none": "No device",

  // device
  "device.os": "OS: {value}",
  "device.device": "Device: {value}",
  "device.browser": "Browser: {value}",
  "device.viewport": "Viewport: {value}",

  // builds
  "builds.summary": "{changed} changed · {passed} passed",
  "builds.summaryFailed": " · {count} failed",

  // review
  "review.tolerance": "tol. {value}%",

  // severity
  "severity.error": "error",
  "severity.warning": "warning",
  "severity.info": "info",

  // panel
  "panel.removeProjectRuleTitle": "Remove a rule for every screen?",
  "panel.removeProjectRuleText":
    "{selector} applies to every screen of the project. Without it, this screenshot and the rest of the build are compared again.",
  "panel.removeRule": "Remove rule",

  // selecting elements on the screenshots (spec 024)
  "select.button": "Select elements",
  "select.selecting": "Selecting…",
  "select.hint": "Click an element",
  "select.done": "Done",
  "select.parent": "Select the element around it",
  "select.child": "Back to the inner element",
  "select.more": "Match differently",
  "select.ignore": "Ignore",
  "select.compare": "Compare only",
  "select.allow": "Allow {percent}%",
  "select.thisScreen": "This screen",
  "select.allScreens": "All screens",
  "select.compareOneScreen":
    "Compare only is for one screen: each check names its own elements",
  "select.onScreen": "{count} on this screen",
  "select.selected": "{count} selected",
  "select.ruleIgnore": "Ignored",
  "select.ruleTolerate": "Allowed ±{percent}%",
  "select.ruleCompare": "Compared only",
  "select.remove": "Remove rule",
  "select.confirmRemove": "Remove on every screen",
  "select.noTree": "No UI tree on this screenshot",
  "select.why": "Why?",
  "select.whyText":
    "The test sent the screenshot without the page source, so there are no elements to pick. Tests send it with uiTree in the SDK.",
  "select.drawArea": "Draw an area",
  "select.added": {
    one: "Rule added; compared again",
    other: "{count} rules added; compared again",
  },
  "select.removed": "Rule removed; compared again",
  "rules.show": "Show rules on screenshots",
  "rules.hide": "Hide rules on screenshots",

  // pixel areas, behind one button (spec 024)
  "areas.button": "Areas",
  "areas.title": "Pixel areas",
  "areas.ignore": "Ignore",
  "areas.compare": "Compare",
  "areas.draw": "Draw",
  "areas.delete": "Delete",
  "areas.clear": "Clear",
  "areas.toBuild": "To whole build",
  "areas.useElement": "Use element",
  "areas.useElementHelp":
    "Replace with a rule for {element}: it follows the element when the layout moves",
  "areas.fromTest": "Sent by the test",
  "areas.fromTestHelp": "change them in the test code",
  "areas.area": "Area {width} × {height}",
  "areas.save": "Save areas",
  "areas.discard": "Discard",
  "areas.unsavedTitle": "Save the areas?",
  "areas.unsavedText":
    "Areas on this screenshot changed and are not saved yet.",
  "areas.replaced": "Area replaced with a rule for {element}; compared again",

  // what is compared (spec 024)
  "compared.whole": "Whole screen",
  "compared.except": "Whole screen except {count}",
  "compared.only": {
    one: "Only {count} element",
    other: "Only {count} elements",
  },
  "compared.areas": {
    one: "· without {count} area",
    other: "· without {count} areas",
  },
  "compared.allScreens": "all screens",
  "compared.found":
    "{selector} · {current} found here, {baseline} on the baseline",
  "compared.more": "More actions",
  "compared.problem.noTree":
    "No UI tree: only the named elements could not be compared",
  "compared.problem.nothingFound": "{selector} found nothing",
  "compared.problem.disappeared": "{element} disappeared",
  "compared.problem.appeared": "{element} appeared",
  "compared.problem.count":
    "{selector}: {baseline} on the baseline, {current} now",
  "compared.problem.resized": "{element} changed size",
  "reportBug.title": "Report bug",
  "reportBug.open": "Report bug",
  "reportBug.openHelp": "File a Jira bug about this screen. Hotkey: B",
  "reportBug.needToken":
    "Add your Jira token in your profile to file bugs from here.",
  "reportBug.checkpoint": "Checkpoint",
  "reportBug.baseline": "Baseline",
  "reportBug.markArea": "Mark area",
  "reportBug.pickElement": "Pick element",
  "reportBug.areaAt": "{width} × {height} px at {x}, {y}",
  "reportBug.removeMark": "Remove mark",
  "reportBug.markHint":
    "Drag on the screenshot or pick an element to show where the problem is.",
  "reportBug.marksOnCheckpoint": "Marks go on the checkpoint.",
  "reportBug.note": "What is wrong? In your words, for AI",
  "reportBug.notePlaceholder":
    "e.g. the Pay button is cut off at the bottom; “Total due” is intended",
  "reportBug.add": "Add:",
  "reportBug.quick.cutOff": "Cut off",
  "reportBug.quick.overlaps": "Overlaps",
  "reportBug.quick.unchanged": "Should not have changed",
  "reportBug.quick.wrongText": "Wrong text",
  "reportBug.quick.missing": "Missing",
  "reportBug.quick.misaligned": "Not aligned",
  "reportBug.changesItLooksAt": "Changes it looks at",
  "reportBug.aiGets":
    "Gemini gets your note, the baseline and checkpoint cut around {areas} area(s), {changes} ticked change(s) and the check’s name. Not the whole screenshots, not your tokens.",
  "reportBug.fillWithAi": "Fill with AI",
  "reportBug.askAgain": "Ask again",
  "reportBug.drafting": "Drafting…",
  "reportBug.aiFailed":
    "AI did not fill the bug: {error}. Your note and fields are kept; fill in the rest yourself.",
  "reportBug.aiTag": "AI",
  "reportBug.field.essence": "Summary",
  "reportBug.field.environment": "Environment",
  "reportBug.field.steps": "Steps",
  "reportBug.field.actual": "Actual result",
  "reportBug.field.expected": "Expected result",
  "reportBug.stepsPlaceholder": "1. …\n2. Open the screen of the feature",
  "reportBug.screenshots":
    "The marked checkpoint goes into the actual result, the baseline into the expected one.",
  "reportBug.screenshotsNoBaseline":
    "The marked checkpoint goes into the actual result; this check has no baseline yet.",
  "reportBug.visionAdds":
    "Vision adds the check, the build and a link back to this review, labels the bug “vision” and copies the customer from the task.",
  "reportBug.alsoReject": "Also reject the checkpoint",
  "reportBug.missing": {
    one: "1 required field left: {fields}",
    other: "{count} required fields left: {fields}",
  },
  "reportBug.creating": "Creating…",
  "reportBug.filed": "Filed {key}",
  "reportBug.filedRejected": "Filed {key} · checkpoint rejected",
  "reportBug.openInJira": "Open in Jira",
  "reportBug.rejectFailed":
    "{key} is filed, but the checkpoint was not rejected: {error}",
  "reportBug.bugsForScreen": "Bugs for this screen",
  "reportBug.filedFrom": "Filed {date}",
  "reportBug.bugMarks": "Bug marks",
  "reportBug.fromChange": "Report bug",
} satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;

export type Messages = Record<MessageKey, Message>;
