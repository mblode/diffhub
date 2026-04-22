"use client";

import type { AnnotationSide } from "@pierre/diffs";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState, useTransition, startTransition } from "react";
import { StatusBar } from "./StatusBar";
import type { DiffMode } from "./StatusBar";
import { FileList } from "./FileList";
import { DiffViewer, getDiffSectionId } from "./DiffViewer";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { toCommentSide } from "@/lib/comment-sides";
import type { Comment, CommentTag } from "@/lib/comment-types";
import type { PrerenderedDiffHtml } from "@/lib/diff-prerender";
import { splitPatchByFile } from "@/lib/split-patch";
import { useFileWatch } from "@/lib/use-file-watch";
import { useLocalStorage } from "@/lib/use-local-storage";

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

interface MultiFileDiffResponse {
  patch?: string;
  patchesByFile?: Record<string, string>;
  prerenderedHTMLByFile?: Record<string, PrerenderedDiffHtml>;
  reviewKeysByFile?: Record<string, string>;
  baseBranch: string;
  mergeBase: string;
  branch: string;
  generation: string;
  fingerprint?: string;
}

interface MultiFileDiffData {
  patchesByFile: Record<string, string>;
  prerenderedHTMLByFile?: Record<string, PrerenderedDiffHtml>;
  reviewKeysByFile: Record<string, string>;
  baseBranch: string;
  mergeBase: string;
  branch: string;
  generation: string;
  sourceFingerprint: string;
}

interface DiffErrorResponse {
  error?: string;
}

type SyncNoticeTone = "neutral" | "warning" | "destructive";

interface SyncNotice {
  label: string;
  detail?: string;
  tone: SyncNoticeTone;
}

interface MainPanelProps {
  filesData: FilesData | null;
  deferredDiffData: MultiFileDiffData | null;
  diffError: string | null;
  syncNotice: SyncNotice | null;
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
  diffWatchdogTripped: boolean;
  diffHintShown: boolean;
  onRetryDiff: () => void;
}

interface PlaceholderProps {
  text: string;
  pulse?: boolean;
}

const FALLBACK_POLL_INTERVAL_MS = 5000;
const LIVE_POLL_INTERVAL_MS = 30_000;
const DIFF_REQUEST_TIMEOUT_MS = 15_000;
const STALE_DIFF_DROP_LIMIT = 3;
const DIFF_WATCHDOG_MS = 20_000;
const DIFF_HINT_MS = 10_000;
const LAYOUT_OPTIONS = ["split", "stacked"] as const;
const DIFF_MODE_OPTIONS = ["all", "uncommitted"] as const;

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

const hashString = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.trunc(Math.imul(31, hash) + (value.codePointAt(index) ?? 0));
  }

  return Math.abs(hash).toString(36);
};

const createReviewKeysByFile = (
  patchesByFile: Record<string, string>,
  generation: string,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(patchesByFile).map(([file, patch]) => [
      file,
      `${generation}:${hashString(`${file}:${patch}`)}`,
    ]),
  );

const normalizeDiffResponse = (
  response: MultiFileDiffResponse,
  sourceFingerprint: string,
): MultiFileDiffData => {
  const patchesByFile =
    response.patchesByFile ?? Object.fromEntries(splitPatchByFile(response.patch ?? ""));
  return {
    baseBranch: response.baseBranch,
    branch: response.branch,
    generation: response.generation,
    mergeBase: response.mergeBase,
    patchesByFile,
    prerenderedHTMLByFile: response.prerenderedHTMLByFile,
    reviewKeysByFile:
      response.reviewKeysByFile ?? createReviewKeysByFile(patchesByFile, response.generation),
    sourceFingerprint,
  };
};

const Placeholder = ({ text, pulse = false }: PlaceholderProps): React.JSX.Element => (
  <div className="flex h-full items-center justify-center">
    <div className={`text-muted-foreground text-sm${pulse ? " animate-pulse" : ""}`}>{text}</div>
  </div>
);

