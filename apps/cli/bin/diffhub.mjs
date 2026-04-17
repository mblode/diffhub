#!/usr/bin/env node
import { watch } from "chokidar";
import { program } from "commander";
import { execFile as execFileCb, execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  findMissingStandaloneNodeModuleAliases,
  syncStandaloneAssets,
} from "./standalone-helpers.mjs";

const execFile = promisify(execFileCb);
const __dirname = import.meta.dirname;
const PREFERRED_BASE_BRANCHES = ["main", "master", "develop", "dev"];

// Fast-fail on unsupported Node.js versions
const [nodeMajor, nodeMinor] = process.versions.node
  .split(".")
  .slice(0, 2)
  .map((value) => Number.parseInt(value, 10));
const isSupportedNode =
  Number.isFinite(nodeMajor) &&
  Number.isFinite(nodeMinor) &&
  (nodeMajor > 20 || (nodeMajor === 20 && nodeMinor >= 11));

if (!isSupportedNode) {
  process.stderr.write(`❌ diffhub requires Node.js 20.11+. You have ${process.version}.\n`);
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
      s.listen(p, "127.0.0.1", () => {
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

const waitForServer = async (
  port,
  maxMs = 15_000,
  expectedPid = null,
  expectedBootId = null,
  expectedRepoPath = null,
) => {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) {
        const data = await res.json();
        const bootMatches = expectedBootId === null || data.bootId === expectedBootId;
        const repoMatches = expectedRepoPath === null || data.repoPath === expectedRepoPath;
        if (!bootMatches || !repoMatches) {
          // wrong server on the fixed port
        } else if (expectedPid === null) {
          return true;
        } else {
          const pids = await getListeningPids(port);
          if (pids.includes(expectedPid)) {
            return true;
          }
        }
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

// -- Shared setup ------------------------------------------------------------

const appDir = resolve(__dirname, "..");
const serverPath = join(appDir, ".next", "standalone", "apps", "cli", "server.js");
const standaloneDir = resolve(serverPath, "..");
const CMUX_PATH = "/Applications/cmux.app/Contents/Resources/bin/cmux";

const findRepoRoot = (startPath) => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: startPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
};

const validateRepo = (inputPath) => {
  const root = findRepoRoot(inputPath);
  if (!root) {
    console.error(`❌ Not a git repository: ${inputPath}`);
    console.error(`   Run from inside a git repo, or pass --repo:`);
    console.error(`   diffhub --repo /path/to/your-repo`);
    process.exit(1);
  }
  return root;
};

const validateBuild = () => {
  if (!existsSync(serverPath)) {
    console.error("❌ No production build found.");
    console.error("   Run: npm run build");
    process.exit(1);
  }
};

const getCmuxServerLogPath = (repoPath) => {
  const hash = createHash("md5").update(repoPath).digest("hex").slice(0, 8);
  return join(tmpdir(), `diffhub-cmux-${hash}.log`);
};

const getCmuxWriterPidPath = (repoPath) => {
  const hash = createHash("md5").update(repoPath).digest("hex").slice(0, 8);
  return join(tmpdir(), `diffhub-cmux-writer-${hash}.pid`);
};

const createServerBootId = (repoPath, baseBranch) =>
  createHash("sha1")
    .update(`${repoPath}:${baseBranch}:${Date.now()}:${Math.random()}`)
    .digest("hex");

const clearRepoSnapshotFiles = (repoPath) => {
  const prefix = `diffhub-snapshot-${createHash("sha1").update(repoPath).digest("hex")}-`;
  for (const entry of readdirSync(tmpdir())) {
    if (entry.startsWith(prefix)) {
      rmSync(join(tmpdir(), entry), { force: true });
    }
  }
};

const getSnapshotCachePath = (repoPath, base, mode, whitespace) => {
  const cacheKey = JSON.stringify({
    base: base ?? "",
    mode: mode ?? "",
    whitespace: whitespace ?? "",
  });
  const suffix = createHash("sha1").update(cacheKey).digest("hex");
  const prefix = `diffhub-snapshot-${createHash("sha1").update(repoPath).digest("hex")}-`;
  return join(tmpdir(), `${prefix}${suffix}.json`);
};

const runGitSnapshotCommand = async (repoPath, args) => {
  const { stdout } = await execFile("git", args, {
    cwd: repoPath,
    encoding: "utf-8",
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout;
};

const splitGitLines = (output) =>
  output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const parseDiffStats = (raw) => {
  const files = [];
  let insertions = 0;
  let deletions = 0;
  let cursor = 0;

  while (cursor < raw.length) {
    const insertionsEnd = raw.indexOf("\t", cursor);
    if (insertionsEnd === -1) {
      break;
    }

    const deletionsEnd = raw.indexOf("\t", insertionsEnd + 1);
    if (deletionsEnd === -1) {
      break;
    }

    const rawInsertions = raw.slice(cursor, insertionsEnd);
    const rawDeletions = raw.slice(insertionsEnd + 1, deletionsEnd);
    cursor = deletionsEnd + 1;

    let file = "";
    if (raw[cursor] === "\0") {
      cursor += 1;

      const oldPathEnd = raw.indexOf("\0", cursor);
      if (oldPathEnd === -1) {
        break;
      }

      cursor = oldPathEnd + 1;
      const newPathEnd = raw.indexOf("\0", cursor);
      if (newPathEnd === -1) {
        break;
      }

      file = raw.slice(cursor, newPathEnd);
      cursor = newPathEnd + 1;
    } else {
      const fileEnd = raw.indexOf("\0", cursor);
      if (fileEnd === -1) {
        break;
      }

      file = raw.slice(cursor, fileEnd);
      cursor = fileEnd + 1;
    }

    const binary = rawInsertions === "-" || rawDeletions === "-";
    const fileInsertions = binary ? 0 : Number.parseInt(rawInsertions, 10) || 0;
    const fileDeletions = binary ? 0 : Number.parseInt(rawDeletions, 10) || 0;

    files.push({
      binary,
      changes: fileInsertions + fileDeletions,
      deletions: fileDeletions,
      file,
      insertions: fileInsertions,
    });

    insertions += fileInsertions;
    deletions += fileDeletions;
  }

  return { deletions, files, insertions };
};

const splitPatchByFile = (patch) => {
  const patches = {};
  const headerPattern = /^diff --git a\/(.+?) b\/(.+)$/gm;
  const entries = [];

  let match = headerPattern.exec(patch);
  while (match) {
    entries.push({ file: match[2], start: match.index });
    match = headerPattern.exec(patch);
  }

  for (const [index, entry] of entries.entries()) {
    const nextStart = entries[index + 1]?.start ?? patch.length;
    const filePatch = patch.slice(entry.start, nextStart).trimEnd();
    patches[entry.file] = filePatch ? `${filePatch}\n` : "";
  }

  return patches;
};

const createSnapshotGeneration = (bootId, fingerprint, mergeBase) =>
  createHash("sha1").update(`${bootId}:${fingerprint}:${mergeBase}`).digest("hex");

const resolveBaseBranch = async (repoPath, explicitBaseBranch) => {
  if (explicitBaseBranch) {
    return explicitBaseBranch;
  }

  const remoteBranches = splitGitLines(
    await runGitSnapshotCommand(repoPath, ["branch", "-r", "--format=%(refname:short)"]),
  );
  for (const name of PREFERRED_BASE_BRANCHES) {
    if (remoteBranches.includes(`origin/${name}`)) {
      return `origin/${name}`;
    }
  }

  const localBranches = splitGitLines(
    await runGitSnapshotCommand(repoPath, ["branch", "--format=%(refname:short)"]),
  );
  for (const name of PREFERRED_BASE_BRANCHES) {
    if (localBranches.includes(name)) {
      return name;
    }
  }

  return "origin/main";
};

const buildSnapshot = async (repoPath, explicitBaseBranch, mode, serverBootId) => {
  const branchOutput = await runGitSnapshotCommand(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const branch = branchOutput.trim();
  const baseBranch =
    mode === "uncommitted" ? "HEAD" : await resolveBaseBranch(repoPath, explicitBaseBranch);
  let mergeBase = "HEAD";
  if (mode !== "uncommitted") {
    const mergeBaseOutput = await runGitSnapshotCommand(repoPath, [
      "merge-base",
      "HEAD",
      baseBranch,
    ]);
    mergeBase = mergeBaseOutput.trim();
  }

  const diffArgs = [mergeBase];
  const fullPatch = await runGitSnapshotCommand(repoPath, ["diff", ...diffArgs]);
  const rawSummary = await runGitSnapshotCommand(repoPath, [
    "diff",
    "--numstat",
    "-z",
    "-M",
    ...diffArgs,
  ]);
  const summary = parseDiffStats(rawSummary);
  const fingerprint = createHash("sha1").update(fullPatch).digest("hex");
  const createdAt = Date.now();
  const generation = createSnapshotGeneration(serverBootId, fingerprint, mergeBase);

  return {
    baseBranch,
    branch,
    deletions: summary.deletions,
    files: summary.files,
    fingerprint,
    fullPatch,
    generation,
    insertions: summary.insertions,
    mergeBase,
    metadata: {
      bootId: serverBootId,
      createdAt,
      repoPath,
    },
    patchByFile: splitPatchByFile(fullPatch),
  };
};

const shouldIgnoreWatchPath = (pathToCheck, repoPath) => {
  const normalizedRepoPath = repoPath.endsWith("/") ? repoPath : `${repoPath}/`;
  const relativePath = pathToCheck.startsWith(normalizedRepoPath)
    ? pathToCheck.slice(normalizedRepoPath.length).replaceAll("\\", "/")
    : pathToCheck.replaceAll("\\", "/");

  if (!relativePath || relativePath.startsWith("..")) {
    return false;
  }

  for (const ignoredRoot of [".next", ".turbo", "node_modules"]) {
    if (relativePath === ignoredRoot || relativePath.startsWith(`${ignoredRoot}/`)) {
      return true;
    }
  }

  if (
    (relativePath === ".git" || relativePath.startsWith(".git/")) &&
    relativePath !== ".git/HEAD" &&
    relativePath !== ".git/index" &&
    relativePath !== ".git/packed-refs" &&
    relativePath !== ".git/refs" &&
    !relativePath.startsWith(".git/refs/")
  ) {
    return true;
  }

  return false;
};

const startSnapshotWriter = async (repoPath, explicitBaseBranch, serverBootId) => {
  const gitDir = join(repoPath, ".git");
  const watchTargets = [
    repoPath,
    join(gitDir, "HEAD"),
    join(gitDir, "index"),
    join(gitDir, "packed-refs"),
    join(gitDir, "refs"),
  ].filter(existsSync);

  let writeTimer = null;
  let writeInFlight = null;
  let queuedWrite = false;

  const writeSnapshots = async () => {
    const snapshots = await Promise.all([
      buildSnapshot(repoPath, explicitBaseBranch, undefined, serverBootId),
      buildSnapshot(repoPath, explicitBaseBranch, "uncommitted", serverBootId),
    ]);

    writeFileSync(getSnapshotCachePath(repoPath), JSON.stringify(snapshots[0]), "utf-8");
    writeFileSync(
      getSnapshotCachePath(repoPath, undefined, "uncommitted"),
      JSON.stringify(snapshots[1]),
      "utf-8",
    );
  };

  const queueWrite = async () => {
    if (writeInFlight) {
      queuedWrite = true;
      await writeInFlight;
      return;
    }

    writeInFlight = (async () => {
      try {
        await writeSnapshots();
      } finally {
        writeInFlight = null;
      }
    })();

    await writeInFlight;

    if (queuedWrite) {
      queuedWrite = false;
      await queueWrite();
    }
  };

  await queueWrite();

  const watcher = watch(watchTargets, {
    ignoreInitial: true,
    ignored: (pathToCheck) => shouldIgnoreWatchPath(pathToCheck, repoPath),
    persistent: true,
  });

  const scheduleWrite = () => {
    if (writeTimer) {
      clearTimeout(writeTimer);
    }

    writeTimer = setTimeout(() => {
      writeTimer = null;

      void (async () => {
        try {
          await queueWrite();
        } catch (error) {
          console.error("[diffhub] snapshot writer failed", { error });
        }
      })();
    }, 150);
  };

  watcher.on("add", scheduleWrite);
  watcher.on("addDir", scheduleWrite);
  watcher.on("change", scheduleWrite);
  watcher.on("unlink", scheduleWrite);
  watcher.on("unlinkDir", scheduleWrite);
  watcher.on("error", (error) => {
    console.error("[diffhub] snapshot writer watch failed", { error });
  });

  return async () => {
    if (writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }
    await watcher.close();
  };
};

const listSnapshotWriterProcesses = async (repoPath) => {
  try {
    const { stdout } = await execFile("ps", ["-axo", "pid=,command="], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    const repoMatcher = `--repo ${repoPath}`;
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const firstSpace = line.indexOf(" ");
        if (firstSpace === -1) {
          return null;
        }

        const pid = Number.parseInt(line.slice(0, firstSpace), 10);
        const command = line.slice(firstSpace + 1);
        if (
          !Number.isInteger(pid) ||
          pid <= 0 ||
          pid === process.pid ||
          !command.includes("internal-snapshot-writer") ||
          !command.includes(repoMatcher)
        ) {
          return null;
        }

        return { command, pid };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const waitForProcessesToExit = async (pids, maxMs = 3000) => {
  if (pids.length === 0) {
    return true;
  }

  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const stillRunning = pids.filter((pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    });

    if (stillRunning.length === 0) {
      return true;
    }

    // oxlint-disable-next-line promise/avoid-new
    await new Promise((_resolve) => {
      setTimeout(_resolve, 100);
    });
  }

  return false;
};

const stopSnapshotWriterProcess = async (repoPath) => {
  const pidPath = getCmuxWriterPidPath(repoPath);
  const targetPids = new Set();

  try {
    const pid = Number.parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
      targetPids.add(pid);
    }
  } catch {
    // empty
  }

  const runningWriters = await listSnapshotWriterProcesses(repoPath);
  for (const writer of runningWriters) {
    targetPids.add(writer.pid);
  }

  for (const pid of targetPids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // empty
    }
  }

  const remainingPids = [...targetPids];
  const exited = await waitForProcessesToExit(remainingPids);
  if (!exited) {
    for (const pid of remainingPids) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // empty
      }
    }

    await waitForProcessesToExit(remainingPids, 1000);
  }

  try {
    unlinkSync(pidPath);
  } catch {
    // empty
  }
};

const REPO_POINTER = "/tmp/diffhub-active-repo";

const readRepoPointer = () => {
  try {
    const repoPath = readFileSync(REPO_POINTER, "utf-8").trim();
    return repoPath || null;
  } catch {
    return null;
  }
};

const writeRepoPointer = (repoPath) => {
  writeFileSync(REPO_POINTER, `${repoPath}\n`);
};

const getListeningPids = async (port) => {
  try {
    const { stdout } = await execFile("lsof", [`-nP`, `-tiTCP:${port}`, `-sTCP:LISTEN`], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return [
      ...new Set(
        stdout
          .split(/\s+/)
          .map((pid) => Number.parseInt(pid, 10))
          .filter((pid) => Number.isInteger(pid) && pid > 0),
      ),
    ];
  } catch {
    return [];
  }
};

const waitForPortRelease = async (port, maxMs = 5000) => {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const listeningPids = await getListeningPids(port);
    if (listeningPids.length === 0) {
      return true;
    }
    // oxlint-disable-next-line promise/avoid-new
    await new Promise((_resolve) => {
      setTimeout(_resolve, 200);
    });
  }
  return false;
};

const stopListeningProcesses = async (port) => {
  const pids = await getListeningPids(port);
  const targets = pids.filter((pid) => pid !== process.pid);

  if (targets.length === 0) {
    return [];
  }

  for (const pid of targets) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // empty
    }
  }

  if (await waitForPortRelease(port, 3000)) {
    return targets;
  }

  for (const pid of targets) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // empty
    }
  }

  await waitForPortRelease(port, 3000);
  return targets;
};

