"use client";

import type { AnnotationSide } from "@pierre/diffs";
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useTheme } from "next-themes";
import { FileList, SidebarInset, SidebarProvider, StatusBar } from "@diffhub/diff-core/react";
import type { DiffMode } from "@diffhub/diff-core/react";
import { DiffViewer } from "./DiffViewer";
import type { DiffViewerHandle } from "./DiffViewer";
import { Button } from "@/components/ui/button";
import { toCommentSide } from "@/lib/comment-sides";
import type { Comment, CommentTag } from "@/lib/comment-types";
import { exportCommentsAsPrompt } from "@/lib/export-comments";
import { useLocalStorage } from "@/lib/use-local-storage";
import { getRefreshStatusMeta } from "@/lib/watch-status";
import type { WatchHealth } from "@/lib/watch-status";
import { WATCH_STREAM_EVENTS } from "@/lib/watch-stream";
import type { DisplaySettings, DiffThemeSelection } from "@diffhub/diff-core";
import {
  DEFAULT_DIFF_THEMES,
  DEFAULT_DISPLAY_SETTINGS,
  DISPLAY_SETTINGS_KEY,
  normalizeDiffThemes,
  normalizeDisplaySettings,
} from "@diffhub/diff-core";

const DIFF_THEME_KEY = "diffhub-diff-theme";

interface FilesData {
  files: {
    file: string;
    changes: number;
    insertions: number;
    deletions: number;
    binary: boolean;
  }[];
  insertions: number;
  deletions: number;
  branch: string;
  baseBranch: string;
  fingerprint: string;
  generation: string;
}

interface DiffErrorResponse {
  error?: string;
}

type SyncNoticeTone = "neutral" | "warning" | "destructive";

interface PollFilesOptions {
  forceRefresh?: boolean;
  includeComments?: boolean;
}

interface SyncNotice {
  label: string;
  detail?: string;
  tone: SyncNoticeTone;
}

interface MainPanelProps {
  filesData: FilesData | null;
  syncNotice: SyncNotice | null;
  reloadKey: string;
  diffMode: DiffMode;
  layout: "split" | "stacked";
  comments: Comment[];
  onAddComment: (
    file: string,
    lineNumber: number,
    side: AnnotationSide,
    body: string,
    tag: CommentTag,
  ) => Promise<boolean>;
  onDeleteComment: (id: string) => Promise<boolean>;
  selectedFile: string | null;
  collapsedFiles: Set<string>;
  onToggleCollapse: (file: string) => void;
  onActiveFileChange: (file: string) => void;
  repoPath: string;
  diffViewerRef: React.Ref<DiffViewerHandle>;
  displaySettings: DisplaySettings;
  diffThemes: DiffThemeSelection;
}

interface PlaceholderProps {
  text: string;
  pulse?: boolean;
}

const CMUX_WATCH_POLL_MS = 2000;
const LAYOUT_OPTIONS = ["split", "stacked"] as const;
const DIFF_MODE_OPTIONS = ["all", "uncommitted"] as const;
const PANEL_OPTIONS = ["open", "closed"] as const;
type PanelState = (typeof PANEL_OPTIONS)[number];
type WatchMode = "poll" | "stream";

const readStoredJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
};

const areFilesDataEqual = (previous: FilesData | null, next: FilesData): boolean => {
  if (!previous) {
    return false;
  }
  if (
    previous.baseBranch !== next.baseBranch ||
    previous.branch !== next.branch ||
    previous.deletions !== next.deletions ||
    previous.fingerprint !== next.fingerprint ||
    previous.generation !== next.generation ||
    previous.insertions !== next.insertions ||
    previous.files.length !== next.files.length
  ) {
    return false;
  }

  return previous.files.every((file, index) => {
    const nextFile = next.files[index];
    return (
      nextFile !== undefined &&
      file.binary === nextFile.binary &&
      file.changes === nextFile.changes &&
      file.deletions === nextFile.deletions &&
      file.file === nextFile.file &&
      file.insertions === nextFile.insertions
    );
  });
};

