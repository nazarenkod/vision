// ESLint 9 flat config; the same rule sets as the old .eslintrc.cjs.
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const hexColour =
  "Take colours from tokens in theme.ts (ADR-0015): a hex colour works in one theme only.";

// The type and corner scales of spec 046 (REQ-046-10, 11): one size between two
// steps is how a page starts to look assembled from different apps.
const offScale = (values) =>
  values.map((value) => `:not([value=${value}])`).join("");
const NUMBER = "Literal[raw=/^[0-9]*\\.?[0-9]+$/]";
const WITH_UNIT = "Literal[value=/^-?[0-9]*\\.?[0-9]+(px|rem|em|pt|%)$/]";
const typeSize =
  "Font sizes come from the scale: type.page/section/title/body/small/caption in theme.ts (28/20/16/14/13/12), or a Typography variant.";
const typeWeight = "Font weights are 400, 500, 600 or 700 only (spec 046).";
const cornerRadius =
  "Corners come from radius.control/card/pill in theme.ts (6/12/999 px). A bare number in sx is multiplied by the theme's corner unit, so write radius.* instead.";
const scaleRules = [
  {
    selector: `Property[key.name='fontSize'] ${NUMBER}${offScale([28, 20, 16, 14, 13, 12])}`,
    message: typeSize,
  },
  {
    selector: `Property[key.name='fontSize'] ${WITH_UNIT}`,
    message: typeSize,
  },
  {
    selector: `JSXAttribute[name.name='fontSize'] ${NUMBER}${offScale([28, 20, 16, 14, 13, 12])}`,
    message: typeSize,
  },
  {
    selector: `:matches(Property[key.name='fontWeight'], JSXAttribute[name.name='fontWeight']) ${NUMBER}${offScale([400, 500, 600, 700])}`,
    message: typeWeight,
  },
  {
    // a bare 0 squares a corner off; any other number is a radius off the scale
    selector: `:matches(Property[key.name=/^border(Top|Bottom)?(Left|Right)?Radius$/], JSXAttribute[name.name='borderRadius']) ${NUMBER}:not([value=0])`,
    message: cornerRadius,
  },
  {
    selector: `:matches(Property[key.name=/^border(Top|Bottom)?(Left|Right)?Radius$/], JSXAttribute[name.name='borderRadius']) ${WITH_UNIT}:not([value="6px"]):not([value="12px"]):not([value="999px"])`,
    message: cornerRadius,
  },
];

export default [
  {
    ignores: [
      "build/",
      "coverage/",
      "dist/",
      "node_modules/",
      "vendor/",
      "test-results/",
      "playwright-report/",
      "public/env-config.js",
    ],
  },
  js.configs.recommended,
  react.configs.flat.recommended,
  // hooks live in src; Playwright fixtures call their own use(), which is no React hook
  {
    ...reactHooks.configs["recommended-latest"],
    files: ["src/**/*.{js,jsx,ts,tsx}"],
  },
  importPlugin.flatConfigs.recommended,
  jsxA11y.flatConfigs.recommended,
  ...tsPlugin.configs["flat/recommended"],
  {
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...globals.jest },
    },
    settings: {
      // eslint-plugin-react finds the React version itself
      react: { version: "detect" },
      "import/resolver": {
        typescript: {
          project: ["tsconfig.json", "integration_tests/tsconfig.json"],
        },
      },
    },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },
  {
    // Colours come from theme.ts, so both themes get them (ADR-0015).
    files: ["src/components/**/*.{ts,tsx}", "src/pages/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message: hexColour,
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
          message: hexColour,
        },
        ...scaleRules,
      ],
    },
  },
  // Prettier owns formatting: last, so it switches off what the sets above turned on.
  prettier,
];
