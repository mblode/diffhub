"use client";

import type { AnnotationSide } from "@pierre/diffs";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  startTransition,
} from "react";
import { StatusBar } from "./StatusBar";
import type { DiffMode, WatchStatus } from "./StatusBar";
import { FileList } from "./FileList";
import { DiffViewer, getCommentElementId, getDiffSectionId } from "./DiffViewer";
import { useTheme } from "./theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { toCommentSide } from "@/lib/comment-sides";
import type { Comment, CommentTag } from "@/lib/comment-types";
import type { PrerenderedDiffHtml } from "@/lib/diff-prerender";
import { splitPatchByFile } from "@/lib/split-patch";
import { COMMENT_POSITION_DELAY_MS, COMMENT_POSITION_WAIT_MS } from "@/lib/comment-scroll-timing";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useScrollAnchor } from "@/lib/use-scroll-anchor";
import { hasRenderableBox, waitForElement } from "@/lib/wait-for-element";
import { WATCH_STREAM_EVENTS } from "@/lib/watch-stream";

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

interface PollFilesOptions {
  forceRefresh?: boolean;
  includeComments?: boolean;
  showRefreshing?: boolean;
}

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
  activeCommentId: string | null;
  onAddComment: (
    file: string,
    lineNumber: number,
    side: AnnotationSide,
    body: string,
    tag: CommentTag,
  ) => Promise<boolean>;
  onDeleteComment: (id: string) => Promise<boolean>;
  onResolveComment: (id: string, resolved: boolean) => Promise<boolean>;
  onReplyToComment: (id: string, body: string) => Promise<boolean>;
  onNavigateComment: (id: string) => void;
  selectedFile: string | null;
  collapsedFiles: Set<string>;
  forceRenderFiles: ReadonlySet<string>;
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

const DIFF_REQUEST_TIMEOUT_MS = 15_000;
const DIFF_WATCHDOG_MS = 20_000;
const DIFF_HINT_MS = 10_000;
const CMUX_WATCH_POLL_MS = 2000;
const LAYOUT_OPTIONS = ["split", "stacked"] as const;
const DIFF_MODE_OPTIONS = ["all", "uncommitted"] as const;
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

const hashString = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.trunc(Math.imul(31, hash) + (value.codePointAt(index) ?? 0));
  }

  return Math.abs(hash).toString(36);
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
      comment.rebasedFromLine === nextComment.rebasedFromLine &&
      comment.resolved === nextComment.resolved &&
      comment.resolvedAt === nextComment.resolvedAt &&
      comment.resolvedBy === nextComment.resolvedBy &&
      comment.side === nextComment.side &&
      comment.staleness === nextComment.staleness &&
      comment.tag === nextComment.tag &&
      JSON.stringify(comment.replies) === JSON.stringify(nextComment.replies)
    );
  });
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

const getCommentSelector = (id: string): string => {
  const elementId = getCommentElementId(id);
  if (typeof window !== "undefined" && window.CSS?.escape) {
    return `#${window.CSS.escape(elementId)}`;
  }

  const escaped = elementId.replaceAll(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, "\\$&");
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

  return null;
};