const areCommentsEqual = (previous: readonly Comment[], next: readonly Comment[]): boolean => {
  if (previous.length !== next.length) {
    return false;
  }

  return previous.every((comment, index) => {
    const nextComment = next[index];
    return (
      nextComment !== undefined &&
      comment.body === nextComment.body &&
      comment.createdAt === nextComment.createdAt &&
      comment.file === nextComment.file &&
      comment.id === nextComment.id &&
      comment.lineNumber === nextComment.lineNumber &&
      comment.side === nextComment.side &&
      comment.tag === nextComment.tag
    );
  });
};

const Placeholder = ({ text, pulse = false }: PlaceholderProps): React.JSX.Element => (
  <div className="flex min-h-0 flex-1 items-center justify-center">
    <div className={`text-muted-foreground text-sm${pulse ? " animate-pulse" : ""}`}>{text}</div>
  </div>
);

const SyncBanner = ({ notice }: { notice: SyncNotice }): React.JSX.Element => {
  let toneClass = "border-border bg-muted/40 text-muted-foreground";
  if (notice.tone === "destructive") {
    toneClass = "border-destructive/30 bg-destructive/10 text-destructive";
  } else if (notice.tone === "warning") {
    toneClass = "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }

  return (
    <div className={`border-b px-4 py-2 text-xs ${toneClass}`}>
      <div className="flex items-center gap-2">
        <span className="font-medium">{notice.label}</span>
        {notice.detail && <span className="text-xs opacity-80">{notice.detail}</span>}
      </div>
    </div>
  );
};

const getSyncNotice = (
  loadError: string | null,
  filesData: FilesData | null,
): SyncNotice | null => {
  if (loadError && filesData !== null) {
    return {
      detail: loadError,
      label: "Background refresh failed",
      tone: "destructive",
    };
  }

  return null;
};

const MainPanel = ({
  filesData,
  syncNotice,
  reloadKey,
  diffMode,
  layout,
  comments,
  onAddComment,
  onDeleteComment,
  selectedFile,
  collapsedFiles,
  onToggleCollapse,
  onActiveFileChange,
  repoPath,
  diffViewerRef,
  displaySettings,
  diffThemes,
}: MainPanelProps): React.JSX.Element => {
  if (filesData === null) {
    return <Placeholder text="Loading diff…" pulse />;
  }
  if (filesData.files.length === 0) {
    return <Placeholder text="No changes" />;
  }

  return (
    <>
      {syncNotice && <SyncBanner notice={syncNotice} />}
      <DiffViewer
        ref={diffViewerRef}
        reloadKey={reloadKey}
        diffMode={diffMode}
        layout={layout}
        comments={comments}
        onAddComment={onAddComment}
        onDeleteComment={onDeleteComment}
        activeFileId={selectedFile}
        fileStats={filesData.files}
        collapsedFiles={collapsedFiles}
        onToggleCollapse={onToggleCollapse}
        onActiveFileChange={onActiveFileChange}
        repoPath={repoPath}
        showBackgrounds={displaySettings.showBackgrounds}
        showLineNumbers={displaySettings.showLineNumbers}
        wordWrap={displaySettings.wordWrap}
        diffIndicators={displaySettings.diffIndicators}
        diffThemes={diffThemes}
      />
    </>
  );
};

const areAllFilesCollapsed = (data: FilesData | null, collapsedSize: number): boolean => {
  const count = data?.files?.length ?? 0;
  return count > 0 && collapsedSize >= count;
};

export const DiffApp = ({
  repoPath,
  defaultSidebarOpen = true,
  watchMode = "stream",
  watchPollMs = CMUX_WATCH_POLL_MS,
}: {
  repoPath: string;
  defaultSidebarOpen?: boolean;
  watchPollMs?: number;
  watchMode?: WatchMode;
}) => {
  const [filesData, setFilesData] = useState<FilesData | null>(null);
  const filesDataRef = useRef<FilesData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const commentsRef = useRef<Comment[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const selectedFileRef = useRef<string | null>(null);
  const [layout, setLayout] = useLocalStorage("diffhub-layout", "stacked", LAYOUT_OPTIONS);
  const [filterQuery, setFilterQuery] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [statsPanel, setStatsPanel] = useLocalStorage<PanelState>(
    "diffhub-panel-stats",
    "closed",
    PANEL_OPTIONS,
  );
  const handleStatsOpenChange = useCallback(
    (open: boolean) => setStatsPanel(open ? "open" : "closed"),
    [setStatsPanel],
  );
  const [refreshing, setRefreshing] = useState(false);
  // Connection health of the background change-detector (it never refreshes the
  // diff itself — see `checkForUpdates`).
  const [watchStatus, setWatchStatus] = useState<WatchHealth>("connecting");
  // Set when the background detector notices the diff changed on disk; cleared
  // by a manual refresh. Drives the status-bar "updates available" indicator.
  const [updatesAvailable, setUpdatesAvailable] = useState(false);
  const updatesAvailableRef = useRef(false);
  const checkingRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useLocalStorage<DiffMode>(
    "diffhub-diffMode",
    "all",
    DIFF_MODE_OPTIONS,
  );
  const diffModeRef = useRef<DiffMode>(diffMode);
  const activeFileLockRef = useRef<{ file: string; until: number } | null>(null);
  const fetchingRef = useRef(false);
  const queuedPollRef = useRef(false);
  // Bumped on manual refresh / retry so the diff re-streams even when the file
  // fingerprint is unchanged.
  const [reloadNonce, setReloadNonce] = useState(0);
  // Start with empty Set to avoid hydration mismatch, then sync from localStorage
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => new Set());
  // Display settings + diff theme selection. Start from defaults to avoid
  // hydration mismatch, then restore the persisted JSON after mount.
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(
    () => DEFAULT_DISPLAY_SETTINGS,
  );
  const [diffThemes, setDiffThemes] = useState<DiffThemeSelection>(() => DEFAULT_DIFF_THEMES);
  // Imperative handle into the DiffViewer's CodeView for scroll-to-file.
  const diffViewerRef = useRef<DiffViewerHandle | null>(null);

  // The diff stream re-runs whenever this key changes: a new working-tree
  // fingerprint (watcher), a diff-mode switch, or a manual refresh nonce.
  const reloadKey = useMemo(
    () => `${filesData?.fingerprint ?? ""}:${diffMode}:${reloadNonce}`,
    [filesData?.fingerprint, diffMode, reloadNonce],
  );

  useEffect(() => {
    diffModeRef.current = diffMode;
  }, [diffMode]);

  useEffect(() => {
    filesDataRef.current = filesData;
  }, [filesData]);

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  // Sync collapsed files from localStorage after mount
  useEffect(() => {
    setCollapsedFiles(new Set(readStoredJson<string[]>(`diffhub-collapsed:${repoPath}`, [])));
  }, [repoPath]);

  // Restore persisted display settings + diff theme selection after mount.
  useEffect(() => {
    setDisplaySettings(normalizeDisplaySettings(readStoredJson(DISPLAY_SETTINGS_KEY, null)));
    setDiffThemes(normalizeDiffThemes(readStoredJson(DIFF_THEME_KEY, null)));
  }, []);

  const handleDisplaySettingsChange = useCallback((next: DisplaySettings) => {
    setDisplaySettings(next);
    try {
      localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // empty
    }
  }, []);

  const handleDiffThemesChange = useCallback((next: DiffThemeSelection) => {
    setDiffThemes(next);
    try {
      localStorage.setItem(DIFF_THEME_KEY, JSON.stringify(next));
    } catch {
      // empty
    }
  }, []);

  const updateCollapsedFiles = useCallback(
    (updater: (previous: Set<string>) => Set<string>) => {
      setCollapsedFiles((previous) => {
        const next = updater(previous);
        if (next === previous) {
          return previous;
        }

        try {
          localStorage.setItem(`diffhub-collapsed:${repoPath}`, JSON.stringify([...next]));
        } catch {
          // empty
        }
        return next;
      });
    },
    [repoPath],
  );

  const buildFilesQuery = useCallback((options: { forceRefresh?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (diffModeRef.current === "uncommitted") {
      params.set("mode", "uncommitted");
    }
    if (options.forceRefresh) {
      params.set("refresh", "1");
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  }, []);

  const reconcileSelectedFile = useCallback((nextFiles: FilesData) => {
    if (nextFiles.files.length === 0) {
      selectedFileRef.current = null;
      startTransition(() => setSelectedFile(null));
      return;
    }

    let nextSelection = selectedFileRef.current;
    if (!nextSelection || !nextFiles.files.some((file) => file.file === nextSelection)) {
      nextSelection = nextFiles.files[0]?.file ?? null;
      selectedFileRef.current = nextSelection;
      startTransition(() => setSelectedFile(nextSelection));
    }
  }, []);

  const pollFilesRef = useRef<(options?: PollFilesOptions) => Promise<boolean>>(() =>
    Promise.resolve(false),
  );

  const pollFiles = useCallback(
    async (options: PollFilesOptions = {}): Promise<boolean> => {
      const forceRefresh = options.forceRefresh ?? false;
      const includeComments = options.includeComments ?? true;
      const finishPoll = () => {
        setRefreshing(false);

        fetchingRef.current = false;
        if (queuedPollRef.current) {
          queuedPollRef.current = false;
          queueMicrotask(() => {
            void pollFilesRef.current();
          });
        }
      };

      if (fetchingRef.current) {
        queuedPollRef.current = true;
        return false;
      }

      fetchingRef.current = true;
      setRefreshing(true);
      setLoadError(null);

      const pollResult = await Promise.all([
        fetch(`/api/files${buildFilesQuery({ forceRefresh })}`),
        includeComments
          ? fetch("/api/comments")
              .then(async (response) => {
                if (!response.ok) {
                  throw new Error(`Failed to load comments (${response.status})`);
                }

                return (await response.json()) as Comment[];
              })
              .catch((error) => {
                console.error("[diffhub] comments refresh failed", { error });
                return null;
              })
          : Promise.resolve(null),
      ]).catch((error) => {
        setLoadError(error instanceof Error ? error.message : String(error));
        return null;
      });

      if (!pollResult) {
        finishPoll();
        return false;
      }

      const [filesResponse, nextComments] = pollResult;

      if (!filesResponse.ok) {
        const errorBody = await filesResponse.json().catch(() => ({ error: "Network error" }));
        setLoadError(errorBody.error ?? "Failed to load files");
        finishPoll();
        return false;
      }

      const nextFilesData = (await filesResponse.json()) as FilesData;
      // The view is about to reflect the latest diff, so any pending
      // "updates available" indicator is now resolved.
      updatesAvailableRef.current = false;
      setUpdatesAvailable(false);
      const shouldUpdateFiles = !areFilesDataEqual(filesDataRef.current, nextFilesData);
      const shouldUpdateComments =
        nextComments !== null && !areCommentsEqual(commentsRef.current, nextComments);

      if (shouldUpdateFiles || shouldUpdateComments) {
        if (shouldUpdateFiles) {
          filesDataRef.current = nextFilesData;
        }
        if (shouldUpdateComments && nextComments !== null) {
          commentsRef.current = nextComments;
        }
        startTransition(() => {
          if (shouldUpdateFiles) {
            setFilesData(nextFilesData);
          }
          if (shouldUpdateComments && nextComments !== null) {
            setComments(nextComments);
          }
        });
      }
      reconcileSelectedFile(nextFilesData);
      finishPoll();
      return shouldUpdateFiles;
    },
    [buildFilesQuery, reconcileSelectedFile],
  );

  useEffect(() => {
    pollFilesRef.current = pollFiles;
  }, [pollFiles]);

  // Background change-detector. Fetches the lightweight file-stats payload and,
  // if the diff differs from what's on screen, raises the "updates available"
  // flag WITHOUT touching the rendered diff — so the sidebar never flashes and
  // the view only changes when the user manually refreshes.
  const checkForUpdates = useCallback(async () => {
    // No baseline yet (initial load in flight), a manual refresh is running, a
    // check is already in flight, or the indicator is already raised.
    if (
      filesDataRef.current === null ||
      fetchingRef.current ||
      checkingRef.current ||
      updatesAvailableRef.current
    ) {
      return;
    }

    checkingRef.current = true;
    try {
      const response = await fetch(`/api/files${buildFilesQuery({ forceRefresh: true })}`);
      if (!response.ok) {
        return;
      }
      const nextFilesData = (await response.json()) as FilesData;
      if (!areFilesDataEqual(filesDataRef.current, nextFilesData)) {
        updatesAvailableRef.current = true;
        setUpdatesAvailable(true);
      }
    } catch (error) {
      console.error("[diffhub] background update check failed", { error });
    } finally {
      checkingRef.current = false;
    }
  }, [buildFilesQuery]);

  const checkForUpdatesRef = useRef(checkForUpdates);
  useEffect(() => {
    checkForUpdatesRef.current = checkForUpdates;
  }, [checkForUpdates]);

  useEffect(() => {
    if (watchMode === "poll") {
      let active = true;
      setWatchStatus("live");
      const interval = setInterval(() => {
        if (!active) {
          return;
        }
        void checkForUpdatesRef.current();
      }, watchPollMs);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    if (typeof EventSource === "undefined") {
      setWatchStatus("offline");
      return;
    }

    let active = true;
    setWatchStatus("connecting");
    const source = new EventSource("/api/watch");
    const handleReady = () => {
      setWatchStatus("live");
    };
    const handleChange = () => {
      if (!active) {
        return;
      }
      void checkForUpdatesRef.current();
    };
    const handleWatchError = (event: Event) => {
      console.error("[diffhub] file watch stream reported an error", { event });
      setWatchStatus("offline");
    };
    const handleStreamError = () => {
      setWatchStatus("offline");
    };

    source.addEventListener(WATCH_STREAM_EVENTS.READY, handleReady);
    source.addEventListener(WATCH_STREAM_EVENTS.CHANGE, handleChange);
    source.addEventListener(WATCH_STREAM_EVENTS.ERROR, handleWatchError);
    source.addEventListener("error", handleStreamError);

    return () => {
      active = false;
      source.removeEventListener(WATCH_STREAM_EVENTS.READY, handleReady);
      source.removeEventListener(WATCH_STREAM_EVENTS.CHANGE, handleChange);
      source.removeEventListener(WATCH_STREAM_EVENTS.ERROR, handleWatchError);
      source.removeEventListener("error", handleStreamError);
      source.close();
    };
  }, [repoPath, watchMode, watchPollMs]);

  const handleRetry = useCallback(() => {
    void pollFiles({ forceRefresh: true });
  }, [pollFiles]);

  const handleManualRefresh = useCallback(() => {
    setReloadNonce((nonce) => nonce + 1);
    void pollFiles({ forceRefresh: true });
  }, [pollFiles]);

  useEffect(() => {
    void pollFiles();
  }, [pollFiles]);

  const lockActiveFile = useCallback((file: string, durationMs = 800) => {
    activeFileLockRef.current = { file, until: Date.now() + durationMs };
    selectedFileRef.current = file;
    startTransition(() => setSelectedFile(file));
  }, []);

  const scrollToFile = useCallback(
    (file: string) => {
      lockActiveFile(file);

      // Expand-on-navigate: uncollapse the target so its diff is visible.
      updateCollapsedFiles((previous) => {
        if (previous.has(file)) {
          const next = new Set(previous);
          next.delete(file);
          return next;
        }
        return previous;
      });

      // CodeView owns virtualization, so the item always exists in its model
      // even when its DOM is not currently rendered; scrollTo materializes it.
      diffViewerRef.current?.scrollToFile(file);
    },
    [lockActiveFile, updateCollapsedFiles],
  );

  const handleActiveFileChange = useCallback((file: string) => {
    const lock = activeFileLockRef.current;
    if (lock) {
      if (Date.now() > lock.until) {
        activeFileLockRef.current = null;
      } else if (lock.file !== file) {
        return;
      }
    }

    if (selectedFileRef.current === file) {
      return;
    }

    selectedFileRef.current = file;
    startTransition(() => setSelectedFile(file));
  }, []);

  const toggleCollapse = useCallback(
    (file: string) => {
      lockActiveFile(file);
      updateCollapsedFiles((previous) => {
        const next = new Set(previous);
        if (next.has(file)) {
          next.delete(file);
        } else {
          next.add(file);
        }
        return next;
      });
    },
    [lockActiveFile, updateCollapsedFiles],
  );

  const collapseAll = useCallback(() => {
    updateCollapsedFiles(() => new Set((filesData?.files ?? []).map((file) => file.file)));
  }, [filesData, updateCollapsedFiles]);

  const expandAll = useCallback(() => {
    updateCollapsedFiles(() => new Set());
  }, [updateCollapsedFiles]);

  const allFilesCollapsed = areAllFilesCollapsed(filesData, collapsedFiles.size);

  useEffect(() => {
    // oxlint-disable-next-line complexity
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) {
        return;
      }

      if (event.key === "s" && !event.metaKey && !event.ctrlKey) {
        setLayout((value) => (value === "split" ? "stacked" : "split"));
      }
      if (
        (event.key === "/" || event.key.toLowerCase() === "t") &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder="Filter files…"]')?.focus();
      }
      if (event.key.toLowerCase() === "c" && !event.metaKey && !event.ctrlKey && selectedFile) {
        if (event.shiftKey) {
          collapseAll();
          return;
        }
        toggleCollapse(selectedFile);
      }
      if (event.key.toLowerCase() === "e" && event.shiftKey && !event.metaKey && !event.ctrlKey) {
        expandAll();
      }
      if (event.key === "r" && !event.metaKey && !event.ctrlKey) {
        handleManualRefresh();
      }
      if (event.key === "F2") {
        event.preventDefault();
        setStatsPanel((value) => (value === "open" ? "closed" : "open"));
      }
      if (event.key === "j" || event.key === "k") {
        const files = filesData?.files ?? [];
        if (files.length === 0) {
          return;
        }

        const index = files.findIndex((file) => file.file === selectedFile);
        const next = event.key === "j" ? files[index + 1] : files[index - 1];
        if (next) {
          scrollToFile(next.file);
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    collapseAll,
    expandAll,
    filesData,
    handleManualRefresh,
    scrollToFile,
    selectedFile,
    setLayout,
    setStatsPanel,
    toggleCollapse,
  ]);

  const handleDiffModeChange = useCallback(
    (mode: DiffMode) => {
      diffModeRef.current = mode;
      setDiffMode(mode);
      void pollFiles({ forceRefresh: true });
    },
    [pollFiles, setDiffMode],
  );

  const handleAddComment = useCallback(
    async (
      file: string,
      lineNumber: number,
      side: AnnotationSide,
      body: string,
      tag: CommentTag,
    ) => {
      const response = await fetch("/api/comments", {
        body: JSON.stringify({ body, file, lineNumber, side: toCommentSide(side), tag }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const errorBody = (await response
          .json()
          .catch(() => ({ error: "Failed to save comment" }))) as DiffErrorResponse;
        console.error("[diffhub] add comment failed", {
          error: errorBody.error ?? `Failed to save comment (${response.status})`,
        });
        return false;
      }

      const comment = (await response.json()) as Comment;
      setComments((previous) => [...previous, comment]);
      return true;
    },
    [],
  );

  const handleDeleteComment = useCallback(async (id: string) => {
    const response = await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
    if (!response.ok) {
      const errorBody = (await response
        .json()
        .catch(() => ({ error: "Failed to delete comment" }))) as DiffErrorResponse;
      console.error("[diffhub] delete comment failed", {
        error: errorBody.error ?? `Failed to delete comment (${response.status})`,
      });
      return false;
    }

    setComments((previous) => previous.filter((comment) => comment.id !== id));
    return true;
  }, []);

  const handleClearComments = useCallback(async () => {
    if (commentsRef.current.length === 0) {
      return true;
    }

    const response = await fetch("/api/comments?all=1", { method: "DELETE" });
    if (!response.ok) {
      const errorBody = (await response
        .json()
        .catch(() => ({ error: "Failed to clear comments" }))) as DiffErrorResponse;
      console.error("[diffhub] clear comments failed", {
        error: errorBody.error ?? `Failed to clear comments (${response.status})`,
      });
      return false;
    }

    commentsRef.current = [];
    setComments([]);
    return true;
  }, []);

  // The shared StatusBar is decoupled from next-themes / comment storage, so the
  // CLI feeds it the color mode and a comment-export callback here.
  const { theme, setTheme } = useTheme();
  const themeMode: "system" | "light" | "dark" =
    theme === "light" || theme === "dark" ? theme : "system";

  const commentsByFile = useMemo(() => {
    const map = new Map<string, number>();
    for (const comment of comments) {
      map.set(comment.file, (map.get(comment.file) ?? 0) + 1);
    }
    return map;
  }, [comments]);

  const handleCopyComments = useCallback(async () => {
    const text = exportCommentsAsPrompt(comments);
    await navigator.clipboard.writeText(text);
    await handleClearComments();
  }, [comments, handleClearComments]);

  const syncNotice = getSyncNotice(loadError, filesData);

  if (loadError && filesData === null) {
    return (
      <SidebarProvider className="min-h-svh" defaultOpen={defaultSidebarOpen}>
        <SidebarInset className="flex flex-col h-svh items-center justify-center gap-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-6 py-4 text-sm text-destructive max-w-md text-center">
            <p className="font-semibold mb-1">Failed to load diff</p>
            <p className="text-xs opacity-80">{loadError}</p>
          </div>
          <Button variant="outline" onClick={handleRetry}>
            Retry
          </Button>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider
      className="min-h-svh"
      defaultOpen={defaultSidebarOpen}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      <FileList
        files={filesData?.files ?? []}
        selectedFile={selectedFile}
        onSelectFile={scrollToFile}
        commentsByFile={commentsByFile}
        filterQuery={filterQuery}
        onFilterChange={setFilterQuery}
        isLoading={filesData === null}
        insertions={filesData?.insertions ?? 0}
        deletions={filesData?.deletions ?? 0}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={setSidebarWidth}
        statsOpen={statsPanel === "open"}
        onStatsOpenChange={handleStatsOpenChange}
      />

      <SidebarInset className="flex h-svh flex-col overflow-hidden">
        <div className="sticky top-0 z-20">
          <StatusBar
            branch={filesData?.branch ?? "…"}
            baseBranch={filesData?.baseBranch ?? "main"}
            refreshing={refreshing}
            onRefresh={handleManualRefresh}
            watch={getRefreshStatusMeta(updatesAvailable, watchStatus)}
            commentCount={comments.length}
            onCopyComments={handleCopyComments}
            diffMode={diffMode}
            onDiffModeChange={handleDiffModeChange}
            layout={layout}
            onLayoutChange={setLayout}
            allCollapsed={allFilesCollapsed}
            onCollapseAll={collapseAll}
            onExpandAll={expandAll}
            syncNotice={syncNotice}
            displaySettings={displaySettings}
            onDisplaySettingsChange={handleDisplaySettingsChange}
            diffThemes={diffThemes}
            onDiffThemesChange={handleDiffThemesChange}
            themeMode={themeMode}
            onThemeModeChange={setTheme}
          />
        </div>

        <MainPanel
          filesData={filesData}
          syncNotice={syncNotice}
          reloadKey={reloadKey}
          diffMode={diffMode}
          layout={layout}
          comments={comments}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          selectedFile={selectedFile}
          collapsedFiles={collapsedFiles}
          onToggleCollapse={toggleCollapse}
          onActiveFileChange={handleActiveFileChange}
          repoPath={repoPath}
          diffViewerRef={diffViewerRef}
          displaySettings={displaySettings}
          diffThemes={diffThemes}
        />
      </SidebarInset>
    </SidebarProvider>
  );
};
