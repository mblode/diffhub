import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, react, next, vitest],
  overrides: [
    {
      // These modules are ports of the diffshub reference and keep its camelCase
      // filenames so they stay easy to diff against upstream.
      files: ["lib/diff-stream/*.ts"],
      rules: {
        "unicorn/filename-case": "off",
      },
    },
  ],
  rules: {
    // oxlint split "react/react-compiler" (off here before) into one rule per
    // React Compiler diagnostic. These are the ones that fire; same decision.
    "react/exhaustive-effect-dependencies": "off",
    // New in ultracite 7.12. It fights Next's `export default function Page`
    // convention and flags forwardRef/memo render callbacks; style-only.
    "react/function-component-definition": "off",
    "react/refs": "off",
    "react/rule-suppression": "off",
    "react/set-state-in-effect": "off",
    "react/todo": "off",
    // Streaming, polling and CLI process management are intentionally
    // sequential; the remaining rules are mechanical style churn in tests and
    // established React ref patterns.
    "jsx-a11y/prefer-tag-over-role": "off",
    "no-await-in-loop": "off",
    "prefer-named-capture-group": "off",
    "react/display-name": "off",
    "require-unicode-regexp": "off",
    "sort-keys": "off",
    "typescript/method-signature-style": "off",
    // React components use PascalCase filenames by convention
    "unicorn/filename-case": ["error", { cases: { kebabCase: true, pascalCase: true } }],
    "unicorn/import-style": "off",
    "unicorn/prefer-number-coercion": "off",
    "vitest/max-expects": "off",
  },
});
