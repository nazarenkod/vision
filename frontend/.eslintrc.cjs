module.exports = {
  extends: [
    // By extending from a plugin config, we can get recommended rules without having to add them manually.
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:import/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:@typescript-eslint/recommended",
    // This disables the formatting rules in ESLint that Prettier is going to be responsible for handling.
    // Make sure it's always the last config, so it gets the chance to override other configs.
    "eslint-config-prettier",
  ],
  settings: {
    react: {
      // Tells eslint-plugin-react to automatically detect the version of React to use.
      version: "detect",
    },
    // Tells eslint how to resolve imports
    "import/resolver": {
      typescript: {
        project: ["tsconfig.json", "integration_tests/tsconfig.json"],
      },
    },
  },
  rules: {
    // Add your own rules here to override ones from the extended configs.
    "@typescript-eslint/no-non-null-assertion": "warn",
  },
  overrides: [
    {
      // Colours come from theme.ts, so both themes get them (ADR-0015).
      files: ["src/components/**/*.{ts,tsx}", "src/pages/**/*.{ts,tsx}"],
      excludedFiles: ["**/*.test.{ts,tsx}"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
            message:
              "Take colours from tokens in theme.ts (ADR-0015): a hex colour works in one theme only.",
          },
          {
            selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
            message:
              "Take colours from tokens in theme.ts (ADR-0015): a hex colour works in one theme only.",
          },
        ],
      },
    },
  ],
};
