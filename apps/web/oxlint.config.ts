import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react, next],
  rules: {
    // Base UI Button render prop pattern provides content via children, not the anchor itself
    "jsx-a11y/anchor-has-content": "off",
    "jsx-a11y/control-has-associated-label": "off",
    "prefer-named-capture-group": "off",
    "react/react-compiler": "off",
    "require-unicode-regexp": "off",
    "sort-keys": "off",
    // React components use PascalCase filenames by convention
    "unicorn/filename-case": ["error", { cases: { kebabCase: true, pascalCase: true } }],
  },
});
