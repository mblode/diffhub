"use client";

import dynamic from "next/dynamic";
import {
  Component,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useTheme } from "next-themes";
import type {
  AnnotationSide,
  CodeViewDiffItem,
  CodeViewItem,
  CodeViewOptions,
  DiffLineAnnotation,
} from "@pierre/diffs";
import type { CodeViewHandle } from "@pierre/diffs/react";
import { useWorkerPool } from "@pierre/diffs/react";
import { toAnnotationSide } from "@/lib/comment-sides";
import type { Comment, CommentTag } from "@/lib/comment-types";
import type { DiffFileStat } from "@/lib/diff-file-stat";
import { CODE_VIEW_LAYOUT, DEFAULT_DIFF_THEMES } from "@diffhub/diff-core";
import { FileDiffHeader, usePatchLoader, useIsWorkerPoolReady } from "@diffhub/diff-core/react";
import { cn } from "@/lib/utils";
import { BranchIcon, CopySimpleIcon, TrashIcon, CheckIcon } from "blode-icons-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";

// ── Shared constants ─────────────────────────────────────────────────────────

const TAG_META: Partial<Record<CommentTag, { text: string; border: string }>> = {
  "[must-fix]": { border: "border-l-destructive", text: "text-destructive" },
  "[nit]": { border: "border-l-muted-foreground/40", text: "text-muted-foreground" },
  "[question]": { border: "border-l-diff-purple", text: "text-diff-purple" },
  "[suggestion]": { border: "border-l-diff-green", text: "text-diff-green" },
};
const EMPTY_COMMENTS: readonly Comment[] = [];

// Lines longer than this skip syntax tokenization (rendered as plain text) so a
// single minified/generated line can't block the highlighter. Kept in sync with
// the worker-pool init in DiffsWorkerProvider.
const LONG_LINE_TOKENIZE_LIMIT = 5000;