const getServerHealth = async (port) => {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch {
    return null;
  }
};

const stopServeServersForRepo = async (repoPath, startPort, portCount = 10) => {
  const stoppedPorts = [];

  for (let port = startPort; port < startPort + portCount; port += 1) {
    const health = await getServerHealth(port);
    if (!health || health.cmux || health.repoPath !== repoPath) {
      continue;
    }

    const stopped = await stopListeningProcesses(port);
    if (stopped.length > 0) {
      stoppedPorts.push(port);
    }
  }

  return stoppedPorts;
};

const syncCmuxRepoPointer = (repoPath) => {
  const previousPointer = readRepoPointer();
  writeRepoPointer(repoPath);

  return () => {
    try {
      const currentPointer = readRepoPointer();
      if (currentPointer !== null && currentPointer !== repoPath) {
        return;
      }

      if (previousPointer === null) {
        rmSync(REPO_POINTER, { force: true });
        return;
      }

      writeRepoPointer(previousPointer);
    } catch {
      // empty
    }
  };
};

const startServer = (repoPath, baseBranch, port, options = {}) => {
  const {
    cmux = false,
    detached = false,
    disableWatch,
    logPath,
    serverBootId = createServerBootId(repoPath, baseBranch),
  } = options;
  const shouldDisableWatch = disableWatch ?? Boolean(logPath);
  let stdio = ["ignore", "inherit", "inherit"];
  let logStream = null;

  if (logPath) {
    writeFileSync(logPath, "");
    stdio = ["ignore", "pipe", "pipe"];
  }

  const missingStandaloneAliases = findMissingStandaloneNodeModuleAliases(standaloneDir);
  if (missingStandaloneAliases.length > 0) {
    console.warn("[diffhub] disabling prerender because standalone module aliases are missing", {
      aliases: missingStandaloneAliases,
    });
  }

  const shouldDisablePrerender = missingStandaloneAliases.length > 0;

  const serverEnv = {
    ...process.env,
    ...(baseBranch ? { DIFFHUB_BASE: baseBranch } : {}),
    ...(cmux ? { DIFFHUB_CMUX: "1" } : {}),
    ...(shouldDisablePrerender ? { DIFFHUB_DISABLE_PRERENDER: "1" } : {}),
    DIFFHUB_REPO: repoPath,
    DIFFHUB_SERVER_BOOT_ID: serverBootId,
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    PORT: String(port),
  };

  if (shouldDisableWatch) {
    serverEnv.DIFFHUB_DISABLE_WATCH = "1";
  } else {
    delete serverEnv.DIFFHUB_DISABLE_WATCH;
  }

  const server = spawn("node", ["server.js"], {
    cwd: standaloneDir,
    detached,
    env: serverEnv,
    stdio,
  });

  if (logPath) {
    logStream = createWriteStream(logPath, { flags: "a" });

    if (server.stdout) {
      server.stdout.pipe(logStream);
    }
    if (server.stderr) {
      server.stderr.pipe(logStream);
    }

    if (detached) {
      server.unref();
    }

    server.on("exit", () => {
      if (logStream) {
        logStream.end();
      }
    });
  }

  server.on("error", (err) => {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  });

  return { bootId: serverBootId, server };
};

