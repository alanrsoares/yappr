import eslint from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "python/**",
      "docs/**",
      "node_modules/**",
      "**/node_modules/**",
      "apps/*/dist/**",
      "apps/*/build/**",
      "packages/*/dist/**",
      "bun.lock",
      "openapi.json",
      "packages/sdk/src/schema.d.ts",
      "**/*.config.js",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          disallowTypeAnnotations: false,
          fixStyle: "inline-type-imports",
          prefer: "type-imports",
        },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-implicit-coercion": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/*"],
              message: "Use the package-local ~/ alias instead of @/.",
            },
          ],
        },
      ],
      "no-useless-return": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // React 17+ JSX transform doesn't require React in scope
      "react/react-in-jsx-scope": "off",
      // Allow intentionally unused vars/args with _ prefix
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Vendor UI primitives generated from shadcn/prompt-kit registries.
  // Patterns like Math.random() for skeleton widths and custom data attributes
  // are upstream conventions, not bugs.
  {
    files: ["apps/*/src/**/ui/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/purity": "off",
      "react/no-unknown-property": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
);
