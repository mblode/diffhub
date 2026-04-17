"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type { DiffLineAnnotation, AnnotationSide } from "@pierre/diffs";
import { toAnnotationSide } from "@/lib/comment-sides";
import type { Comment, CommentTag } from "@/lib/comment-types";
import type { DiffFileStat } from "@/lib/diff-file-stat";
import { isLargeDiffFile } from "@/lib/diff-file-stat";
import type { PrerenderedDiffHtml } from "@/lib/diff-prerender";
import type { DiffTheme } from "@/lib/diff-colors";
import { getDiffUnsafeCSS } from "@/lib/diff-colors";
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
const LARGE_DIFF_FALLBACK_FILE_THRESHOLD = 24;

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

interface DeferredDiffPlaceholderProps {
  onRender: () => void;
  variant: "auto" | "large";
  changes?: number;
}

const DeferredDiffPlaceholder = ({ onRender, variant, changes }: DeferredDiffPlaceholderProps) => {
  const isLarge = variant === "large";
  return (
    <div
      className="mx-4 my-4 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 p-6"
      data-testid="deferred-diff-placeholder"
      data-variant={variant}
    >
      <Button size="sm" variant="default" onClick={onRender}>
        Load diff
      </Button>
      <p className="text-sm text-muted-foreground">
        {isLarge
          ? "Large diffs are not rendered by default."
          : "Diff rendering is deferred until this file becomes active or visible."}
      </p>
      {isLarge && changes !== undefined ? (
        <p className="text-xs text-muted-foreground/70">{changes.toLocaleString()} changed lines</p>
      ) : null}
    </div>
  );
};

/* oxlint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks */
const PatchDiff = dynamic(
  () =>
    import("@pierre/diffs/react")
      .then((m) => ({ default: m.PatchDiff }))
      .catch((error) => {
        console.error("[diffhub] Failed to load PatchDiff", error);
        return {
          default: () => (
            <div className="p-4 text-destructive text-sm">
              Failed to load diff viewer: {String(error)}
            </div>
          ),
        };
      }),
  { loading: () => <DiffSkeleton />, ssr: false },
);
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
  lineNumber: number;
  side: AnnotationSide;
}

interface SingleFileDiffProps {
  file: string;
  filePatch: string;
  layout: "split" | "stacked";
  prerenderedHTML?: { dark: string; light: string };
  shouldRenderPatch: boolean;
  comments: Comment[];
  fileStat: DiffFileStat | undefined;
  isLargeFile: boolean;
  collapsed: boolean;
  active?: boolean;
  sectionId: string;
  onToggleCollapse: () => void;
  repoPath: string;
  commentTarget: CommentTarget | null;
  onCommentTargetChange: (target: CommentTarget | null) => void;
  onRenderPatch: () => void;
  onAddComment: (
    file: string,
    lineNumber: number,
    side: AnnotationSide,
    body: string,
    tag: CommentTag,
  ) => Promise<boolean>;
  onDeleteComment: (id: string) => Promise<boolean>;
}

interface GutterButtonProps {
  getHoveredLine: () => { lineNumber: number; side: AnnotationSide } | undefined;
  onCommentTargetChange: (target: CommentTarget | null) => void;
}

