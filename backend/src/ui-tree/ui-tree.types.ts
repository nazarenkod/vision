// web: the page's HTML, from the Vision SDK with element positions or a plain page source (050)
export type UiTreeFormat = 'appium-android' | 'appium-ios' | 'web';

export const UI_TREE_FORMATS: UiTreeFormat[] = ['appium-android', 'appium-ios', 'web'];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One element of an Appium page source, normalized across Android
 * (UiAutomator2) and iOS (XCUITest). Bounds are in screenshot pixels, so they
 * can be drawn over the image and compared with diff regions directly.
 */
export interface UiNode {
  index: number;
  parent: number | null;
  depth: number;
  // stable identity used to match the same element between baseline and current
  key: string;
  // class name on Android, element type on iOS, tag on the web (android.widget.Button, XCUIElementTypeButton, button)
  className: string;
  resourceId: string;
  text: string;
  // content-desc on Android, label on iOS
  label: string;
  // hint on Android, placeholderValue on iOS
  hint: string;
  clickable: boolean;
  focusable: boolean;
  enabled: boolean;
  visible: boolean;
  // false only when the platform says so explicitly (iOS accessible="false")
  accessible: boolean;
  // absent on trees stored before these were read
  checked?: boolean;
  selected?: boolean;
  // web only: the ARIA role, given or implied by the tag (button, link, textbox…)
  role?: string;
  bounds: Rect;
}

export interface UiTree {
  format: UiTreeFormat;
  // screenshot pixels per tree unit: 1 on Android, 2–3 on iOS (points → pixels)
  scale: number;
  // screen width/height in screenshot pixels
  width: number;
  height: number;
  // screenshot pixels per dp (Android) or pt (iOS)
  pixelsPerDp: number;
  pixelsPerDpEstimated: boolean;
  // Android activity the screen belongs to, when the client sent it
  activity?: string;
  // false for a web page source without the SDK's positions: every bounds is empty (REQ-050-09)
  positioned?: boolean;
  nodes: UiNode[];
}
