import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FSWatcher, watch as chokidarWatch } from "chokidar";

type ChokidarWatch = typeof chokidarWatch;

const chokidarMock = vi.hoisted(() => {
  const handlers = new Map<string, ((path?: string) => void)[]>();
  const watcher: {
    close: ReturnType<typeof vi.fn<() => Promise<void>>>;
    on: ReturnType<typeof vi.fn<(event: string, handler: (path?: string) => void) => FSWatcher>>;
  } = {
    close: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    on: vi.fn<(event: string, handler: (path?: string) => void) => FSWatcher>(
      (event: string, handler: (path?: string) => void) => {
        const eventHandlers = handlers.get(event) ?? [];
        eventHandlers.push(handler);
        handlers.set(event, eventHandlers);
        return watcher as unknown as FSWatcher;
      },
    ),
  };

  const state = {
    emit(event: string, path?: string) {
      for (const handler of handlers.get(event) ?? []) {
        handler(path);
      }
    },
    reset() {
      handlers.clear();
      watcher.close.mockClear();
      watcher.on.mockClear();
      state.watch.mockClear();
    },
    watch: vi.fn<ChokidarWatch>(() => watcher as unknown as FSWatcher),
    watcher,
  };
  return state;
});

const gitMock = vi.hoisted(() => ({
  invalidateGitCache: vi.fn<(repoPath?: string) => void>(),
}));

vi.mock(import("chokidar"), () => ({
  watch: chokidarMock.watch,
}));

vi.mock(import("./git"), () => ({
  invalidateGitCache: gitMock.invalidateGitCache,
}));

const tempPaths: string[] = [];
const originalDisableWatch = process.env.DIFFHUB_DISABLE_WATCH;

const createRepo = (): string => {
  const repoPath = mkdtempSync(join(tmpdir(), "diffhub-watch-"));
  mkdirSync(join(repoPath, ".git", "refs", "heads"), { recursive: true });
  writeFileSync(join(repoPath, ".git", "HEAD"), "ref: refs/heads/main\n");
  writeFileSync(join(repoPath, ".git", "index"), "");
  writeFileSync(join(repoPath, ".git", "packed-refs"), "");
  tempPaths.push(repoPath);
  return repoPath;
};

const resetGlobalWatchState = () => {
  delete (
    globalThis as typeof globalThis & {
      __diffhubRepoWatchRuntimeState?: unknown;
    }
  ).__diffhubRepoWatchRuntimeState;
};

describe("repo watcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    delete process.env.DIFFHUB_DISABLE_WATCH;
    chokidarMock.reset();
    gitMock.invalidateGitCache.mockClear();
    resetGlobalWatchState();
  });

  afterEach(async () => {
    const { resetRepoWatchersForTest } = await import("./repo-watch");
    resetRepoWatchersForTest();
    resetGlobalWatchState();
    vi.useRealTimers();
    if (originalDisableWatch === undefined) {
      delete process.env.DIFFHUB_DISABLE_WATCH;
    } else {
      process.env.DIFFHUB_DISABLE_WATCH = originalDisableWatch;
    }

    for (const tempPath of tempPaths.splice(0)) {
      rmSync(tempPath, { force: true, recursive: true });
    }
  });

  it("ignores generated paths while keeping important git metadata visible", async () => {
    const { shouldIgnoreWatchPath } = await import("./repo-watch");
    const repoPath = createRepo();

    expect(shouldIgnoreWatchPath(join(repoPath, ".next/cache"), repoPath)).toBeTruthy();
    expect(shouldIgnoreWatchPath(join(repoPath, ".turbo/cache"), repoPath)).toBeTruthy();
    expect(
      shouldIgnoreWatchPath(join(repoPath, "node_modules/pkg/index.js"), repoPath),
    ).toBeTruthy();
    expect(
      shouldIgnoreWatchPath(join(repoPath, ".git/diffhub-comments.json"), repoPath),
    ).toBeTruthy();

    expect(shouldIgnoreWatchPath(join(repoPath, ".git/HEAD"), repoPath)).toBeFalsy();
    expect(shouldIgnoreWatchPath(join(repoPath, ".git/index"), repoPath)).toBeFalsy();
    expect(shouldIgnoreWatchPath(join(repoPath, ".git/packed-refs"), repoPath)).toBeFalsy();
    expect(shouldIgnoreWatchPath(join(repoPath, ".git/refs/heads/main"), repoPath)).toBeFalsy();
  });

  it("emits one debounced change after a burst and invalidates cache first", async () => {
    const { subscribeRepoChanges } = await import("./repo-watch");
    const repoPath = createRepo();
    const events: { invalidationsSeen: number; path: string | null }[] = [];

    subscribeRepoChanges(repoPath, (event) => {
      if (event.type === "change") {
        events.push({
          invalidationsSeen: gitMock.invalidateGitCache.mock.calls.length,
          path: event.path,
        });
      }
    });

    const firstPath = join(repoPath, "src/a.ts");
    const secondPath = join(repoPath, "src/b.ts");
    chokidarMock.emit("change", firstPath);
    chokidarMock.emit("change", secondPath);

    await vi.advanceTimersByTimeAsync(149);
    expect(events).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);

    expect(gitMock.invalidateGitCache).toHaveBeenCalledExactlyOnceWith(repoPath);
    expect(events).toStrictEqual([{ invalidationsSeen: 1, path: secondPath }]);
  });

  it("closes the watcher after the last subscriber unsubscribes", async () => {
    const { subscribeRepoChanges } = await import("./repo-watch");
    const repoPath = createRepo();
    const listener = vi.fn<(event: unknown) => void>();

    const unsubscribe = subscribeRepoChanges(repoPath, listener);
    unsubscribe();

    expect(chokidarMock.watcher.close).toHaveBeenCalledOnce();

    chokidarMock.emit("change", join(repoPath, "src/a.ts"));
    await vi.advanceTimersByTimeAsync(150);

    expect(listener).not.toHaveBeenCalled();
    expect(gitMock.invalidateGitCache).not.toHaveBeenCalled();
  });

  it("does not create a watcher when file watching is disabled", async () => {
    process.env.DIFFHUB_DISABLE_WATCH = "1";
    const { subscribeRepoChanges } = await import("./repo-watch");
    const repoPath = createRepo();

    subscribeRepoChanges(repoPath, vi.fn<(event: unknown) => void>());

    expect(chokidarMock.watch).not.toHaveBeenCalled();
  });
});
