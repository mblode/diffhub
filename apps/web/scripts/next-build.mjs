import { spawnSync } from "node:child_process";
import { cpSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const typescript = path.dirname(path.dirname(require.resolve("typescript")));
const typescript7 = `${typescript}-7-build`;
const typescript5 = path.dirname(path.dirname(require.resolve("typescript-next-build")));
const next = require.resolve("next/dist/bin/next");

renameSync(typescript, typescript7);
cpSync(typescript5, typescript, { recursive: true });

try {
  const result = spawnSync("node", [next, "build"], {
    stdio: "inherit",
  });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(typescript, { force: true, recursive: true });
  renameSync(typescript7, typescript);
}