const getFileSectionSelector = (file: string): string => {
  const sectionId = getDiffSectionId(file);
  if (typeof window !== "undefined" && window.CSS?.escape) {
    return `#${window.CSS.escape(sectionId)}`;
  }

  // Full CSS identifier escaping fallback for browsers without CSS.escape
  const escaped = sectionId.replaceAll(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, "\\$&");
  return `#${escaped}`;
};

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
  deferredDiffData: MultiFileDiffData | null,
  diffError: string | null,
  fileWatchState: "connecting" | "live" | "fallback",
): SyncNotice | null => {
  if (loadError && filesData !== null) {
    return {
      detail: loadError,
      label: "Background refresh failed",
      tone: "destructive",
    };
  }

  if (diffError && deferredDiffData) {
    return {
      detail: diffError,
      label: "Diff refresh failed",
      tone: "destructive",
    };
  }

  if (fileWatchState === "fallback") {
    return {
      detail: "Live watch is unavailable, so the app is polling every 5 seconds",
      label: "Polling fallback",
      tone: "warning",
    };
  }

  return null;
};

const MainPanel = ({
  filesData,
  deferredDiffData,
  diffError,
  syncNotice,
  layout,
  comments,
  onAddComment,
  onDeleteComment,
  selectedFile,
  collapsedFiles,
  onToggleCollapse,
  onActiveFileChange,
  repoPath,
  diffWatchdogTripped,
  diffHintShown,
  onRetryDiff,
}: MainPanelProps): React.JSX.Element => {
  if (filesData === null) {
    return <Placeholder text="Loading diff…" pulse />;
  }
  if (filesData.files.length === 0) {
    return <Placeholder text="No changes" />;
  }
  if (!deferredDiffData) {
    if (diffError) {
      return <Placeholder text={diffError} />;
    }
    if (diffWatchdogTripped) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <div className="text-muted-foreground text-sm">Still loading the diff…</div>
          <div className="text-muted-foreground text-xs opacity-80">
            Large diffs take longer on first load.
          </div>
          <Button size="sm" variant="default" onClick={onRetryDiff}>
            Retry
          </Button>
        </div>
      );
    }
    if (diffHintShown) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <div className="text-muted-foreground animate-pulse text-sm">
            {`Loading diff${filesData ? ` (${filesData.files.length} files)…` : "…"}`}
          </div>
          <div className="text-muted-foreground text-xs opacity-80">
            Large diffs take longer on first load.
          </div>
        </div>
      );
    }
    return (
      <Placeholder
        text={`Loading diff${filesData ? ` (${filesData.files.length} files)…` : "…"}`}
        pulse
      />
    );
  }

  return (
    <>
      {syncNotice && <SyncBanner notice={syncNotice} />}
      <DiffViewer
        patchesByFile={deferredDiffData.patchesByFile}
        prerenderedHTMLByFile={deferredDiffData.prerenderedHTMLByFile}
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
      />
    </>
  );
};

