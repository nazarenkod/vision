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
  { ...reactHooks.configs["recommended-latest"], files: ["src/**/*.{js,jsx,ts,tsx}"] },
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
      ],
    },
  },
  // Prettier owns formatting: last, so it switches off what the sets above turned on.
  prettier,
];