type DiffMode = "all" | "uncommitted";

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatRelativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return "just now";
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr}h ago`;
  }
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
};

type AnnotationData = { type: "comment"; comment: Comment } | { type: "input"; file: string };

const DiffSkeleton = () => (
  <div className="animate-pulse">
    {/* Simulated file header */}
    <div className="h-9 border-b border-border bg-card" />
    {/* Simulated diff lines */}
    <div>
      <div className="flex h-[22px] items-center gap-3 px-3 bg-diff-green/5">
        <div className="h-2 w-6 shrink-0 rounded bg-diff-green/20" />
        <div className="h-2 rounded bg-diff-green/15" style={{ width: "67%" }} />
      </div>
      <div className="flex h-[22px] items-center gap-3 px-3">
        <div className="h-2 w-6 shrink-0 rounded bg-muted" />
        <div className="h-2 rounded bg-muted" style={{ width: "82%" }} />
      </div>
      <div className="flex h-[22px] items-center gap-3 px-3 bg-destructive/5">
        <div className="h-2 w-6 shrink-0 rounded bg-destructive/20" />
        <div className="h-2 rounded bg-destructive/15" style={{ width: "54%" }} />
      </div>
      <div className="flex h-[22px] items-center gap-3 px-3">
        <div className="h-2 w-6 shrink-0 rounded bg-muted" />
        <div className="h-2 rounded bg-muted" style={{ width: "78%" }} />
      </div>
      <div className="flex h-[22px] items-center gap-3 px-3 bg-diff-green/5">
        <div className="h-2 w-6 shrink-0 rounded bg-diff-green/20" />
        <div className="h-2 rounded bg-diff-green/15" style={{ width: "91%" }} />
      </div>
    </div>
  </div>
);

interface DiffErrorBoundaryProps {
  children: ReactNode;
}

interface DiffErrorBoundaryState {
  error: Error | null;
}

class DiffErrorBoundary extends Component<DiffErrorBoundaryProps, DiffErrorBoundaryState> {
  constructor(props: DiffErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): DiffErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the boundary's own state so future renders can correlate logs.
    console.error("[diffhub] CodeView threw", {
      componentStack: info.componentStack,
      error: error.message,
      previousError: this.state.error?.message,
    });
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="px-4 py-6 text-sm text-destructive">
          Failed to render diffs: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

/* oxlint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks */
const CodeView = dynamic(
  () =>
    import("@pierre/diffs/react")
      .then((m) => ({ default: m.CodeView }))
      .catch((error) => {
        console.error("[diffhub] Failed to load CodeView", error);
        return {
          default: () => (
            <div className="p-4 text-destructive text-sm">
              Failed to load diff viewer: {String(error)}
            </div>
          ),
        };
      }),
  { loading: () => <DiffSkeleton />, ssr: false },
  // The dynamic() generic erases CodeView's own generic, so we re-assert the
  // uncontrolled-prop shape we actually use here.
) as unknown as (props: {
  key?: React.Key;
  ref?: React.Ref<CodeViewHandle<AnnotationData>>;
  initialItems?: readonly CodeViewItem<AnnotationData>[];
  options?: CodeViewOptions<AnnotationData>;
  className?: string;
  style?: React.CSSProperties;
  containerRef?: React.Ref<HTMLDivElement>;
  onScroll?: (scrollTop: number, viewer: unknown) => void;
  renderCustomHeader?: (item: CodeViewItem<AnnotationData>) => ReactNode;
  renderAnnotation?: (
    annotation: DiffLineAnnotation<AnnotationData>,
    item: CodeViewItem<AnnotationData>,
  ) => ReactNode;
  renderGutterUtility?: (
    getHoveredLine: () => { lineNumber: number; side: AnnotationSide } | undefined,
    item: CodeViewItem<AnnotationData>,
  ) => ReactNode;
}) => React.JSX.Element;
/* oxlint-enable promise/prefer-await-to-then, promise/prefer-await-to-callbacks */

interface InlineCommentInputProps {
  onSubmit: (body: string, tag: CommentTag) => Promise<boolean>;
  onCancel: () => void;
}

const InlineCommentInput = ({ onSubmit, onCancel }: InlineCommentInputProps) => {
  const [body, setBody] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const focusInput = useCallback((node: HTMLTextAreaElement | null) => {
    node?.focus({ preventScroll: true });
  }, []);

  const handleSubmit = useCallback(async (): Promise<void> => {
    const trimmedBody = body.trim();
    if (!trimmedBody || isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const saved = await onSubmit(trimmedBody, "").catch(() => false);
    if (!saved) {
      setErrorMessage("Failed to save comment.");
    }

    setIsSubmitting(false);
  }, [body, isSubmitting, onSubmit]);

  return (
    <div className="my-1 mx-4 rounded-md border border-border bg-background p-3 shadow-lg dark:shadow-none">
      <textarea
        ref={focusInput}
        value={body}
        // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment for the AI"
        rows={3}
        // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onKeyDown={(e) => {
          if (((e.key === "Enter" && e.metaKey) || e.key === "Return") && body.trim()) {
            void handleSubmit();
          }
          if (e.key === "Escape") {
            onCancel();
          }
        }}
        className="w-full resize-none rounded border-0 bg-transparent px-0 py-0 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!body.trim() || isSubmitting}
          // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
          onClick={() => void handleSubmit()}
        >
          {isSubmitting ? "Saving…" : "Comment"}
        </Button>
      </div>
      {errorMessage && <p className="mt-2 text-xs text-destructive">{errorMessage}</p>}
    </div>
  );
};

const CommentDisplay = ({
  comment,
  onDelete,
}: {
  comment: Comment;
  onDelete: () => Promise<boolean>;
}) => {
  const [copied, setCopied] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }
    },
    [],
  );

  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const handleCopy = async (): Promise<void> => {
    const text = comment.tag ? `${comment.tag} ${comment.body}` : comment.body;
    try {
      await navigator.clipboard.writeText(text);
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      setCopied(true);
      copiedTimerRef.current = setTimeout(() => {
        setCopied(false);
        copiedTimerRef.current = null;
      }, 1500);
    } catch {
      // clipboard unavailable
    }
  };

  const handleDelete = useCallback(async (): Promise<void> => {
    if (isDeleting) {
      return;
    }

    setDeleteError(null);
    setIsDeleting(true);

    const deleted = await onDelete().catch(() => false);
    if (!deleted) {
      setDeleteError("Failed to delete comment.");
    }

    setIsDeleting(false);
  }, [isDeleting, onDelete]);

  const borderAccent = comment.tag
    ? (TAG_META[comment.tag]?.border ?? "border-l-ring/40")
    : "border-l-ring/40";

  return (
    <div
      className={cn(
        "group my-1 mx-4 rounded-md border border-border bg-card shadow-sm dark:shadow-none overflow-hidden border-l-2",
        borderAccent,
      )}
    >
      {/* Body row */}
      <div className="flex items-start gap-2 px-3 py-2.5">
        {comment.tag && (
          <span
            className={cn(
              "shrink-0 mt-0.5 text-[11px]",
              TAG_META[comment.tag]?.text ?? "text-muted-foreground",
            )}
          >
            {comment.tag}
          </span>
        )}
        <p className="flex-1 text-sm text-foreground leading-relaxed">{comment.body}</p>
        {/* Action buttons — hover-revealed */}
        <TooltipProvider delay={400}>
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label={copied ? "Comment copied" : "Copy comment"}
                    className={cn(
                      "rounded p-1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
                      copied
                        ? "text-diff-green"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                    )}
                  />
                }
              >
                {copied ? <CheckIcon size={12} /> : <CopySimpleIcon size={12} />}
              </TooltipTrigger>
              <TooltipContent side="top">{copied ? "Copied!" : "Copy comment"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={handleDelete}
                    aria-label="Delete comment"
                    disabled={isDeleting}
                    className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
                  />
                }
              >
                <TrashIcon size={12} />
              </TooltipTrigger>
              <TooltipContent side="top">Delete comment</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
      {/* Footer strip */}
      <div className="border-t border-border/40 px-3 py-1 flex items-center gap-2 text-[10px] text-muted-foreground/60">
        <span>L{comment.lineNumber}</span>
        {comment.createdAt && (
          <>
            <span>·</span>
            <span>{formatRelativeTime(comment.createdAt)}</span>
          </>
        )}
      </div>
      {deleteError && <p className="px-3 pb-2 text-xs text-destructive">{deleteError}</p>}
    </div>
  );
};

export const getDiffSectionId = (file: string): string => `diff-${encodeURIComponent(file)}`;

interface CommentTarget {
  file: string;
  lineNumber: number;
  side: AnnotationSide;
}

interface GutterButtonProps {
  getHoveredLine: () => { lineNumber: number; side: AnnotationSide } | undefined;
  file: string;
  onCommentTargetChange: (target: CommentTarget | null) => void;
}

const GutterButton = memo(function GutterButton({
  getHoveredLine,
  file,
  onCommentTargetChange,
}: GutterButtonProps) {
  const handleClick = useCallback(() => {
    const line = getHoveredLine();
    if (line) {
      onCommentTargetChange({ file, lineNumber: line.lineNumber, side: line.side });
    }
  }, [getHoveredLine, file, onCommentTargetChange]);

  return (
    <button
      type="button"
      className="diffhub-gutter-btn"
      title="Add comment for AI"
      onClick={handleClick}
    >
      +
    </button>
  );
});

export interface DiffViewerHandle {
  scrollToFile: (file: string) => void;
}

interface DiffViewerProps {
  // Streaming load inputs.
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
  activeFileId: string | null;
  fileStats: DiffFileStat[];
  collapsedFiles: Set<string>;
  onToggleCollapse: (file: string) => void;
  onActiveFileChange: (file: string) => void;
  repoPath: string;
  // Display toggles (optional, sensible GitHub-style defaults).
  showLineNumbers?: boolean;
  wordWrap?: boolean;
  showBackgrounds?: boolean;
  diffIndicators?: "classic" | "bars" | "none";
  // Syntax theme ids per color scheme. Pushed into the worker pool via
  // setRenderOptions so background tokenizers reload the active themes.
  diffThemes?: { light: string; dark: string };
}

const EmptyState = () => (
  <Empty className="h-full">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <BranchIcon />
      </EmptyMedia>
      <EmptyTitle>No changes</EmptyTitle>
      <EmptyDescription>The working tree is clean relative to the base branch</EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <p className="text-xs text-muted-foreground/60">
        Press <Kbd>r</Kbd> to force refresh
      </p>
    </EmptyContent>
  </Empty>
);

const DiffViewerInner = (
  {
    reloadKey,
    diffMode,
    layout,
    comments,
    onAddComment,
    onDeleteComment,
    activeFileId,
    fileStats,
    collapsedFiles,
    onToggleCollapse,
    onActiveFileChange,
    repoPath,
    showLineNumbers = true,
    wordWrap = false,
    showBackgrounds = true,
    diffIndicators = "classic",
    diffThemes = DEFAULT_DIFF_THEMES,
  }: DiffViewerProps,
  ref: React.Ref<DiffViewerHandle>,
) => {
  const { resolvedTheme } = useTheme();
  const themeType: "light" | "dark" = resolvedTheme === "light" ? "light" : "dark";
  const workerPool = useWorkerPool();
  const isWorkerReady = useIsWorkerPoolReady();
  // useWorkerPool can return a fresh reference across renders; read it through a
  // ref so the imperative handle stays stable (constant-size deps).
  const workerPoolRef = useRef(workerPool);
  workerPoolRef.current = workerPool;

  const codeViewRef = useRef<CodeViewHandle<AnnotationData> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Single active inline-comment input target (gutter "+").
  const [commentTarget, setCommentTarget] = useState<CommentTarget | null>(null);

  // ── Live refs for the streaming/imperative paths ───────────────────────────
  const commentsByFile = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const comment of comments) {
      const list = map.get(comment.file);
      if (list) {
        list.push(comment);
      } else {
        map.set(comment.file, [comment]);
      }
    }
    return map;
  }, [comments]);
  const commentsByFileRef = useRef(commentsByFile);
  commentsByFileRef.current = commentsByFile;
  const commentTargetRef = useRef(commentTarget);
  commentTargetRef.current = commentTarget;
  const collapsedFilesRef = useRef(collapsedFiles);
  collapsedFilesRef.current = collapsedFiles;

  // Item ids handed to the viewer (for collapse + annotation reconciliation),
  // and the subset that currently carries a saved-comment annotation.
  const loadedItemIdsRef = useRef<Set<string>>(new Set());
  const annotatedItemIdsRef = useRef<Set<string>>(new Set());
  const prevTargetFileRef = useRef<string | null>(null);

  const fileStatMap = useMemo(() => {
    const map = new Map<string, DiffFileStat>();
    for (const stat of fileStats) {
      map.set(stat.file, stat);
    }
    return map;
  }, [fileStats]);

  // Build the annotation list for a single item from the current comments +
  // active input target. Shared by the streaming stamp and the reconcilers.
  const buildAnnotationsForItem = useCallback(
    (itemId: string): DiffLineAnnotation<AnnotationData>[] => {
      const fileComments = commentsByFileRef.current.get(itemId) ?? (EMPTY_COMMENTS as Comment[]);
      const annotations: DiffLineAnnotation<AnnotationData>[] = fileComments.map((comment) => ({
        lineNumber: comment.lineNumber,
        metadata: { comment, type: "comment" as const },
        side: toAnnotationSide(comment.side),
      }));
      const target = commentTargetRef.current;
      if (target && target.file === itemId) {
        annotations.push({
          lineNumber: target.lineNumber,
          metadata: { file: itemId, type: "input" as const },
          side: target.side,
        });
      }
      return annotations;
    },
    [],
  );

  // Stamp freshly built items (initial batch + streamed batches) with their
  // current collapse state and annotations before they reach the viewer.
  const prepareItems = useCallback(
    (items: CodeViewDiffItem<AnnotationData>[]): void => {
      const collapsed = collapsedFilesRef.current;
      for (const item of items) {
        loadedItemIdsRef.current.add(item.id);
        item.collapsed = collapsed.has(item.id);
        const annotations = buildAnnotationsForItem(item.id);
        item.annotations = annotations;
        if (annotations.some((annotation) => annotation.metadata?.type === "comment")) {
          annotatedItemIdsRef.current.add(item.id);
        }
      }
    },
    [buildAnnotationsForItem],
  );

  const handleReset = useCallback(() => {
    loadedItemIdsRef.current = new Set();
    annotatedItemIdsRef.current = new Set();
    prevTargetFileRef.current = null;
    setCommentTarget(null);
  }, []);

  const endpoint = useMemo(
    () => (diffMode === "uncommitted" ? "/api/diff?mode=uncommitted" : "/api/diff"),
    [diffMode],
  );

  const { initialItems, loadState, errorMessage, viewerKey, retry } =
    usePatchLoader<AnnotationData>({
      endpoint,
      onReset: handleReset,
      prepareItems,
      reloadKey,
      viewerRef: codeViewRef,
    });

  // ── Push theme changes into the worker pool ────────────────────────────────
  // Background tokenizers keep the pair they were initialized with unless we
  // tell them otherwise, so re-resolve on every theme/themeType change.
  useLayoutEffect(() => {
    if (workerPool === undefined) {
      return;
    }
    void workerPool.setRenderOptions({ theme: { dark: diffThemes.dark, light: diffThemes.light } });
  }, [workerPool, diffThemes.dark, diffThemes.light]);

  // ── Reconcile saved comments + active input annotation imperatively ────────
  useEffect(() => {
    const viewer = codeViewRef.current;
    if (!viewer) {
      return;
    }

    const touched = new Set<string>();
    for (const id of annotatedItemIdsRef.current) {
      touched.add(id);
    }
    for (const id of commentsByFile.keys()) {
      touched.add(id);
    }
    if (commentTarget) {
      touched.add(commentTarget.file);
    }
    if (prevTargetFileRef.current) {
      touched.add(prevTargetFileRef.current);
    }
    prevTargetFileRef.current = commentTarget?.file ?? null;

    const nextAnnotated = new Set<string>();
    for (const id of touched) {
      const item = viewer.getItem(id);
      if (!item || item.type !== "diff") {
        continue;
      }
      const annotations = buildAnnotationsForItem(id);
      item.annotations = annotations;
      item.version = (item.version ?? 0) + 1;
      viewer.updateItem(item);
      if (annotations.some((annotation) => annotation.metadata?.type === "comment")) {
        nextAnnotated.add(id);
      }
    }
    annotatedItemIdsRef.current = nextAnnotated;
  }, [comments, commentTarget, commentsByFile, buildAnnotationsForItem]);

  // ── Reconcile collapse state imperatively (sidebar/keyboard driven) ────────
  useEffect(() => {
    const viewer = codeViewRef.current;
    if (!viewer) {
      return;
    }
    const instance = viewer.getInstance();

    for (const id of loadedItemIdsRef.current) {
      const item = viewer.getItem(id);
      if (!item || item.type !== "diff") {
        continue;
      }
      const shouldCollapse = collapsedFiles.has(id);
      if ((item.collapsed ?? false) === shouldCollapse) {
        continue;
      }
      // If the item starts above the viewport, anchor it after collapsing so
      // the change does not yank the scroll position (matches the reference).
      const top = instance?.getTopForItem(id);
      item.collapsed = shouldCollapse;
      item.version = (item.version ?? 0) + 1;
      viewer.updateItem(item);
      if (shouldCollapse && instance && top !== undefined && top < instance.getScrollTop()) {
        viewer.scrollTo({ align: "start", id, type: "item" });
      }
    }
  }, [collapsedFiles]);

  // Imperative scroll-to-file for DiffApp (sidebar clicks, j/k navigation).
  useImperativeHandle(
    ref,
    () => ({
      scrollToFile: (file: string) => {
        // Prime the worker highlight cache for the navigation target before we
        // scroll to it, so a virtualized-away file is already (or nearly)
        // highlighted by the time scrollTo materializes it — avoiding a
        // plain-text flash on sidebar clicks and j/k jumps.
        const item = codeViewRef.current?.getItem(file);
        const pool = workerPoolRef.current;
        if (pool && item?.type === "diff") {
          pool.primeDiffHighlightCache(item.fileDiff);
        }
        codeViewRef.current?.scrollTo({ align: "start", id: file, type: "item" });
      },
    }),
    [],
  );

  // Active-file tracking: on scroll, read the topmost rendered item from the
  // CodeView instance and report it up (rAF-debounced).
  const activeFileRafRef = useRef(0);
  const pendingActiveFileRef = useRef<string | null>(null);
  const onActiveFileChangeRef = useRef(onActiveFileChange);
  useEffect(() => {
    onActiveFileChangeRef.current = onActiveFileChange;
  }, [onActiveFileChange]);

  useEffect(
    () => () => {
      if (activeFileRafRef.current !== 0) {
        cancelAnimationFrame(activeFileRafRef.current);
        activeFileRafRef.current = 0;
      }
    },
    [],
  );

  const handleScroll = useCallback((_scrollTop: number, viewer: unknown) => {
    const instance = viewer as
      | { getRenderedItems?: () => { id: string; top?: number }[] }
      | undefined;
    const rendered = instance?.getRenderedItems?.();
    if (!rendered || rendered.length === 0) {
      return;
    }

    // Topmost rendered item is the active file.
    const [firstItem] = rendered;
    let topItem = firstItem;
    for (const item of rendered) {
      if ((item.top ?? 0) < (topItem.top ?? 0)) {
        topItem = item;
      }
    }
    pendingActiveFileRef.current = topItem.id;

    if (activeFileRafRef.current !== 0) {
      return;
    }
    activeFileRafRef.current = requestAnimationFrame(() => {
      activeFileRafRef.current = 0;
      const file = pendingActiveFileRef.current;
      pendingActiveFileRef.current = null;
      if (file) {
        onActiveFileChangeRef.current(file);
      }
    });
  }, []);

  const options = useMemo<CodeViewOptions<AnnotationData>>(
    () => ({
      diffIndicators,
      diffStyle: layout === "split" ? "split" : "unified",
      disableBackground: !showBackgrounds,
      // Must stay false: providing `renderCustomHeader` switches the header
      // render mode to "custom", but the header host (the slot our React header
      // mounts into) is only created when the file header is NOT disabled.
      // Setting this true deletes the host entirely → no file headers render.
      disableFileHeader: false,
      disableLineNumbers: !showLineNumbers,
      enableGutterUtility: true,
      // Lean on CodeView's virtualizer: render unchanged context regions in
      // full instead of collapsing them into "N unmodified lines" banners.
      expandUnchanged: true,
      expansionLineCount: 100,
      hunkSeparators: "line-info",
      layout: CODE_VIEW_LAYOUT,
      lineDiffType: "word-alt",
      lineHoverHighlight: "number",
      maxLineDiffLength: 500,
      overflow: wordWrap ? "wrap" : "scroll",
      stickyHeaders: true,
      theme: { dark: diffThemes.dark, light: diffThemes.light },
      themeType,
      // Long-line safeguard: skip syntax tokenization on pathological lines
      // (minified JS/CSS, giant base64) so one huge line can't stall a worker.
      // The line still renders as plain text.
      tokenizeMaxLineLength: LONG_LINE_TOKENIZE_LIMIT,
      // No unsafeCSS color override: render with the pierre theme's native diff
      // colors + rounded `[data-diff-span]` pills, matching diffshub.com exactly.
    }),
    [
      diffIndicators,
      layout,
      showBackgrounds,
      showLineNumbers,
      wordWrap,
      themeType,
      diffThemes.dark,
      diffThemes.light,
    ],
  );

  const renderCustomHeader = useCallback(
    (item: CodeViewItem<AnnotationData>) => {
      if (item.type !== "diff") {
        return null;
      }
      const file = item.id;
      const fileStat = fileStatMap.get(file);
      const fileComments = commentsByFile.get(file) ?? (EMPTY_COMMENTS as Comment[]);
      const sectionId = getDiffSectionId(file);
      return (
        <FileDiffHeader
          file={file}
          insertions={fileStat?.insertions ?? 0}
          deletions={fileStat?.deletions ?? 0}
          commentCount={fileComments.length}
          repoPath={repoPath}
          collapsed={item.collapsed ?? false}
          active={activeFileId === file}
          // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
          onToggleCollapse={() => onToggleCollapse(file)}
          headingId={`${sectionId}-header`}
          panelId={`${sectionId}-panel`}
        />
      );
    },
    [fileStatMap, commentsByFile, repoPath, activeFileId, onToggleCollapse],
  );

  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<AnnotationData>) => {
      const d = annotation.metadata;
      if (!d) {
        return null;
      }

      if (d.type === "input") {
        return (
          <InlineCommentInput
            // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onSubmit={async (body, tag) => {
              const saved = await onAddComment(
                d.file,
                annotation.lineNumber,
                annotation.side,
                body,
                tag,
              );
              if (saved) {
                setCommentTarget(null);
              }
              return saved;
            }}
            // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onCancel={() => setCommentTarget(null)}
          />
        );
      }

      if (d.type === "comment") {
        return (
          // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
          <CommentDisplay comment={d.comment} onDelete={() => onDeleteComment(d.comment.id)} />
        );
      }

      return null;
    },
    [onAddComment, onDeleteComment],
  );

  const renderGutterUtility = useCallback(
    (
      getHoveredLine: () => { lineNumber: number; side: AnnotationSide } | undefined,
      item: CodeViewItem<AnnotationData>,
    ) => (
      <GutterButton
        getHoveredLine={getHoveredLine}
        file={item.id}
        onCommentTargetChange={setCommentTarget}
      />
    ),
    [],
  );

  if (loadState === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="text-sm text-destructive">{errorMessage ?? "Failed to load the diff."}</div>
        <Button size="sm" variant="default" onClick={retry}>
          Retry
        </Button>
      </div>
    );
  }

  // Withhold the viewer until the worker pool has initialized so the first
  // batch tokenizes against the real highlighter, and until we have something
  // to render.
  const hasContent = loadState === "ready" || initialItems.length > 0;
  if (!isWorkerReady || !hasContent) {
    if (loadState === "ready" && initialItems.length === 0) {
      return <EmptyState />;
    }
    return <DiffSkeleton />;
  }

  if (loadState === "ready" && initialItems.length === 0) {
    return <EmptyState />;
  }

  return (
    <div id="diff-container" className="flex min-h-0 flex-1 flex-col">
      <DiffErrorBoundary>
        <CodeView
          key={viewerKey}
          ref={codeViewRef}
          containerRef={containerRef}
          initialItems={initialItems}
          options={options}
          className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-clip overscroll-contain [overflow-anchor:none]"
          onScroll={handleScroll}
          renderCustomHeader={renderCustomHeader}
          renderAnnotation={renderAnnotation}
          renderGutterUtility={renderGutterUtility}
        />
      </DiffErrorBoundary>
    </div>
  );
};

export const DiffViewer = forwardRef<DiffViewerHandle, DiffViewerProps>(DiffViewerInner);