const MainPanel = ({
  filesData,
  deferredDiffData,
  diffError,
  syncNotice,
  layout,
  comments,
  activeCommentId,
  onAddComment,
  onDeleteComment,
  onResolveComment,
  onReplyToComment,
  onNavigateComment,
  selectedFile,
  collapsedFiles,
  forceRenderFiles,
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
        activeCommentId={activeCommentId}
        onAddComment={onAddComment}
        onDeleteComment={onDeleteComment}
        onResolveComment={onResolveComment}
        onReplyToComment={onReplyToComment}
        onNavigateComment={onNavigateComment}
        activeFileId={selectedFile}
        fileStats={filesData.files}
        collapsedFiles={collapsedFiles}
        forceRenderFiles={forceRenderFiles}
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
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentScrollSeq, setCommentScrollSeq] = useState(0);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const selectedFileRef = useRef<string | null>(null);
  const [diffData, setDiffData] = useState<MultiFileDiffData | null>(null);
  const [layout, setLayout] = useLocalStorage("diffhub-layout", "stacked", LAYOUT_OPTIONS);
  const [resolvedCommentsMode, setResolvedCommentsMode] = useLocalStorage<"show" | "hide">(
    "diffhub-resolved-comments",
    "show",
    ["show", "hide"] as const,
  );
  const { resolvedTheme } = useTheme();
  const diffVariant: "light" | "dark" = resolvedTheme === "light" ? "light" : "dark";
  const layoutRef = useRef<"split" | "stacked">(layout);
  const themeRef = useRef<"light" | "dark">(diffVariant);
  const [filterQuery, setFilterQuery] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [refreshing, setRefreshing] = useState(false);
  const [watchStatus, setWatchStatus] = useState<WatchStatus>("connecting");
  const watchStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const diffFetchInFlightRef = useRef(false);
  const queuedDiffFetchRef = useRef(false);
  const latestDiffRequestRef = useRef(0);
  const pendingFileScrollCancelRef = useRef<VoidFunction | null>(null);
  const [diffWatchdogTripped, setDiffWatchdogTripped] = useState(false);
  const [diffHintShown, setDiffHintShown] = useState(false);
  const [, startDiffTransition] = useTransition();
  // Start with empty Set to avoid hydration mismatch, then sync from localStorage
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => new Set());
  const [forceRenderFiles, setForceRenderFiles] = useState<ReadonlySet<string>>(() => new Set());
  const showResolvedComments = resolvedCommentsMode === "show";

  const orderedVisibleComments = useMemo(() => {
    const fileOrder = new Map(
      (filesData?.files ?? []).map((fileStat, index) => [fileStat.file, index]),
    );
    return comments
      .filter((comment) => showResolvedComments || !comment.resolved)
      .toSorted((a, b) => {
        const fileDelta =
          (fileOrder.get(a.file) ?? Number.MAX_SAFE_INTEGER) -
          (fileOrder.get(b.file) ?? Number.MAX_SAFE_INTEGER);
        if (fileDelta !== 0) {
          return fileDelta;
        }
        if (a.file !== b.file) {
          return a.file.localeCompare(b.file);
        }
        if (a.lineNumber !== b.lineNumber) {
          return a.lineNumber - b.lineNumber;
        }
        return a.createdAt.localeCompare(b.createdAt);
      });
  }, [comments, filesData, showResolvedComments]);

  const activeCommentIndex = orderedVisibleComments.findIndex(
    (comment) => comment.id === activeCommentId,
  );

  useEffect(() => {
    diffModeRef.current = diffMode;
  }, [diffMode]);

  useEffect(() => {
    filesDataRef.current = filesData;
  }, [filesData]);

  useEffect(
    () => () => {
      pendingFileScrollCancelRef.current?.();
      pendingFileScrollCancelRef.current = null;
    },
    [],
  );

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  useEffect(() => {
    if (
      activeCommentId !== null &&
      !orderedVisibleComments.some((comment) => comment.id === activeCommentId)
    ) {
      setActiveCommentId(null);
    }
  }, [activeCommentId, orderedVisibleComments]);

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

  // Refs so refresh callbacks can stay stable without closing over stale data.
  const diffDataRef = useRef(diffData);
  const diffErrorRef = useRef(diffError);
  useEffect(() => {
    diffDataRef.current = diffData;
  }, [diffData]);
  useEffect(() => {
    diffErrorRef.current = diffError;
  }, [diffError]);

  const activeCommentSelector = useMemo(
    () => (activeCommentId ? getCommentSelector(activeCommentId) : null),
    [activeCommentId],
  );

  // Safari-safe scroll anchor: preserve the visible active comment first,
  // otherwise preserve the file section under the sticky toolbar.
  useScrollAnchor({ preferredSelector: activeCommentSelector, selector: "[data-file-section]" });

  // activeCommentSelector handles a newly-active comment; commentScrollSeq
  // handles explicit navigation to the same already-active comment.
  useEffect(() => {
    if (!activeCommentSelector) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelWait: VoidFunction | null = null;
    let cancelled = false;

    const positionActiveComment = (element: HTMLElement) => {
      if (cancelled) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const idealOffset = Math.max(0, (window.innerHeight - rect.height) / 2);
      const top = window.scrollY + rect.top - idealOffset;
      window.dispatchEvent(new Event("diffhub:programmatic-scroll"));
      window.scrollTo({ behavior: "auto", top });
    };

    const isInViewport = (element: HTMLElement): boolean => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    };

    const initial = document.querySelector<HTMLElement>(activeCommentSelector);
    if (initial && hasRenderableBox(initial) && isInViewport(initial)) {
      positionActiveComment(initial);
      return () => {
        cancelled = true;
      };
    }

    // Offscreen sections can report a renderable box while content-visibility
    // is still settling after a collapsed/deferred file opens. Keep those on
    // the deferred path; only already-visible comments take the immediate path.
    timeoutId = setTimeout(() => {
      if (cancelled) {
        return;
      }

      cancelWait = waitForElement(
        activeCommentSelector,
        positionActiveComment,
        COMMENT_POSITION_WAIT_MS,
      );
    }, COMMENT_POSITION_DELAY_MS);

    return () => {
      cancelled = true;
      cancelWait?.();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeCommentSelector, commentScrollSeq]);

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
          // Re-queue a fresh fetch so we don't sit on "Loading diff…" forever
          // when the only in-flight response got superseded.
          if (currentFilesGenerationRef.current !== null) {
            queuedDiffFetchRef.current = true;
          }
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
    setDiffError(null);
    void fetchAllDiff();
  }, [layout, diffVariant, fetchAllDiff]);

  const addForceRenderFiles = useCallback((files: readonly (string | null | undefined)[]) => {
    setForceRenderFiles((previous) => {
      let next: Set<string> | null = null;
      for (const file of files) {
        if (!file || previous.has(file)) {
          continue;
        }
        next ??= new Set(previous);
        next.add(file);
      }
      return next ?? previous;
    });
  }, []);

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
      addForceRenderFiles([nextSelection]);

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
    [addForceRenderFiles, fetchAllDiff],
  );

  const invalidateDiffState = useCallback(() => {
    latestDiffRequestRef.current += 1;
    lastDiffFingerprintRef.current = null;
    currentFilesFingerprintRef.current = null;
    currentFilesGenerationRef.current = null;
    setDiffData(null);
    setDiffError(null);
  }, []);

  const pollFilesRef = useRef<(options?: PollFilesOptions) => Promise<boolean>>(() =>
    Promise.resolve(false),
  );

  const pollFiles = useCallback(
    async (options: PollFilesOptions = {}): Promise<boolean> => {
      const forceRefresh = options.forceRefresh ?? false;
      const includeComments = options.includeComments ?? true;
      const showRefreshing = options.showRefreshing ?? true;
      const finishPoll = () => {
        if (showRefreshing) {
          setRefreshing(false);
        }

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
      if (showRefreshing) {
        setRefreshing(true);
      }
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

  useEffect(() => {
    if (watchMode === "poll") {
      let active = true;
      setWatchStatus("live");
      const interval = setInterval(() => {
        if (!active) {
          return;
        }

        void (async () => {
          const didUpdate = await pollFilesRef.current({
            forceRefresh: true,
            includeComments: false,
            showRefreshing: false,
          });
          if (!active) {
            return;
          }
          if (!didUpdate) {
            return;
          }
          setWatchStatus("updated");
          if (watchStatusTimerRef.current) {
            clearTimeout(watchStatusTimerRef.current);
          }
          watchStatusTimerRef.current = setTimeout(() => {
            if (active) {
              setWatchStatus("live");
            }
          }, 2500);
        })();
      }, watchPollMs);

      return () => {
        active = false;
        clearInterval(interval);
        if (watchStatusTimerRef.current) {
          clearTimeout(watchStatusTimerRef.current);
          watchStatusTimerRef.current = null;
        }
      };
    }

    if (typeof EventSource === "undefined") {
      setWatchStatus("offline");
      return;
    }

    let active = true;
    setWatchStatus("connecting");
    const source = new EventSource("/api/watch");
    const clearWatchStatusTimer = () => {
      if (watchStatusTimerRef.current) {
        clearTimeout(watchStatusTimerRef.current);
        watchStatusTimerRef.current = null;
      }
    };
    const handleReady = () => {
      clearWatchStatusTimer();
      setWatchStatus("live");
    };
    const handleChange = () => {
      void (async () => {
        const didUpdate = await pollFilesRef.current({
          forceRefresh: true,
          includeComments: false,
          showRefreshing: false,
        });
        if (!active) {
          return;
        }
        if (!didUpdate) {
          return;
        }
        clearWatchStatusTimer();
        setWatchStatus("updated");
        watchStatusTimerRef.current = setTimeout(() => {
          if (active) {
            setWatchStatus("live");
          }
        }, 2500);
      })();
    };
    const handleWatchError = (event: Event) => {
      console.error("[diffhub] file watch stream reported an error", { event });
      clearWatchStatusTimer();
      setWatchStatus("offline");
    };
    const handleStreamError = () => {
      clearWatchStatusTimer();
      setWatchStatus("offline");
    };

    source.addEventListener(WATCH_STREAM_EVENTS.READY, handleReady);
    source.addEventListener(WATCH_STREAM_EVENTS.CHANGE, handleChange);
    source.addEventListener(WATCH_STREAM_EVENTS.ERROR, handleWatchError);
    source.addEventListener("error", handleStreamError);

    return () => {
      active = false;
      clearWatchStatusTimer();
      source.removeEventListener(WATCH_STREAM_EVENTS.READY, handleReady);
      source.removeEventListener(WATCH_STREAM_EVENTS.CHANGE, handleChange);
      source.removeEventListener(WATCH_STREAM_EVENTS.ERROR, handleWatchError);
      source.removeEventListener("error", handleStreamError);
      source.close();
    };
  }, [repoPath, watchMode, watchPollMs]);

  const forceDiffRefetch = useCallback(() => {
    setDiffWatchdogTripped(false);
    setDiffHintShown(false);
    setDiffError(null);
    latestDiffRequestRef.current += 1;
    lastDiffFingerprintRef.current = null;
  }, []);

  const handleRetry = useCallback(() => {
    void pollFiles({ forceRefresh: true });
  }, [pollFiles]);

  const handleManualRefresh = useCallback(() => {
    forceDiffRefetch();
    void pollFiles({ forceRefresh: true });
  }, [forceDiffRefetch, pollFiles]);

  const handleRetryDiff = useCallback(() => {
    forceDiffRefetch();
    if (diffDataRef.current === null) {
      setDiffData(null);
    }
    void fetchAllDiff();
  }, [fetchAllDiff, forceDiffRefetch]);

  useEffect(() => {
    void pollFiles();
  }, [pollFiles]);

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

      const files = filesData?.files.map((stat) => stat.file) ?? [];
      const index = files.indexOf(file);
      addForceRenderFiles([file, files[index - 1], files[index + 1]]);

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
        pendingFileScrollCancelRef.current?.();
        pendingFileScrollCancelRef.current = null;
        performScroll(section);
        return;
      }
      pendingFileScrollCancelRef.current?.();
      pendingFileScrollCancelRef.current = waitForElement(
        getFileSectionSelector(file),
        (element) => {
          pendingFileScrollCancelRef.current = null;
          performScroll(element);
        },
      );
    },
    [addForceRenderFiles, filesData, lockActiveFile, updateCollapsedFiles],
  );

  const scrollToComment = useCallback(
    (commentId: string) => {
      const comment = orderedVisibleComments.find((candidate) => candidate.id === commentId);
      if (!comment) {
        return;
      }

      pendingFileScrollCancelRef.current?.();
      pendingFileScrollCancelRef.current = null;
      setActiveCommentId(comment.id);
      setCommentScrollSeq((seq) => seq + 1);
      lockActiveFile(comment.file);

      const files = filesData?.files.map((stat) => stat.file) ?? [];
      const index = files.indexOf(comment.file);
      addForceRenderFiles([comment.file, files[index - 1], files[index + 1]]);

      updateCollapsedFiles((previous) => {
        if (previous.has(comment.file)) {
          const next = new Set(previous);
          next.delete(comment.file);
          return next;
        }
        return previous;
      });

      // The final positioning is handled by the active-comment effect after
      // React commits any collapsed/deferred file changes. Scrolling here can
      // race the Safari scroll-anchor restoration and produce a visible double
      // jump.
    },
    [
      addForceRenderFiles,
      filesData,
      lockActiveFile,
      orderedVisibleComments,
      updateCollapsedFiles,
    ],
  );

  const scrollToFileComment = useCallback(
    (file: string) => {
      const comment = orderedVisibleComments.find((candidate) => candidate.file === file);
      if (comment) {
        scrollToComment(comment.id);
        return;
      }
      scrollToFile(file, "auto");
    },
    [orderedVisibleComments, scrollToComment, scrollToFile],
  );

  const navigateRelativeComment = useCallback(
    (direction: 1 | -1) => {
      if (orderedVisibleComments.length === 0) {
        return;
      }

      let currentIndex = activeCommentIndex;
      if (currentIndex === -1) {
        currentIndex = direction === 1 ? -1 : 0;
      }
      const nextIndex =
        (currentIndex + direction + orderedVisibleComments.length) % orderedVisibleComments.length;
      const nextComment = orderedVisibleComments[nextIndex];
      if (nextComment) {
        scrollToComment(nextComment.id);
      }
    },
    [activeCommentIndex, orderedVisibleComments, scrollToComment],
  );

  const handlePreviousComment = useCallback(() => {
    navigateRelativeComment(-1);
  }, [navigateRelativeComment]);

  const handleNextComment = useCallback(() => {
    navigateRelativeComment(1);
  }, [navigateRelativeComment]);

  const handleShowResolvedCommentsChange = useCallback(
    (show: boolean) => {
      setResolvedCommentsMode(show ? "show" : "hide");
    },
    [setResolvedCommentsMode],
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
        handleManualRefresh();
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
    toggleCollapse,
  ]);

  const handleDiffModeChange = useCallback(
    (mode: DiffMode) => {
      diffModeRef.current = mode;
      setDiffMode(mode);
      invalidateDiffState();
      void pollFiles({ forceRefresh: true });
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

  const replaceComment = useCallback((nextComment: Comment) => {
    setComments((previous) =>
      previous.map((comment) => (comment.id === nextComment.id ? nextComment : comment)),
    );
  }, []);

  const handleResolveComment = useCallback(
    async (id: string, resolved: boolean) => {
      const response = await fetch(`/api/comments?id=${id}`, {
        body: JSON.stringify({ action: resolved ? "resolve" : "unresolve" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) {
        const errorBody = (await response
          .json()
          .catch(() => ({ error: "Failed to update comment" }))) as DiffErrorResponse;
        console.error("[diffhub] resolve comment failed", {
          error: errorBody.error ?? `Failed to update comment (${response.status})`,
        });
        return false;
      }

      replaceComment((await response.json()) as Comment);
      return true;
    },
    [replaceComment],
  );

  const handleReplyToComment = useCallback(
    async (id: string, body: string) => {
      const response = await fetch(`/api/comments?id=${id}`, {
        body: JSON.stringify({ action: "reply", body }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) {
        const errorBody = (await response
          .json()
          .catch(() => ({ error: "Failed to save reply" }))) as DiffErrorResponse;
        console.error("[diffhub] reply failed", {
          error: errorBody.error ?? `Failed to save reply (${response.status})`,
        });
        return false;
      }

      replaceComment((await response.json()) as Comment);
      return true;
    },
    [replaceComment],
  );

  const syncNotice = getSyncNotice(loadError, filesData, deferredDiffData, diffError);

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
        onSelectFileComment={scrollToFileComment}
        onSelectComment={scrollToComment}
        comments={orderedVisibleComments}
        activeCommentId={activeCommentId}
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
            onRefresh={handleManualRefresh}
            watchStatus={watchStatus}
            comments={orderedVisibleComments}
            onClearComments={handleClearComments}
            totalCommentCount={comments.length}
            activeCommentIndex={activeCommentIndex}
            showResolvedComments={showResolvedComments}
            onShowResolvedCommentsChange={handleShowResolvedCommentsChange}
            onPreviousComment={handlePreviousComment}
            onNextComment={handleNextComment}
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
          comments={orderedVisibleComments}
          activeCommentId={activeCommentId}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          onResolveComment={handleResolveComment}
          onReplyToComment={handleReplyToComment}
          onNavigateComment={scrollToComment}
          selectedFile={selectedFile}
          collapsedFiles={collapsedFiles}
          forceRenderFiles={forceRenderFiles}
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