const derivePort = (repoPath) => {
  const hash = createHash("md5").update(repoPath).digest("hex");
  const num = Number.parseInt(hash.slice(0, 8), 16) % 10_000;
  return 20_000 + num;
};

// -- cmux utilities ----------------------------------------------------------

const cmuxExec = async (args) => {
  const { stdout } = await execFile(CMUX_PATH, args, {
    encoding: "utf-8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return stdout;
};

const cmuxNotify = (title, body) => cmuxExec(["notify", "--title", title, "--body", body]);

const cmuxOpenSplit = async (url) => {
  const out = await cmuxExec(["--json", "browser", "open-split", url]);
  const match = out.match(/"surface_ref"\s*:\s*"(surface:[^"]+)"/);
  return match?.[1] ?? null;
};

const cmuxSurfaceAlive = async (surfaceRef) => {
  try {
    const out = await cmuxExec(["surface-health"]);
    return out.includes(surfaceRef);
  } catch {
    return false;
  }
};

const sleep = (ms) =>
  // oxlint-disable-next-line promise/avoid-new
  new Promise((_resolve) => {
    setTimeout(_resolve, ms);
  });

const internalSnapshotWriterAction = async (opts) => {
  const repoPath = validateRepo(resolve(opts.repo));
  const stopSnapshotWriter = await startSnapshotWriter(repoPath, opts.base ?? "", opts.bootId);

  const cleanup = async () => {
    await stopSnapshotWriter();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
};

// -- serve action (default) --------------------------------------------------

const serveAction = async (opts) => {
  const inputPath = resolve(opts.repo ?? process.cwd());
  const baseBranch = opts.base ?? "";
  const requestedPort = Number.parseInt(opts.port, 10);

  const repoPath = validateRepo(inputPath);
  validateBuild();
  syncStandaloneAssets(appDir, standaloneDir);

  const replacedPorts = await stopServeServersForRepo(repoPath, requestedPort);
  const port = await findFreePort(requestedPort);

  console.log(`  diffhub\n`);
  console.log(`  Repo   ${repoPath}`);
  if (baseBranch) {
    console.log(`  Base   ${baseBranch}`);
  }
  if (replacedPorts.length > 0) {
    console.log(`  Reused ${replacedPorts.map((value) => `:${value}`).join(", ")}`);
  }
  console.log(`  URL    http://localhost:${port}`);
  console.log(`\n  Press Ctrl+C to stop\n`);

  const { server } = startServer(repoPath, baseBranch, port);

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

  const cleanup = () => {
    server.kill();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
};

// -- cmux action -------------------------------------------------------------

const cmuxAction = async (opts) => {
  if (!existsSync(CMUX_PATH)) {
    console.error("❌ cmux not found at", CMUX_PATH);
    console.error("   Install cmux: https://cmux.app/");
    process.exit(1);
  }

  const inputPath = resolve(opts.repo ?? process.cwd());
  const baseBranch = opts.base ?? "";

  const repoPath = validateRepo(inputPath);
  validateBuild();
  syncStandaloneAssets(appDir, standaloneDir);

  const port = derivePort(repoPath);
  const url = `http://localhost:${port}`;
  const serverLogPath = getCmuxServerLogPath(repoPath);
  const restoreRepoPointer = syncCmuxRepoPointer(repoPath);
  const serverBootId = createServerBootId(repoPath, baseBranch);

  await stopListeningProcesses(port);
  await stopSnapshotWriterProcess(repoPath);
  clearRepoSnapshotFiles(repoPath);

  await cmuxNotify("diffhub", "Starting server...");

  // Let the server handle file watching and diff computation directly.
  // The external snapshot writer is not used — it hits EBADF errors on
  // macOS when chokidar's FSEvents interacts with child_process spawning.
  // The server's built-in fs.watch + async spawn pipeline works reliably.
  const { bootId, server } = startServer(repoPath, baseBranch, port, {
    cmux: true,
    detached: true,
    disableWatch: false,
    logPath: serverLogPath,
    serverBootId,
  });

  const cleanup = () => {
    server.kill();
    restoreRepoPointer();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  const ready = await waitForServer(port, 15_000, server.pid, bootId, repoPath);
  if (!ready) {
    await cmuxNotify("diffhub", "Server failed to start");
    cleanup();
    return;
  }

  await cmuxNotify("diffhub", `Opening diff: ${repoPath}`);

  const surfaceRef = await cmuxOpenSplit(url);
  if (!surfaceRef) {
    console.log("Browser opened (surface tracking unavailable)");
    return;
  }

  console.log(`Opened surface ${surfaceRef} — waiting for it to close...`);
  console.log(`Server log: ${serverLogPath}`);

  while (await cmuxSurfaceAlive(surfaceRef)) {
    await sleep(1000);
  }

  cleanup();
};

// -- CLI setup ---------------------------------------------------------------

const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
program.name("diffhub").description("GitHub PR-style local diff viewer").version(pkg.version);

program
  .command("serve", { isDefault: true })
  .description("Start diffhub server")
  .option("-p, --port <port>", "Port to serve on", "2047")
  .option("-r, --repo <path>", "Git repository path (defaults to cwd)")
  .option("-b, --base <branch>", "Base branch to diff against (defaults to main/master)")
  .option("--no-open", "Don't open browser automatically")
  .action(serveAction);

program
  .command("cmux")
  .description("Open in cmux browser split pane")
  .option("-r, --repo <path>", "Git repository path (defaults to cwd)")
  .option("-b, --base <branch>", "Base branch to diff against")
  .action(cmuxAction);

program
  .command("internal-snapshot-writer")
  .option("-r, --repo <path>", "Git repository path")
  .option("-b, --base <branch>", "Base branch to diff against")
  .requiredOption("--boot-id <id>", "Boot identifier for snapshot generation")
  .action(internalSnapshotWriterAction);

program.parse(process.argv);
