import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  {
    ignores: [
      "dist",
      "dist-*",
      "build",
      "coverage",
      "public",
      "store",
      "storybook-static",
      "node_modules",
      "tooling",
      ".classic-src",
      "scripts/**/*.js",
      "scripts/**/*.mjs",
      "scripts/**/*.cjs",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...tsPlugin.configs["eslint-recommended"].overrides[0].rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      // Type-gap casts around discord-core fields (thread_metadata,
      // message_snapshots, ...) are pervasive; typing them is its own pass.
      "@typescript-eslint/no-explicit-any": "off",
      // Fast-refresh hygiene only; several modules intentionally co-export helpers.
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**", "cypress/**", "src/**/*.stories.tsx"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
    },
  },
  {
    files: ["cypress/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { cy: "readonly", Cypress: "readonly", expect: "readonly", assert: "readonly" },
    },
  },
];