// oxlint-disable-next-line complexity
export const DiffApp = ({
  repoPath,
  defaultSidebarOpen = true,
}: {
  repoPath: string;
  defaultSidebarOpen?: boolean;
}) => {
  const [filesData, setFilesData] = useState<FilesData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const selectedFileRef = useRef<string | null>(null);
  const [diffData, setDiffData] = useState<MultiFileDiffData | null>(null);
  const [layout, setLayout] = useLocalStorage("diffhub-layout", "stacked", LAYOUT_OPTIONS);
  const { resolvedTheme } = useTheme();
  const diffVariant: "light" | "dark" = resolvedTheme === "light" ? "light" : "dark";
  const layoutRef = useRef<"split" | "stacked">(layout);
  const themeRef = useRef<"light" | "dark">(diffVariant);
  const [filterQuery, setFilterQuery] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffRequestPending, setDiffRequestPending] = useState(false);
  const [diffMode, setDiffMode] = useLocalStorage<DiffMode>(
    "diffhub-diffMode",
    "all",
    DIFF_MODE_OPTIONS,
  );
  const diffModeRef = useRef<DiffMode>(diffMode);
  const activeFileLockRef = useRef<{ file: string; until: number } | null>(null);
  const lastDiffFingerprintRef = useRef<string | null>(null);
  const currentFilesFingerprintRef = useRef<string | null>(null);
  const currentFilesGenerationRef = useRef<string | null>(null);
  const fetchingRef = useRef(false);
  const queuedPollRef = useRef(false);
  const pollFilesRef = useRef<(silent?: boolean) => Promise<void>>(() => Promise.resolve());
  const diffFetchInFlightRef = useRef(false);
  const queuedDiffFetchRef = useRef(false);
  const latestDiffRequestRef = useRef(0);
  const staleDiffDropCountRef = useRef(0);
  const diffFetchStartedAtRef = useRef<number | null>(null);
  const [diffWatchdogTripped, setDiffWatchdogTripped] = useState(false);
  const [diffHintShown, setDiffHintShown] = useState(false);
  const [, startDiffTransition] = useTransition();
  // Start with empty Set to avoid hydration mismatch, then sync from localStorage
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    diffModeRef.current = diffMode;
  }, [diffMode]);

  // Sync collapsed files from localStorage after mount
  useEffect(() => {
    setCollapsedFiles(new Set(readStoredJson<string[]>(`diffhub-collapsed:${repoPath}`, [])));
  }, [repoPath]);

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

  // Previously wrapped in useDeferredValue — removed because it forced a
  // second render pass that could land mid-scroll, shifting layout. The diff
  // data updates are already inside startDiffTransition.
  const deferredDiffData = diffData;

  const buildFilesQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (diffModeRef.current === "uncommitted") {
      params.set("mode", "uncommitted");
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  }, []);

  const buildDiffQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (currentFilesGenerationRef.current) {
      params.set("generation", currentFilesGenerationRef.current);
    }
    if (diffModeRef.current === "uncommitted") {
      params.set("mode", "uncommitted");
    }
    params.set("layout", layoutRef.current);
    params.set("theme", themeRef.current);
    const query = params.toString();
    return query ? `?${query}` : "";
  }, []);

  const performDiffFetch = useCallback(
    async (requestId: number) => {
      const requestGeneration = currentFilesGenerationRef.current;
      const requestFingerprint = currentFilesFingerprintRef.current;
      diffFetchStartedAtRef.current = Date.now();
      setDiffWatchdogTripped(false);
      setDiffError(null);

      console.info("[diffhub] fetchDiff start", {
        fingerprint: requestFingerprint,
        generation: requestGeneration,
        mode: diffModeRef.current,
        requestId,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(new Error("Diff request timed out"));
      }, DIFF_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(`/api/diff${buildDiffQuery()}`, { signal: controller.signal });
        if (!response.ok) {
          const errorBody = (await response
            .json()
            .catch(() => ({ error: "Failed to load diff" }))) as DiffErrorResponse;
          const errorMessage = errorBody.error ?? `Failed to load diff (${response.status})`;

          console.error("[diffhub] fetchDiff non-ok response", {
            fingerprint: requestFingerprint,
            generation: requestGeneration,
            mode: diffModeRef.current,
            requestId,
            responseStatus: response.status,
            responseStatusText: response.statusText,
            serverError: errorMessage,
          });

          if (requestId === latestDiffRequestRef.current) {
            setDiffError(errorMessage);
          }
          return;
        }

        const payload = (await response.json()) as MultiFileDiffResponse;
        const nextDiffData = normalizeDiffResponse(payload, requestFingerprint ?? "unknown");

        if (
          requestId !== latestDiffRequestRef.current ||
          requestFingerprint !== currentFilesFingerprintRef.current ||
          requestGeneration !== currentFilesGenerationRef.current
        ) {
          console.info("[diffhub] fetchDiff response stale", {
            fingerprint: requestFingerprint,
            generation: requestGeneration,
            latestRequestId: latestDiffRequestRef.current,
            requestId,
          });
          // If no data has landed yet, re-queue a fresh fetch so we don't
          // sit on "Loading diff…" forever after the only response got dropped.
          if (currentFilesGenerationRef.current !== null) {
            staleDiffDropCountRef.current += 1;
            if (staleDiffDropCountRef.current >= STALE_DIFF_DROP_LIMIT) {
              console.warn("[diffhub] fetchDiff stale-drop limit reached, invalidating", {
                drops: staleDiffDropCountRef.current,
              });
              staleDiffDropCountRef.current = 0;
              latestDiffRequestRef.current += 1;
              lastDiffFingerprintRef.current = null;
              setDiffData(null);
            }
            queuedDiffFetchRef.current = true;
          }
          return;
        }

        staleDiffDropCountRef.current = 0;
        console.info("[diffhub] fetchDiff success", {
          fileCount: Object.keys(nextDiffData.patchesByFile).length,
          fingerprint: requestFingerprint,
          generation: nextDiffData.generation,
          requestId,
        });

        startDiffTransition(() => setDiffData(nextDiffData));
      } catch (error) {
        console.error("[diffhub] fetchDiff threw", {
          error,
          fingerprint: requestFingerprint,
          generation: requestGeneration,
          mode: diffModeRef.current,
          requestId,
        });

        if (requestId === latestDiffRequestRef.current) {
          setDiffError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [buildDiffQuery, startDiffTransition],
  );

  const fetchAllDiff = useCallback(async () => {
    queuedDiffFetchRef.current = true;
    if (diffFetchInFlightRef.current) {
      return;
    }

    diffFetchInFlightRef.current = true;
    setDiffRequestPending(true);

    while (queuedDiffFetchRef.current) {
      queuedDiffFetchRef.current = false;
      latestDiffRequestRef.current += 1;
      await performDiffFetch(latestDiffRequestRef.current);
    }

    diffFetchInFlightRef.current = false;
    setDiffRequestPending(false);
  }, [performDiffFetch]);

  // Re-fetch whenever the user toggles layout or theme: /api/diff now ships
  // only the active (layout × theme) variant, cached per-combination server-side.
  useEffect(() => {
    if (layoutRef.current === layout && themeRef.current === diffVariant) {
      return;
    }
    layoutRef.current = layout;
    themeRef.current = diffVariant;
    latestDiffRequestRef.current += 1;
    lastDiffFingerprintRef.current = null;
    setDiffData(null);
    void fetchAllDiff();
  }, [layout, diffVariant, fetchAllDiff]);

  // Refs so `reconcileSelectedFile` stays stable — prevents downstream
  // callbacks (pollFiles) from recreating whenever diff data/error updates,
  // which could cascade into mid-scroll re-subscriptions.
  const diffDataRef = useRef(diffData);
  const diffErrorRef = useRef(diffError);
  useEffect(() => {
    diffDataRef.current = diffData;
  }, [diffData]);
  useEffect(() => {
    diffErrorRef.current = diffError;
  }, [diffError]);

  const reconcileSelectedFile = useCallback(
    (nextFiles: FilesData) => {
      currentFilesFingerprintRef.current = nextFiles.fingerprint;
      currentFilesGenerationRef.current = nextFiles.generation;

      if (nextFiles.files.length === 0) {
        selectedFileRef.current = null;
        latestDiffRequestRef.current += 1;
        startTransition(() => {
          setSelectedFile(null);
          setDiffData(null);
        });
        setDiffError(null);
        lastDiffFingerprintRef.current = nextFiles.fingerprint;
        return;
      }

      let nextSelection = selectedFileRef.current;
      if (!nextSelection || !nextFiles.files.some((file) => file.file === nextSelection)) {
        nextSelection = nextFiles.files[0]?.file ?? null;
        selectedFileRef.current = nextSelection;
        startTransition(() => setSelectedFile(nextSelection));
      }

      const didChangeFingerprint = nextFiles.fingerprint !== lastDiffFingerprintRef.current;
      const diffMatchesGeneration = diffDataRef.current?.generation === nextFiles.generation;

      if (!didChangeFingerprint && diffMatchesGeneration && diffErrorRef.current === null) {
        return;
      }

      lastDiffFingerprintRef.current = nextFiles.fingerprint;
      if (didChangeFingerprint) {
        latestDiffRequestRef.current += 1;
      }

      void fetchAllDiff();
    },
    [fetchAllDiff],
  );

  const invalidateDiffState = useCallback(() => {
    latestDiffRequestRef.current += 1;
    lastDiffFingerprintRef.current = null;
    currentFilesFingerprintRef.current = null;
    currentFilesGenerationRef.current = null;
    setDiffData(null);
    setDiffError(null);
  }, []);

  const pollFiles = useCallback(
    async (silent = false) => {
      const finishPoll = () => {
        if (!silent) {
          setRefreshing(false);
        }

        fetchingRef.current = false;
        if (queuedPollRef.current) {
          queuedPollRef.current = false;
          queueMicrotask(() => {
            void pollFilesRef.current(true);
          });
        }
      };

      if (fetchingRef.current) {
        queuedPollRef.current = true;
        return;
      }

      fetchingRef.current = true;
      if (!silent) {
        setRefreshing(true);
      }
      setLoadError(null);

      const pollResult = await Promise.all([
        fetch(`/api/files${buildFilesQuery()}`),
        fetch("/api/comments")
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(`Failed to load comments (${response.status})`);
            }

            return (await response.json()) as Comment[];
          })
          .catch((error) => {
            console.error("[diffhub] comments refresh failed", { error });
            return null;
          }),
      ]).catch((error) => {
        setLoadError(error instanceof Error ? error.message : String(error));
        return null;
      });

      if (!pollResult) {
        finishPoll();
        return;
      }

      const [filesResponse, nextComments] = pollResult;

      if (!filesResponse.ok) {
        const errorBody = await filesResponse.json().catch(() => ({ error: "Network error" }));
        setLoadError(errorBody.error ?? "Failed to load files");
        finishPoll();
        return;
      }

      const nextFilesData = (await filesResponse.json()) as FilesData;

      startTransition(() => {
        setFilesData(nextFilesData);
        if (nextComments !== null) {
          setComments(nextComments);
        }
      });
      reconcileSelectedFile(nextFilesData);
      finishPoll();
    },
    [buildFilesQuery, reconcileSelectedFile],
  );

  useEffect(() => {
    pollFilesRef.current = pollFiles;
  }, [pollFiles]);

  // Scroll-active gate: while the user is scrolling, defer any state-updating
  // work (polls, file-watch pushes) until ~200 ms after the last scroll event.
  // WebKit has no overflow-anchor; any setState that changes layout during a
  // momentum fling shifts the viewport or rubber-bands the scroll.
  const isScrollingRef = useRef(false);
  const pendingPollRef = useRef(false);
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const handleScroll = () => {
      isScrollingRef.current = true;
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(() => {
        isScrollingRef.current = false;
        if (pendingPollRef.current) {
          pendingPollRef.current = false;
          void pollFilesRef.current(true);
        }
      }, 200);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
    };
  }, []);

  const queuePollIfIdle = useCallback(() => {
    if (isScrollingRef.current) {
      pendingPollRef.current = true;
      return;
    }
    void pollFilesRef.current(true);
  }, []);

  const fileWatchState = useFileWatch(queuePollIfIdle);

  const handleRetry = useCallback(() => {
    void pollFiles();
  }, [pollFiles]);

  const handleRetryDiff = useCallback(() => {
    setDiffWatchdogTripped(false);
    setDiffHintShown(false);
    setDiffError(null);
    latestDiffRequestRef.current += 1;
    lastDiffFingerprintRef.current = null;
    setDiffData(null);
    void fetchAllDiff();
  }, [fetchAllDiff]);

  useEffect(() => {
    void pollFiles();
  }, [pollFiles]);

  useEffect(() => {
    const interval = setInterval(
      queuePollIfIdle,
      fileWatchState === "live" ? LIVE_POLL_INTERVAL_MS : FALLBACK_POLL_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [fileWatchState, queuePollIfIdle]);

  // Watchdog: if files are loaded but the diff is still absent after a few
  // seconds without an explicit error, surface a retry affordance instead of
  // the infinite "Loading diff…" pulse.
  useEffect(() => {
    if (!filesData || filesData.files.length === 0 || diffData || diffError) {
      setDiffWatchdogTripped(false);
      return;
    }
    const timer = setTimeout(() => setDiffWatchdogTripped(true), DIFF_WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [filesData, diffData, diffError]);

  useEffect(() => {
    if (!filesData || filesData.files.length === 0 || diffData || diffError) {
      setDiffHintShown(false);
      return;
    }
    const timer = setTimeout(() => setDiffHintShown(true), DIFF_HINT_MS);
    return () => clearTimeout(timer);
  }, [filesData, diffData, diffError]);

  const lockActiveFile = useCallback((file: string, durationMs = 800) => {
    activeFileLockRef.current = { file, until: Date.now() + durationMs };
    selectedFileRef.current = file;
    startTransition(() => setSelectedFile(file));
  }, []);

  const scrollToFile = useCallback(
    (file: string, behavior: ScrollBehavior = "smooth") => {
      lockActiveFile(file);

      updateCollapsedFiles((previous) => {
        if (previous.has(file)) {
          const next = new Set(previous);
          next.delete(file);
          return next;
        }
        return previous;
      });

      const performScroll = (section: HTMLElement): void => {
        // No focus() call: WebKit ≤ 16.3 ignores preventScroll, and focusing
        // during a smooth-scroll can compound scroll jitter. The sidebar
        // button remains the focus target for keyboard users.
        section.scrollIntoView({ behavior, block: "start" });
      };

      const section = document.querySelector<HTMLElement>(getFileSectionSelector(file));
      if (section) {
        performScroll(section);
        return;
      }

      const container = document.querySelector("#diff-container");
      if (!container) {
        return;
      }

      const observer = new MutationObserver(() => {
        const delayedSection = document.querySelector<HTMLElement>(getFileSectionSelector(file));
        if (delayedSection) {
          observer.disconnect();
          performScroll(delayedSection);
        }
      });

      observer.observe(container, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 5000);
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
        void pollFiles();
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
    pollFiles,
    scrollToFile,
    selectedFile,
    setLayout,
    toggleCollapse,
  ]);

  const handleDiffModeChange = useCallback(
    (mode: DiffMode) => {
      diffModeRef.current = mode;
      setDiffMode(mode);
      invalidateDiffState();
      void pollFiles(false);
    },
    [invalidateDiffState, pollFiles, setDiffMode],
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

  const syncNotice = getSyncNotice(
    loadError,
    filesData,
    deferredDiffData,
    diffError,
    fileWatchState,
  );

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
        comments={comments}
        filterQuery={filterQuery}
        onFilterChange={setFilterQuery}
        isLoading={filesData === null}
        insertions={filesData?.insertions ?? 0}
        deletions={filesData?.deletions ?? 0}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={setSidebarWidth}
      />

      <SidebarInset className="flex flex-col min-h-svh">
        <div className="sticky top-0 z-20">
          <StatusBar
            branch={filesData?.branch ?? "…"}
            baseBranch={filesData?.baseBranch ?? "main"}
            refreshing={refreshing || diffRequestPending}
            fileWatchState={fileWatchState}
            comments={comments}
            diffMode={diffMode}
            onDiffModeChange={handleDiffModeChange}
            layout={layout}
            onLayoutChange={setLayout}
            syncNotice={syncNotice}
          />
        </div>

        <MainPanel
          filesData={filesData}
          deferredDiffData={deferredDiffData}
          diffError={diffError}
          syncNotice={syncNotice}
          layout={layout}
          comments={comments}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          selectedFile={selectedFile}
          collapsedFiles={collapsedFiles}
          onToggleCollapse={toggleCollapse}
          onActiveFileChange={handleActiveFileChange}
          repoPath={repoPath}
          diffWatchdogTripped={diffWatchdogTripped}
          diffHintShown={diffHintShown}
          onRetryDiff={handleRetryDiff}
        />
      </SidebarInset>
    </SidebarProvider>
  );
};
