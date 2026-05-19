import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");
const outputDir = join(appRoot, "test-results", "visual");
const repoPath = join(outputDir, "fixture-repo");
const repoPathFile = join(outputDir, "fixture-repo-path");

const runGit = (args, options = {}) => {
  execFileSync("git", args, {
    cwd: options.cwd ?? repoPath,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stdio: options.stdio ?? "ignore",
  });
};

const write = (path, content) => {
  const absolute = join(repoPath, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
};

const lines = (prefix, count, suffix = "") =>
  Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}${suffix}`).join("\n");

const sourceFile = (name, value) => `export const ${name} = "${value}";\n`;

const makeAnchor = (lineContent, beforeContext = [], afterContext = []) => ({
  afterContext,
  beforeContext,
  fileSha: "fixture",
  lineContent,
});

const comment = (overrides) => ({
  anchor: makeAnchor("// placeholder"),
  body: "Fixture comment",
  createdAt: "2026-05-19T00:00:00.000Z",
  file: "src/alpha.ts",
  id: "comment-fixture",
  lineNumber: 1,
  replies: [],
  resolved: false,
  side: "right",
  staleness: "fresh",
  tag: "",
  ...overrides,
});

rmSync(repoPath, { force: true, recursive: true });
mkdirSync(repoPath, { recursive: true });
mkdirSync(outputDir, { recursive: true });

runGit(["init", "-b", "main"], { cwd: repoPath });
runGit(["config", "user.email", "diffhub@example.test"]);
runGit(["config", "user.name", "DiffHub Visual Fixture"]);

write("src/alpha.ts", sourceFile("alpha", "base"));
write("src/repeated.ts", [
  "export const repeated = [",
  '  "base-a",',
  '  "base-b",',
  '  "base-c",',
  "];",
  "",
].join("\n"));
write("src/resolved.ts", sourceFile("resolved", "base"));
write("src/moved.ts", [
  "export const moved = [",
  '  "before",',
  '  "anchor-target",',
  '  "after",',
  "];",
  "",
].join("\n"));
write("src/stale.ts", [
  "export const stale = [",
  '  "before",',
  '  "removed stale target",',
  '  "after",',
  "];",
  "",
].join("\n"));
write("src/large.ts", `${lines("export const baseLargeLine =", 620, ";")}\n`);

for (let index = 1; index <= 6; index += 1) {
  write(`src/extra-${index}.ts`, sourceFile(`extra${index}`, "base"));
}

runGit(["add", "."]);
runGit(["commit", "-m", "fixture base"]);

write("src/alpha.ts", [
  "export const alpha = {",
  '  status: "changed",',
  '  note: "compact normal comment target",',
  "};",
  "",
].join("\n"));
write("src/repeated.ts", [
  "export const repeated = [",
  '  "changed-a",',
  '  "changed-b",',
  '  "changed-c",',
  '  "changed-d",',
  "];",
  "",
].join("\n"));
write("src/resolved.ts", [
  "export const resolved = {",
  '  state: "done",',
  '  note: "resolved collapsed comment target",',
  "};",
  "",
].join("\n"));
write("src/moved.ts", [
  "export const moved = [",
  '  "new-before",',
  '  "different line at the old anchor",',
  '  "more context",',
  '  "still not the target",',
  '  "anchor-target",',
  '  "new-after",',
  "];",
  "",
].join("\n"));
write("src/stale.ts", [
  "export const stale = [",
  '  "before changed",',
  '  "target disappeared",',
  '  "after changed",',
  "];",
  "",
].join("\n"));
write("src/large.ts", `${lines("export const changedLargeLine =", 620, ";")}\n`);

for (let index = 1; index <= 6; index += 1) {
  write(`src/extra-${index}.ts`, sourceFile(`extra${index}`, `changed-${index}`));
}

const comments = [
  comment({
    anchor: makeAnchor('  note: "compact normal comment target",'),
    body: "Normal compact one-paragraph comment for measuring card height.",
    file: "src/alpha.ts",
    id: "comment-normal-alpha",
    lineNumber: 3,
    tag: "[suggestion]",
  }),
  comment({
    anchor: makeAnchor('  "changed-a",'),
    body: "First repeated comment on the same file.",
    file: "src/repeated.ts",
    id: "comment-repeat-a",
    lineNumber: 2,
  }),
  comment({
    anchor: makeAnchor('  "changed-b",'),
    body: "Second repeated comment should sit close to the first.",
    file: "src/repeated.ts",
    id: "comment-repeat-b",
    lineNumber: 3,
    tag: "[nit]",
  }),
  comment({
    anchor: makeAnchor('  "changed-c",'),
    body: "Third repeated comment keeps the list dense.",
    file: "src/repeated.ts",
    id: "comment-repeat-c",
    lineNumber: 4,
    tag: "[question]",
  }),
  comment({
    anchor: makeAnchor('  note: "resolved collapsed comment target",'),
    body: "Resolved collapsed comment row.",
    file: "src/resolved.ts",
    id: "comment-resolved",
    lineNumber: 3,
    resolved: true,
    resolvedAt: "2026-05-19T00:30:00.000Z",
    resolvedBy: "visual-fixture",
  }),
  comment({
    anchor: makeAnchor('  "anchor-target",'),
    body: "Moved metadata remains compact and legible.",
    file: "src/moved.ts",
    id: "comment-moved",
    lineNumber: 3,
    staleness: "moved",
    tag: "[must-fix]",
  }),
  comment({
    anchor: makeAnchor('  "removed stale target",'),
    body: "Stale metadata remains compact and legible.",
    file: "src/stale.ts",
    id: "comment-stale",
    lineNumber: 3,
    staleness: "stale",
  }),
  comment({
    anchor: makeAnchor("export const changedLargeLine = 580;"),
    body: "Large deferred file navigation target.",
    file: "src/large.ts",
    id: "comment-large-deferred",
    lineNumber: 580,
    tag: "[suggestion]",
  }),
];

writeFileSync(join(repoPath, ".git", "diffhub-comments.json"), JSON.stringify(comments, null, 2));
writeFileSync(repoPathFile, repoPath);

console.info(`[diffhub:e2e] fixture repo: ${repoPath}`);
