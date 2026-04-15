"use client";

import type { AnnotationSide } from "@pierre/diffs";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useTransition,
  startTransition,
} from "react";
import { StatusBar } from "./StatusBar";
import type { DiffMode } from "./StatusBar";
import { FileList } from "./FileList";
import { DiffViewer, getDiffSectionId } from "./DiffViewer";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { toCommentSide } from "@/lib/comment-sides";
import type { Comment, CommentTag } from "@/lib/comments";
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
}

interface PlaceholderProps {
  text: string;
  pulse?: boolean;
}

const FALLBACK_POLL_INTERVAL_MS = 5000;
const LIVE_POLL_INTERVAL_MS = 30_000;
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
    return <Placeholder text="Loading diff…" pulse />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {syncNotice && <SyncBanner notice={syncNotice} />}
      <div className="min-h-0 flex-1">
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
      </div>
    </div>
  );
};

// oxlint-disable-next-line complexity
export const DiffApp = ({ repoPath }: { repoPath: string }) => {
  const [filesData, setFilesData] = useState<FilesData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const selectedFileRef = useRef<string | null>(null);
  const [diffData, setDiffData] = useState<MultiFileDiffData | null>(null);
  const [layout, setLayout] = useLocalStorage("diffhub-layout", "stacked", LAYOUT_OPTIONS);
  const [filterQuery, setFilterQuery] = useState("");
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

  const deferredDiffData = useDeferredValue(diffData);

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
    const query = params.toString();
    return query ? `?${query}` : "";
  }, []);

  const performDiffFetch = useCallback(
    async (requestId: number) => {
      const requestGeneration = currentFilesGenerationRef.current;
      const requestFingerprint = currentFilesFingerprintRef.current;
      setDiffError(null);

      console.info("[diffhub] fetchDiff start", {
        fingerprint: requestFingerprint,
        generation: requestGeneration,
        mode: diffModeRef.current,
        requestId,
      });

      try {
        const response = await fetch(`/api/diff${buildDiffQuery()}`);
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
          return;
        }

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
      const diffMatchesGeneration = diffData?.generation === nextFiles.generation;

      if (!didChangeFingerprint && diffMatchesGeneration && diffError === null) {
        return;
      }

      lastDiffFingerprintRef.current = nextFiles.fingerprint;
      if (didChangeFingerprint) {
        latestDiffRequestRef.current += 1;
      }

      void fetchAllDiff();
    },
    [diffData, diffError, fetchAllDiff],
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

  const fileWatchState = useFileWatch(() => {
    void pollFiles(true);
  });

  const handleRetry = useCallback(() => {
    void pollFiles();
  }, [pollFiles]);

  useEffect(() => {
    void pollFiles();
  }, [pollFiles]);

  useEffect(() => {
    const interval = setInterval(
      () => void pollFiles(true),
      fileWatchState === "live" ? LIVE_POLL_INTERVAL_MS : FALLBACK_POLL_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [fileWatchState, pollFiles]);

  const lockActiveFile = useCallback((file: string, durationMs = 800) => {
    activeFileLockRef.current = { file, until: Date.now() + durationMs };
    selectedFileRef.current = file;
    startTransition(() => setSelectedFile(file));
  }, []);

  const scrollToFile = useCallback(
    (file: string, behavior: ScrollBehavior = "smooth") => {
      lockActiveFile(file);

      // Expand the file if it's collapsed
      updateCollapsedFiles((previous) => {
        if (previous.has(file)) {
          const next = new Set(previous);
          next.delete(file);
          return next;
        }
        return previous;
      });

      const performScroll = (section: HTMLElement): void => {
        // Use scrollIntoView for consistent behavior that respects scroll-padding CSS
        section.scrollIntoView({ behavior, block: "start" });

        // Move focus for accessibility (keyboard/screen reader users)
        const focusTarget = section.querySelector<HTMLElement>('[role="heading"], h2, h3, button');
        if (focusTarget) {
          focusTarget.focus({ preventScroll: true });
        } else {
          section.setAttribute("tabindex", "-1");
          section.focus({ preventScroll: true });
        }
      };

      const section = document.querySelector<HTMLElement>(getFileSectionSelector(file));
      if (section) {
        performScroll(section);
        return;
      }

      // Section not rendered yet (lazy loading) - wait for DOM mutation
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

      // Safety timeout - stop waiting after 5 seconds
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
      <SidebarProvider className="h-svh">
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
    <SidebarProvider className="h-svh">
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
      />

      <SidebarInset className="flex flex-col h-svh overflow-hidden">
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

        <div className="flex-1 min-h-0 overflow-hidden">
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
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
