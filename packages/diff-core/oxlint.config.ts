import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react, next],
  overrides: [
    {
      // These modules are ports of the diffshub reference and keep its camelCase
      // filenames so they stay easy to diff against upstream.
      files: ["src/stream/*.ts"],
      rules: {
        "unicorn/filename-case": "off",
      },
    },
  ],
  rules: {
    // Intentional public entry points for the package.
    "no-barrel-file": "off",
    // React components use PascalCase filenames by convention.
    "unicorn/filename-case": ["error", { cases: { kebabCase: true, pascalCase: true } }],
  },
});
