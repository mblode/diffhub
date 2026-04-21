import { existsSync, watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { join, relative, sep } from "node:path";
import { createDeferred } from "./deferred";
import { getOrPrerenderByReviewKey } from "./diff-prerender";
import { isLargeDiffFile } from "./diff-file-stat";
import {
  clearGitMemoryCache,
  getMultiFileDiff,
  invalidateGitCache,
  isCmuxRuntime,
  primeGitSnapshots,
} from "./git";
import { getGitDirectory } from "./git-paths";
import { getConfiguredRepoPath } from "./repo-path";

type FileWatchListener = () => void;
const noop: () => void = () => null;

const listeners = new Set<FileWatchListener>();
const WATCH_DEBOUNCE_MS = 150;

let activeRepoPath: string | null = null;
let watchers: FSWatcher[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let snapshotPrimeInFlight: Promise<void> | null = null;
let snapshotPrimeQueued = false;
let changeRevision = 0;
let lastChangeAt = 0;

const toPosixPath = (value: string): string => value.split(sep).join("/");

const shouldIgnorePath = (pathToCheck: string, repoPath: string): boolean => {
  const relativePath = toPosixPath(relative(repoPath, pathToCheck));
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

const WARM_PRERENDER_CONCURRENCY = 4;
const WARM_LAYOUTS: ("split" | "stacked")[] = ["split", "stacked"];
const WARM_THEMES: ("dark" | "light")[] = ["dark", "light"];

const warmPrerenderCache = async (): Promise<void> => {
  if (!isCmuxRuntime()) {
    return;
  }
  try {
    const snapshot = await getMultiFileDiff();
    const statByFile = new Map(snapshot.files.map((stat) => [stat.file, stat]));
    const jobs: {
      reviewKey: string;
      patch: string;
      layout: "split" | "stacked";
      theme: "dark" | "light";
    }[] = [];
    for (const [file, patch] of Object.entries(snapshot.patchByFile)) {
      const stat = statByFile.get(file);
      if (!stat) {
        continue;
      }
      if (isLargeDiffFile(stat, Buffer.byteLength(patch))) {
        continue;
      }
      const reviewKey = snapshot.reviewKeyByFile[file];
      if (!reviewKey) {
        continue;
      }
      for (const layout of WARM_LAYOUTS) {
        for (const theme of WARM_THEMES) {
          jobs.push({ layout, patch, reviewKey, theme });
        }
      }
    }

    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < jobs.length) {
        const index = cursor;
        cursor += 1;
        const job = jobs[index];
        if (!job) {
          return;
        }
        try {
          await getOrPrerenderByReviewKey(job.reviewKey, job.patch, job.layout, job.theme);
        } catch {
          // best-effort warmup; ignore per-file failures
        }
      }
    };

    const workerCount = Math.min(WARM_PRERENDER_CONCURRENCY, jobs.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  } catch {
    // best-effort warmup; never break the watcher
  }
};

const queueSnapshotPrime = async (): Promise<void> => {
  if (snapshotPrimeInFlight) {
    snapshotPrimeQueued = true;
    await snapshotPrimeInFlight;
    return;
  }

  snapshotPrimeInFlight = (async () => {
    try {
      await primeGitSnapshots();
      await warmPrerenderCache();
    } finally {
      snapshotPrimeInFlight = null;
    }
  })();

  await snapshotPrimeInFlight;

  if (snapshotPrimeQueued) {
    snapshotPrimeQueued = false;
    await queueSnapshotPrime();
  }
};

const emitChange = (): void => {
  const repoPath = activeRepoPath;
  if (process.env.DIFFHUB_EXTERNAL_SNAPSHOT_WRITER === "1") {
    clearGitMemoryCache(repoPath ?? undefined);
  } else {
    invalidateGitCache(repoPath ?? undefined);
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;

    void (async () => {
      try {
        if (process.env.DIFFHUB_EXTERNAL_SNAPSHOT_WRITER !== "1") {
          await queueSnapshotPrime();
        }
      } catch (error) {
        console.error("[diffhub] snapshot prime failed", { error });
      } finally {
        changeRevision += 1;
        lastChangeAt = Date.now();
        for (const listener of listeners) {
          listener();
        }
      }
    })();
  }, WATCH_DEBOUNCE_MS);
};

const closeWatcher = (): void => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (watchers.length === 0) {
    return;
  }

  const currentWatchers = watchers;
  watchers = [];
  for (const currentWatcher of currentWatchers) {
    currentWatcher.close();
  }
};

