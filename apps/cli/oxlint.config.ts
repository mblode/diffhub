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
    // React components use PascalCase filenames by convention
    "unicorn/filename-case": ["error", { cases: { kebabCase: true, pascalCase: true } }],
  },
});