const GutterButton = memo(function GutterButton({
  getHoveredLine,
  onCommentTargetChange,
}: GutterButtonProps) {
  const handleClick = useCallback(() => {
    const line = getHoveredLine();
    if (line) {
      onCommentTargetChange({ lineNumber: line.lineNumber, side: line.side });
    }
  }, [getHoveredLine, onCommentTargetChange]);

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

const SingleFileDiff = memo(function SingleFileDiff({
  file,
  filePatch,
  layout,
  prerenderedHTML,
  shouldRenderPatch,
  comments,
  fileStat,
  isLargeFile,
  collapsed,
  active = false,
  sectionId,
  onToggleCollapse,
  repoPath,
  commentTarget,
  onCommentTargetChange,
  onRenderPatch,
  onAddComment,
  onDeleteComment,
}: SingleFileDiffProps) {
  const { resolvedTheme } = useTheme();
  const fileComments = useMemo(() => comments.filter((c) => c.file === file), [comments, file]);
  const headerId = `${sectionId}-header`;
  const panelId = `${sectionId}-panel`;

  const lineAnnotations = useMemo((): DiffLineAnnotation<AnnotationData>[] => {
    const annotations: DiffLineAnnotation<AnnotationData>[] = fileComments.map((c) => ({
      lineNumber: c.lineNumber,
      metadata: { comment: c, type: "comment" as const },
      side: toAnnotationSide(c.side),
    }));

    if (commentTarget) {
      annotations.push({
        lineNumber: commentTarget.lineNumber,
        metadata: { file, type: "input" as const },
        side: commentTarget.side,
      });
    }

    return annotations;
  }, [fileComments, commentTarget, file]);

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
                file,
                annotation.lineNumber,
                annotation.side,
                body,
                tag,
              );
              if (saved) {
                onCommentTargetChange(null);
              }
              return saved;
            }}
            // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onCancel={() => onCommentTargetChange(null)}
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
    [file, onAddComment, onCommentTargetChange, onDeleteComment],
  );

  const renderGutterUtility = useCallback(
    (getHoveredLine: () => { lineNumber: number; side: AnnotationSide } | undefined) => (
      <GutterButton getHoveredLine={getHoveredLine} onCommentTargetChange={onCommentTargetChange} />
    ),
    [onCommentTargetChange],
  );

  const handleRenderPatch = useCallback(() => {
    onRenderPatch();
  }, [onRenderPatch]);

  const hidePanel = collapsed && commentTarget === null;
  let panelContent: React.ReactNode = null;

  if (!hidePanel) {
    if (!filePatch) {
      panelContent = (
        <div className="px-4 py-6 text-sm text-muted-foreground">
          No textual patch available for this file.
        </div>
      );
    } else if (shouldRenderPatch) {
      panelContent = (
        <PatchDiff
          key={`${file}:${layout}:${resolvedTheme}`}
          patch={filePatch}
          prerenderedHTML={prerenderedHTML?.[resolvedTheme === "light" ? "light" : "dark"]}
          disableWorkerPool
          style={{ colorScheme: resolvedTheme === "light" ? "light" : "dark" }}
          options={{
            diffStyle: layout === "split" ? "split" : "unified",
            disableFileHeader: true,
            disableLineNumbers: false,
            enableGutterUtility: true,
            expansionLineCount: 20,
            hunkSeparators: "line-info",
            lineDiffType: "word",
            lineHoverHighlight: "line",
            maxLineDiffLength: 500,
            overflow: "wrap",
            theme: { dark: "github-dark", light: "github-light" },
            themeType: resolvedTheme === "light" ? "light" : "dark",
            unsafeCSS: getDiffUnsafeCSS((resolvedTheme ?? "dark") as DiffTheme),
          }}
          lineAnnotations={lineAnnotations}
          renderAnnotation={renderAnnotation}
          renderGutterUtility={renderGutterUtility}
        />
      );
    } else {
      panelContent = (
        <DeferredDiffPlaceholder
          onRender={handleRenderPatch}
          variant={isLargeFile ? "large" : "auto"}
          changes={fileStat?.changes}
        />
      );
    }
  }

  return (
    <div data-filename={file} className="font-sans">
      <FileDiffHeader
        file={file}
        insertions={fileStat?.insertions ?? 0}
        deletions={fileStat?.deletions ?? 0}
        commentCount={fileComments.length}
        repoPath={repoPath}
        collapsed={collapsed}
        active={active}
        onToggleCollapse={onToggleCollapse}
        headingId={headerId}
        panelId={panelId}
      />
      <div id={panelId} role="region" aria-labelledby={headerId} hidden={hidePanel}>
        {panelContent}
      </div>
    </div>
  );
});

interface DiffViewerProps {
  patchesByFile: Record<string, string>;
  prerenderedHTMLByFile?: Record<string, PrerenderedDiffHtml>;
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
}

interface CollapsibleFileDiffProps {
  file: string;
  filePatch: string;
  layout: "split" | "stacked";
  prerenderedHTML?: PrerenderedDiffHtml;
  deferPatchRendering: boolean;
  isLargeFile: boolean;
  comments: Comment[];
  fileStat: DiffFileStat | undefined;
  collapsed: boolean;
  active: boolean;
  onToggleCollapse: () => void;
  onVisible: (file: string) => void;
  repoPath: string;
  onAddComment: (
    file: string,
    lineNumber: number,
    side: AnnotationSide,
    body: string,
    tag: CommentTag,
  ) => Promise<boolean>;
  onDeleteComment: (id: string) => Promise<boolean>;
}