const createWatcher = (repoPath: string): FSWatcher[] => {
  const gitDir = getGitDirectory(repoPath);
  const watchTargets = [repoPath].filter(existsSync);
  const recursiveSupported = process.platform === "darwin" || process.platform === "win32";
  const nextWatchers: FSWatcher[] = [];

  const handleWatchEvent = (rootPath: string, relativePath?: string | Buffer | null) => {
    const pathToCheck = relativePath ? join(rootPath, relativePath.toString()) : rootPath;
    if (shouldIgnorePath(pathToCheck, repoPath)) {
      return;
    }
    emitChange();
  };

  const handleWatcherError = (watcher: FSWatcher, error: Error): void => {
    console.error("[diffhub] file watcher error", error);
    // Remove dead watcher from array
    const index = nextWatchers.indexOf(watcher);
    if (index !== -1) {
      nextWatchers.splice(index, 1);
    }
    // Schedule recovery if all watchers are gone
    if (nextWatchers.length === 0) {
      setTimeout(() => {
        if (activeRepoPath === repoPath && watchers.length === 0) {
          console.log("[diffhub] attempting watcher recovery");
          watchers = createWatcher(repoPath);
        }
      }, 5000);
    }
  };

  for (const watchTarget of watchTargets) {
    const nextWatcher = watch(
      watchTarget,
      {
        persistent: true,
        recursive: recursiveSupported,
      },
      (_eventType, filename) => {
        handleWatchEvent(watchTarget, filename);
      },
    );

    nextWatcher.on("error", (error) => handleWatcherError(nextWatcher, error));
    nextWatchers.push(nextWatcher);
  }

  if (!recursiveSupported) {
    // On Linux, watch specific git files and directories
    const gitFiles = [join(gitDir, "HEAD"), join(gitDir, "index"), join(gitDir, "packed-refs")];
    // Watch refs subdirectories (not refs as a file)
    const gitDirs = [
      join(gitDir, "refs", "heads"),
      join(gitDir, "refs", "tags"),
      join(gitDir, "refs", "remotes"),
    ];

    for (const gitTarget of [...gitFiles, ...gitDirs]) {
      if (!existsSync(gitTarget)) {
        continue;
      }

      const nextWatcher = watch(gitTarget, { persistent: true }, (_eventType, filename) => {
        handleWatchEvent(gitTarget, filename);
      });

      nextWatcher.on("error", (error) => handleWatcherError(nextWatcher, error));
      nextWatchers.push(nextWatcher);
    }
  }

  return nextWatchers;
};

export const ensureFileWatch = (): void => {
  const repoPath = getConfiguredRepoPath();
  if (watchers.length > 0 && activeRepoPath === repoPath) {
    return;
  }

  // Set path BEFORE closing old watchers to prevent stale state window
  const previousPath = activeRepoPath;
  activeRepoPath = repoPath;
  closeWatcher();

  // Only recreate if switching repos or no watchers exist
  if (previousPath !== repoPath || watchers.length === 0) {
    watchers = createWatcher(repoPath);
  }
};

const subscribeToFileWatch = (listener: FileWatchListener): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const waitForFileWatch = (
  signal: AbortSignal,
  timeoutMs: number,
): Promise<"change" | "timeout"> => {
  const { promise, resolve } = createDeferred<"change" | "timeout">();
  let settled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe = noop;

  // Check if already aborted BEFORE doing any setup
  if (signal.aborted) {
    resolve("timeout");
    return promise;
  }

  // Declare handleAbort first so finish can reference it
  let handleAbort: () => void = noop;

  const finish = (result: "change" | "timeout") => {
    if (settled) {
      return;
    }
    settled = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    unsubscribe();
    signal.removeEventListener("abort", handleAbort);
    resolve(result);
  };

  handleAbort = () => {
    finish("timeout");
  };

  // Attach abort listener first to catch aborts during setup
  signal.addEventListener("abort", handleAbort, { once: true });

  unsubscribe = subscribeToFileWatch(() => {
    finish("change");
  });

  timeoutId = setTimeout(() => {
    finish("timeout");
  }, timeoutMs);

  return promise;
};

export const getFileWatchSnapshot = (): { changedAt: number; revision: number } => ({
  changedAt: lastChangeAt,
  revision: changeRevision,
});
