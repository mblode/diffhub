#!/usr/bin/env node
import { program } from "commander";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";

const __dirname = import.meta.dirname;

// Fast-fail on unsupported Node.js versions
const nodeMajor = Number.parseInt(process.version.slice(1).split(".")[0], 10);
if (nodeMajor < 18) {
  process.stderr.write(`❌ diffr requires Node.js 18+. You have ${process.version}.\n`);
  process.stderr.write(`   Download: https://nodejs.org\n`);
  process.exit(1);
}

// -- Port utilities ----------------------------------------------------------

// oxlint-disable-next-line promise/avoid-new
const findFreePort = async (start) => {
  for (let p = start; p < start + 10; p += 1) {
    // oxlint-disable-next-line promise/avoid-new
    const free = await new Promise((_resolve) => {
      const s = createServer();
      s.listen(p, () => {
        s.close();
        _resolve(true);
      });
      s.on("error", () => _resolve(false));
    });
    if (free) {
      return p;
    }
  }
  return start;
};

const waitForServer = async (port, maxMs = 15_000) => {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}`);
      if (res.ok || res.status === 404) {
        return true;
      }
    } catch {
      // empty
    }
    // oxlint-disable-next-line promise/avoid-new
    await new Promise((_resolve) => {
      setTimeout(_resolve, 300);
    });
  }
  return false;
};

// -- CLI setup ---------------------------------------------------------------

program
  .name("diffr")
  .description("GitHub PR-style local diff viewer")
  .version("0.1.0")
  .option("-p, --port <port>", "Port to serve on", "2047")
  .option("-r, --repo <path>", "Git repository path (defaults to cwd)")
  .option("-b, --base <branch>", "Base branch to diff against (defaults to main/master)")
  .option("--no-open", "Don't open browser automatically")
  .parse(process.argv);

const opts = program.opts();
const repoPath = resolve(opts.repo ?? process.cwd());
const baseBranch = opts.base ?? "";

// Verify it's a git repo
if (!existsSync(join(repoPath, ".git"))) {
  console.error(`❌ Not a git repository: ${repoPath}`);
  console.error(`   Run from inside a git repo, or pass --repo:`);
  console.error(`   diffr --repo /path/to/your-repo`);
  process.exit(1);
}

// outputFileTracingRoot is set to the monorepo root, so Next.js places the server at
// .next/standalone/apps/web/server.js (mirroring the workspace path).
const appDir = resolve(__dirname, "..");
const serverPath = join(appDir, ".next", "standalone", "apps", "web", "server.js");

if (!existsSync(serverPath)) {
  console.error("❌ No production build found.");
  console.error("   Run: npm run build");
  process.exit(1);
}

const standaloneDir = resolve(serverPath, "..");
const port = await findFreePort(Number.parseInt(opts.port, 10));

// -- Startup banner ----------------------------------------------------------

console.log(`  diffr\n`);
console.log(`  Repo   ${repoPath}`);
if (baseBranch) {
  console.log(`  Base   ${baseBranch}`);
}
console.log(`  URL    http://localhost:${port}`);
console.log(`\n  Press Ctrl+C to stop\n`);

// -- Start server ------------------------------------------------------------

const server = spawn("node", ["server.js"], {
  cwd: standaloneDir,
  env: {
    ...process.env,
    DIFFR_REPO: repoPath,
    ...(baseBranch ? { DIFFR_BASE: baseBranch } : {}),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    PORT: String(port),
  },
  stdio: "inherit",
});

server.on("error", (err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});

// -- Open browser when ready -------------------------------------------------

if (opts.open !== false) {
  const url = `http://localhost:${port}`;
  const ready = await waitForServer(port);
  if (ready) {
    const opener =
      { darwin: "open", linux: "xdg-open", win32: "start" }[process.platform] ?? "xdg-open";
    spawn(opener, [url], {
      detached: true,
      shell: process.platform === "win32",
      stdio: "ignore",
    }).unref();
  }
}

// -- Graceful shutdown -------------------------------------------------------

process.on("SIGINT", () => {
  server.kill();
  process.exit(0);
});
