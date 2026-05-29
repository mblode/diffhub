"use client";

import dynamic from "next/dynamic";
import {
  Component,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useTheme } from "next-themes";
import type {
  AnnotationSide,
  CodeViewDiffItem,
  CodeViewOptions,
  DiffLineAnnotation,
  FileDiffMetadata,
} from "@pierre/diffs";
import { parsePatchFiles } from "@pierre/diffs";
import type { CodeViewHandle } from "@pierre/diffs/react";
import { toAnnotationSide } from "@/lib/comment-sides";
import type { Comment, CommentTag } from "@/lib/comment-types";
import type { DiffFileStat } from "@/lib/diff-file-stat";
import type { DiffTheme } from "@/lib/diff-colors";
import { getDiffUnsafeCSS } from "@/lib/diff-colors";
import { DEFAULT_DIFF_THEMES } from "@/lib/diff-themes";
import { FileDiffHeader } from "./FileDiffHeader";
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
  // controlled-prop shape we actually use here.
) as unknown as (props: {
  ref?: React.Ref<CodeViewHandle<AnnotationData>>;
  items: readonly CodeViewDiffItem<AnnotationData>[];
  options?: CodeViewOptions<AnnotationData>;
  className?: string;
  style?: React.CSSProperties;
  disableWorkerPool?: boolean;
  onScroll?: (scrollTop: number, viewer: unknown) => void;
  renderCustomHeader?: (item: CodeViewDiffItem<AnnotationData>) => ReactNode;
  renderAnnotation?: (
    annotation: DiffLineAnnotation<AnnotationData>,
    item: CodeViewDiffItem<AnnotationData>,
  ) => ReactNode;
  renderGutterUtility?: (
    getHoveredLine: () => { lineNumber: number; side: AnnotationSide } | undefined,
    item: CodeViewDiffItem<AnnotationData>,
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

/**
 * Sort files in tree display order to match the sidebar:
 * at each directory level, subdirectories (and their contents)
 * come before files, with both groups sorted alphabetically.
 */
const sortFilesAsTree = (files: string[]): string[] => {
  interface TreeNode {
    files: string[];
    folders: Map<string, TreeNode>;
  }

  const root: TreeNode = { files: [], folders: new Map() };

  // Build tree structure
  for (const file of files) {
    const parts = file.split("/");
    let current = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      if (!current.folders.has(part)) {
        current.folders.set(part, { files: [], folders: new Map() });
      }
      const next = current.folders.get(part);
      if (next) {
        current = next;
      }
    }
    current.files.push(file);
  }

  // Flatten in tree order (depth-first: folders before files, both sorted alphabetically)
  const result: string[] = [];

  const flatten = (node: TreeNode): void => {
    // Folders first, sorted alphabetically by folder name
    const sortedFolders = [...node.folders.entries()].toSorted((a, b) => a[0].localeCompare(b[0]));
    for (const [, child] of sortedFolders) {
      flatten(child);
    }
    // Then files, sorted alphabetically by filename
    const sortedFiles = [...node.files].toSorted((a, b) => {
      const nameA = a.split("/").at(-1) ?? a;
      const nameB = b.split("/").at(-1) ?? b;
      return nameA.localeCompare(nameB);
    });
    result.push(...sortedFiles);
  };

  flatten(root);
  return result;
};

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

// Parse a single-file patch into FileDiffMetadata, memoized per (file, patch).
// CodeView re-renders for theme/layout/comment changes must not reparse every
// file, so we cache by patch identity.
const parseFileDiff = (file: string, patch: string): FileDiffMetadata | null => {
  if (!patch) {
    return null;
  }
  try {
    const parsed = parsePatchFiles(patch);
    const [first] = parsed;
    const [fileDiff] = first?.files ?? [];
    return fileDiff ?? null;
  } catch (error) {
    console.error("[diffhub] Failed to parse patch", { error, file });
    return null;
  }
};

export interface DiffViewerHandle {
  scrollToFile: (file: string) => void;
}

interface DiffViewerProps {
  patchesByFile: Record<string, string>;
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
  // Syntax theme ids per color scheme (optional, github defaults). Theme ids
  // resolve lazily on the main thread via @pierre/diffs, so changing them just
  // re-renders CodeView with the new theme — no preload needed.
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
    patchesByFile,
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
    wordWrap = true,
    showBackgrounds = true,
    diffIndicators = "classic",
    diffThemes = DEFAULT_DIFF_THEMES,
  }: DiffViewerProps,
  ref: React.Ref<DiffViewerHandle>,
) => {
  const { resolvedTheme } = useTheme();
  const themeType = resolvedTheme === "light" ? "light" : "dark";

  const codeViewRef = useRef<CodeViewHandle<AnnotationData> | null>(null);
  const [commentTarget, setCommentTarget] = useState<CommentTarget | null>(null);

  const fileStatMap = useMemo(() => {
    const map = new Map<string, DiffFileStat>();
    for (const s of fileStats) {
      map.set(s.file, s);
    }
    return map;
  }, [fileStats]);

  const orderedFiles = useMemo(() => {
    const files = fileStats.map((fileStat) => fileStat.file);
    const extras = Object.keys(patchesByFile).filter((file) => !fileStatMap.has(file));
    return sortFilesAsTree([...files, ...extras]);
  }, [fileStatMap, fileStats, patchesByFile]);

  const commentsByFile = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const comment of comments) {
      const bucket = map.get(comment.file);
      if (bucket) {
        bucket.push(comment);
      } else {
        map.set(comment.file, [comment]);
      }
    }
    return map;
  }, [comments]);

  // Memoize parsing per (file, patch). The cache survives re-renders so theme,
  // layout, and comment changes never reparse an unchanged patch.
  const parsedCacheRef = useRef(
    new Map<string, { patch: string; fileDiff: FileDiffMetadata | null }>(),
  );
  const getParsedFileDiff = useCallback((file: string, patch: string): FileDiffMetadata | null => {
    const cache = parsedCacheRef.current;
    const cached = cache.get(file);
    if (cached && cached.patch === patch) {
      return cached.fileDiff;
    }
    const fileDiff = parseFileDiff(file, patch);
    cache.set(file, { fileDiff, patch });
    return fileDiff;
  }, []);

  const items = useMemo((): CodeViewDiffItem<AnnotationData>[] => {
    const result: CodeViewDiffItem<AnnotationData>[] = [];
    for (const file of orderedFiles) {
      const patch = patchesByFile[file] ?? "";
      const fileDiff = getParsedFileDiff(file, patch);
      if (!fileDiff) {
        continue;
      }

      const fileComments = commentsByFile.get(file) ?? (EMPTY_COMMENTS as Comment[]);
      const annotations: DiffLineAnnotation<AnnotationData>[] = fileComments.map((c) => ({
        lineNumber: c.lineNumber,
        metadata: { comment: c, type: "comment" as const },
        side: toAnnotationSide(c.side),
      }));

      if (commentTarget && commentTarget.file === file) {
        annotations.push({
          lineNumber: commentTarget.lineNumber,
          metadata: { file, type: "input" as const },
          side: commentTarget.side,
        });
      }

      result.push({
        annotations,
        collapsed: collapsedFiles.has(file),
        fileDiff,
        id: file,
        type: "diff",
      });
    }
    return result;
  }, [
    orderedFiles,
    patchesByFile,
    getParsedFileDiff,
    commentsByFile,
    commentTarget,
    collapsedFiles,
  ]);

  const options = useMemo<CodeViewOptions<AnnotationData>>(
    () => ({
      diffIndicators,
      diffStyle: layout === "split" ? "split" : "unified",
      disableBackground: !showBackgrounds,
      disableFileHeader: true,
      disableLineNumbers: !showLineNumbers,
      enableGutterUtility: true,
      // Lean on CodeView's virtualizer: render unchanged context regions in
      // full instead of collapsing them into "N unmodified lines" banners.
      // With expandUnchanged the context is always shown, so expansionLineCount
      // (lines revealed per expand click) and collapsedContextThreshold (the
      // gap size that triggers a collapse) are effectively unused; we still
      // pass a large expansionLineCount for the rare manual-expand fallback.
      expandUnchanged: true,
      expansionLineCount: 100,
      hunkSeparators: "line-info",
      lineDiffType: "word-alt",
      lineHoverHighlight: "disabled",
      maxLineDiffLength: 500,
      overflow: wordWrap ? "wrap" : "scroll",
      stickyHeaders: true,
      theme: { dark: diffThemes.dark, light: diffThemes.light },
      themeType,
      unsafeCSS: getDiffUnsafeCSS(themeType as DiffTheme),
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

  // Imperative scroll-to-file for DiffApp (sidebar clicks, j/k navigation).
  useImperativeHandle(
    ref,
    () => ({
      scrollToFile: (file: string) => {
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

  const renderCustomHeader = useCallback(
    (item: CodeViewDiffItem<AnnotationData>) => {
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
      item: CodeViewDiffItem<AnnotationData>,
    ) => (
      <GutterButton
        getHoveredLine={getHoveredLine}
        file={item.id}
        onCommentTargetChange={setCommentTarget}
      />
    ),
    [],
  );

  if (orderedFiles.length === 0) {
    return <EmptyState />;
  }

  return (
    <div id="diff-container">
      <DiffErrorBoundary>
        <CodeView
          ref={codeViewRef}
          items={items}
          options={options}
          disableWorkerPool
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