const CollapsibleFileDiff = memo(function CollapsibleFileDiff({
  file,
  filePatch,
  layout,
  prerenderedHTML,
  deferPatchRendering,
  isLargeFile,
  comments,
  fileStat,
  collapsed,
  active,
  onToggleCollapse,
  onVisible,
  repoPath,
  onAddComment,
  onDeleteComment,
}: CollapsibleFileDiffProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [commentTarget, setCommentTarget] = useState<CommentTarget | null>(null);
  const [shouldRenderPatch, setShouldRenderPatch] = useState(
    () => active || (!deferPatchRendering && !isLargeFile),
  );
  const handleRenderPatch = useCallback(() => {
    setShouldRenderPatch(true);
  }, []);

  useEffect(() => {
    if (active || commentTarget !== null) {
      setShouldRenderPatch(true);
      return;
    }
    if (!(deferPatchRendering || isLargeFile)) {
      setShouldRenderPatch(true);
    }
  }, [active, commentTarget, deferPatchRendering, isLargeFile]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      return;
    }

    const root = document.querySelector<HTMLElement>("#diff-container");
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry) {
          return;
        }
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          if (!isLargeFile) {
            setShouldRenderPatch(true);
          }
          onVisible(file);
        }
      },
      {
        root,
        rootMargin: "-72px 0px -55% 0px",
        threshold: [0.35, 0.6],
      },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [file, isLargeFile, onVisible]);

  const sectionId = getDiffSectionId(file);

  return (
    <section
      ref={sectionRef}
      id={sectionId}
      data-file-section={file}
      className="scroll-mt-16"
      style={{
        containIntrinsicBlockSize: "auto 300px",
        contentVisibility: "auto",
      }}
    >
      <SingleFileDiff
        file={file}
        filePatch={filePatch}
        layout={layout}
        prerenderedHTML={prerenderedHTML?.[layout]}
        shouldRenderPatch={shouldRenderPatch}
        comments={comments}
        fileStat={fileStat}
        isLargeFile={isLargeFile}
        collapsed={collapsed}
        active={active}
        sectionId={sectionId}
        onToggleCollapse={onToggleCollapse}
        repoPath={repoPath}
        commentTarget={commentTarget}
        onCommentTargetChange={setCommentTarget}
        onRenderPatch={handleRenderPatch}
        onAddComment={onAddComment}
        onDeleteComment={onDeleteComment}
      />
    </section>
  );
});

export const DiffViewer = ({
  patchesByFile,
  prerenderedHTMLByFile,
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
}: DiffViewerProps) => {
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
  const deferPatchRendering =
    orderedFiles.length >= LARGE_DIFF_FALLBACK_FILE_THRESHOLD &&
    Object.keys(prerenderedHTMLByFile ?? {}).length === 0;

  const toggleHandlers = useMemo(() => {
    const handlers = new Map<string, () => void>();
    for (const file of orderedFiles) {
      handlers.set(file, () => onToggleCollapse(file));
    }
    return handlers;
  }, [orderedFiles, onToggleCollapse]);

  if (orderedFiles.length === 0) {
    return (
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
            Press <Kbd>r</Kbd> to refresh
          </p>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto" id="diff-container">
      {orderedFiles.map((file) => {
        const fileStat = fileStatMap.get(file);
        const patch = patchesByFile[file] ?? "";
        const isLargeFile = fileStat !== undefined && isLargeDiffFile(fileStat, patch.length);
        return (
          <CollapsibleFileDiff
            key={file}
            file={file}
            filePatch={patch}
            layout={layout}
            prerenderedHTML={prerenderedHTMLByFile?.[file]}
            deferPatchRendering={deferPatchRendering}
            isLargeFile={isLargeFile}
            comments={comments}
            fileStat={fileStat}
            collapsed={collapsedFiles.has(file)}
            active={activeFileId === file}
            // oxlint-disable-next-line typescript-eslint/no-non-null-assertion -- file always exists in toggleHandlers since both use orderedFiles
            onToggleCollapse={toggleHandlers.get(file)!}
            onVisible={onActiveFileChange}
            repoPath={repoPath}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
          />
        );
      })}
    </div>
  );
};
