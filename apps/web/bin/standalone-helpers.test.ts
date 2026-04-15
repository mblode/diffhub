import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findMissingStandaloneNodeModuleAliases,
  materializeStandaloneNodeModuleAliases,
} from "./standalone-helpers.mjs";

const tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "diffhub-standalone-"));
  tempDirs.push(dir);
  return dir;
};

describe("standalone helpers", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("materializes traced node module aliases into real directories", () => {
    const standaloneDir = createTempDir();
    const realPackageDir = join(standaloneDir, "node_modules", "shiki");
    mkdirSync(join(realPackageDir, "dist"), { recursive: true });
    writeFileSync(join(realPackageDir, "package.json"), '{"name":"shiki"}');
    writeFileSync(join(realPackageDir, "dist", "wasm.mjs"), "export default 'wasm';");

    const aliasPath = join(standaloneDir, ".next", "node_modules", "shiki-43d062b67f27bbdc");
    mkdirSync(join(standaloneDir, ".next", "node_modules"), { recursive: true });
    symlinkSync(realPackageDir, aliasPath, "dir");

    const aliases = materializeStandaloneNodeModuleAliases(standaloneDir);

    expect(aliases).toStrictEqual([".next/node_modules/shiki-43d062b67f27bbdc"]);
    expect(readFileSync(join(aliasPath, "package.json"), "utf-8")).toContain('"name":"shiki"');
    expect(readFileSync(join(aliasPath, "dist", "wasm.mjs"), "utf-8")).toContain("wasm");
  });

  it("detects missing traced aliases from nft manifests", () => {
    const standaloneDir = createTempDir();
    const traceDir = join(standaloneDir, ".next", "server", "app", "api", "diff");
    mkdirSync(traceDir, { recursive: true });
    writeFileSync(
      join(traceDir, "route.js.nft.json"),
      JSON.stringify({
        files: [
          "../../../../node_modules/shiki-43d062b67f27bbdc",
          "../../../../node_modules/shiki-43d062b67f27bbdc/dist/wasm.mjs",
        ],
      }),
    );

    expect(findMissingStandaloneNodeModuleAliases(standaloneDir)).toStrictEqual([
      "shiki-43d062b67f27bbdc",
    ]);
  });
});
