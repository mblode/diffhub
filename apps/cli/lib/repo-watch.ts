import { join } from "node:path";
import { watch } from "chokidar";
import type { FSWatcher } from "chokidar";
import { getGitDirectory } from "./git-paths";
import { invalidateGitCache } from "./git";

const WATCH_DEBOUNCE_MS = 150;
const IGNORED_ROOTS = [".next", ".turbo", "node_modules"] as const;
const GIT_WATCH_PATHS = ["HEAD", "index", "packed-refs", "refs"] as const;
const noop = (): void => undefined;

export type RepoWatchFsEvent = "add" | "addDir" | "change" | "unlink" | "unlinkDir";

export interface RepoWatchChangeEvent {
  createdAt: string;
  event: RepoWatchFsEvent;
  id: number;
  path: string | null;
  repoPath: string;
  type: "change";
}

export interface RepoWatchErrorEvent {
  createdAt: string;
  error: string;
  id: number;
  repoPath: string;
  type: "error";
}

export type RepoWatchEvent = RepoWatchChangeEvent | RepoWatchErrorEvent;
export type RepoWatchListener = (event: RepoWatchEvent) => void;

interface PendingChange {
  event: RepoWatchFsEvent;
  path: string | null;
}

interface RepoWatchEntry {
  eventId: number;
  pendingChange: PendingChange | null;
  repoPath: string;
  subscribers: Set<RepoWatchListener>;
  timer: ReturnType<typeof setTimeout> | null;
  watcher: FSWatcher;
}

interface RepoWatchRuntimeState {
  entries: Map<string, RepoWatchEntry>;
}

const getRuntimeState = (): RepoWatchRuntimeState => {
  const globalScope = globalThis as typeof globalThis & {
    __diffhubRepoWatchRuntimeState?: RepoWatchRuntimeState;
  };

  globalScope.__diffhubRepoWatchRuntimeState ??= { entries: new Map() };
  return globalScope.__diffhubRepoWatchRuntimeState;
};

const toPosixPath = (value: string): string => value.replaceAll("\\", "/");

export const isRepoWatchDisabled = (): boolean => process.env.DIFFHUB_DISABLE_WATCH === "1";

export const shouldIgnoreWatchPath = (pathToCheck: string, repoPath: string): boolean => {
  const normalizedRepoPath = repoPath.endsWith("/") ? repoPath : `${repoPath}/`;
  const relativePath = toPosixPath(
    pathToCheck.startsWith(normalizedRepoPath)
      ? pathToCheck.slice(normalizedRepoPath.length)
      : pathToCheck,
  );

  if (!relativePath || relativePath.startsWith("..")) {
    return false;
  }

  for (const ignoredRoot of IGNORED_ROOTS) {
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

const getWatchTargets = (repoPath: string): string[] => {
  const gitDirectory = getGitDirectory(repoPath);
  return [
    repoPath,
    ...GIT_WATCH_PATHS.map((path) =>
      join(
        /*turbopackIgnore: true*/
        gitDirectory,
        path,
      ),
    ),
  ];
};

const emitToSubscribers = (entry: RepoWatchEntry, event: RepoWatchEvent): void => {
  for (const subscriber of entry.subscribers) {
    subscriber(event);
  }
};

const flushPendingChange = (entry: RepoWatchEntry): void => {
  const { pendingChange } = entry;
  entry.pendingChange = null;
  entry.timer = null;

  if (!pendingChange) {
    return;
  }
  if (entry.subscribers.size === 0) {
    return;
  }

  invalidateGitCache(entry.repoPath);
  entry.eventId += 1;
  emitToSubscribers(entry, {
    createdAt: new Date().toISOString(),
    event: pendingChange.event,
    id: entry.eventId,
    path: pendingChange.path,
    repoPath: entry.repoPath,
    type: "change",
  });
};

const scheduleChange = (
  entry: RepoWatchEntry,
  event: RepoWatchFsEvent,
  path: string | null,
): void => {
  if (entry.subscribers.size === 0) {
    return;
  }

  entry.pendingChange = { event, path };
  if (entry.timer) {
    clearTimeout(entry.timer);
  }

  entry.timer = setTimeout(() => flushPendingChange(entry), WATCH_DEBOUNCE_MS);
};

const createWatchEntry = (repoPath: string): RepoWatchEntry => {
  const entry: RepoWatchEntry = {
    eventId: 0,
    pendingChange: null,
    repoPath,
    subscribers: new Set(),
    timer: null,
    watcher: watch(getWatchTargets(repoPath), {
      atomic: true,
      ignoreInitial: true,
      ignored: (pathToCheck) => shouldIgnoreWatchPath(pathToCheck, repoPath),
      persistent: true,
    }),
  };

  for (const event of ["add", "addDir", "change", "unlink", "unlinkDir"] as const) {
    entry.watcher.on(event, (path) => scheduleChange(entry, event, path ?? null));
  }

  entry.watcher.on("error", (error) => {
    entry.eventId += 1;
    emitToSubscribers(entry, {
      createdAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      id: entry.eventId,
      repoPath,
      type: "error",
    });
  });

  return entry;
};

const closeEntry = (entry: RepoWatchEntry): void => {
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }

  entry.subscribers.clear();
  const closeWatcher = async (): Promise<void> => {
    try {
      await entry.watcher.close();
    } catch (error) {
      console.error("[diffhub] failed to close repo watcher", { error });
    }
  };
  void closeWatcher();
};

export const subscribeRepoChanges = (
  repoPath: string,
  listener: RepoWatchListener,
): (() => void) => {
  if (isRepoWatchDisabled()) {
    return noop;
  }

  const runtimeState = getRuntimeState();
  let entry = runtimeState.entries.get(repoPath);
  if (!entry) {
    entry = createWatchEntry(repoPath);
    runtimeState.entries.set(repoPath, entry);
  }

  entry.subscribers.add(listener);

  return () => {
    const currentEntry = runtimeState.entries.get(repoPath);
    if (!currentEntry) {
      return;
    }

    currentEntry.subscribers.delete(listener);
    if (currentEntry.subscribers.size === 0) {
      runtimeState.entries.delete(repoPath);
      closeEntry(currentEntry);
    }
  };
};

export const resetRepoWatchersForTest = (): void => {
  const runtimeState = getRuntimeState();
  for (const entry of runtimeState.entries.values()) {
    closeEntry(entry);
  }
  runtimeState.entries.clear();
};
