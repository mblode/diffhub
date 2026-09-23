import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react, next],
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
    // Base UI Button render prop pattern provides content via children, not the anchor itself
    "jsx-a11y/anchor-has-content": "off",
    "jsx-a11y/control-has-associated-label": "off",
    "prefer-named-capture-group": "off",
    "require-unicode-regexp": "off",
    "sort-keys": "off",
    // React components use PascalCase filenames by convention
    "unicorn/filename-case": ["error", { cases: { kebabCase: true, pascalCase: true } }],
  },
});
