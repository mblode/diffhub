"use client";

import dynamic from "next/dynamic";
import { Component, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ErrorInfo, ReactNode } from "react";
import type { DiffLineAnnotation, AnnotationSide } from "@pierre/diffs";
import type { Comment, CommentTag } from "@/lib/comment-types";
import type { DiffFileStat } from "@/lib/diff-file-stat";
import { isLargeDiffFile } from "@/lib/diff-file-stat";
import type { PrerenderedDiffHtml } from "@/lib/diff-prerender";
import type { DiffTheme } from "@/lib/diff-colors";
import { getDiffUnsafeCSS } from "@/lib/diff-colors";
import { FileDiffHeader } from "./FileDiffHeader";
import { useTheme } from "./theme-provider";
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
const EMPTY_COMMENTS: readonly Comment[] = [];
const RESERVED_HEIGHT_PER_CHANGE_PX = 22;
const MIN_RESERVED_HEIGHT_PX = 128;
const MAX_RESERVED_HEIGHT_PX = 960;

const getReservedHeightPx = (fileStat: DiffFileStat | undefined): number => {
  const changes = fileStat?.changes ?? 1;
  const estimated = changes * RESERVED_HEIGHT_PER_CHANGE_PX;
  return Math.min(MAX_RESERVED_HEIGHT_PX, Math.max(MIN_RESERVED_HEIGHT_PX, estimated));
};

// Collapse multiple IntersectionObserver callbacks across sections into one
// `onVisible(file)` call per frame. Prevents `setSelectedFile` from re-entering
// React while the browser is mid-scroll.
let pendingVisibleFile: string | null = null;
let pendingVisibleHandler: ((file: string) => void) | null = null;
let pendingVisibleRafId = 0;
const scheduleVisibleFlush = (file: string, handler: (file: string) => void): void => {
  pendingVisibleFile = file;
  pendingVisibleHandler = handler;
  if (pendingVisibleRafId !== 0) {
    return;
  }
  pendingVisibleRafId = requestAnimationFrame(() => {
    pendingVisibleRafId = 0;
    const f = pendingVisibleFile;
    const h = pendingVisibleHandler;
    pendingVisibleFile = null;
    pendingVisibleHandler = null;
    if (f && h) {
      h(f);
    }
  });
};

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

interface AnnotationData {
  type: "input";
  file: string;
}

export const getDiffSectionId = (file: string): string => `diff-${encodeURIComponent(file)}`;
export const getCommentElementId = (id: string): string => `diff-comment-${encodeURIComponent(id)}`;

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
  message?: string;
  variant: "auto" | "large";
  changes?: number;
}

const DeferredDiffPlaceholder = ({
  onRender,
  message,
  variant,
  changes,
}: DeferredDiffPlaceholderProps) => {
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
        {message ??
          (isLarge
            ? "Large diffs are not rendered by default."
            : "Diff rendering is deferred. Load this file to render its diff.")}
      </p>
      {isLarge && changes !== undefined ? (
        <p className="text-xs text-muted-foreground/70">{changes.toLocaleString()} changed lines</p>
      ) : null}
    </div>
  );
};

interface DiffErrorBoundaryProps {
  file: string;
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
    console.error("[diffhub] PatchDiff threw", {
      componentStack: info.componentStack,
      error: error.message,
      file: this.props.file,
    });
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="px-4 py-6 text-sm text-destructive">
          Failed to render diff for this file: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

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

// oxlint-disable-next-line complexity
const CommentDisplay = ({
  comment,
  active,
  onDelete,
  onResolve,
  onReply,
}: {
  comment: Comment;
  active: boolean;
  onDelete: () => Promise<boolean>;
  onResolve: (resolved: boolean) => Promise<boolean>;
  onReply: (body: string) => Promise<boolean>;
}) => {
  const [copied, setCopied] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!comment.resolved);
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
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

  const handleResolve = useCallback(
    async (resolved: boolean): Promise<void> => {
      if (isUpdating) {
        return;
      }

      setIsUpdating(true);
      const updated = await onResolve(resolved).catch(() => false);
      if (updated) {
        setIsExpanded(!resolved);
        if (resolved) {
          setReplyBody("");
          setIsReplying(false);
          setReplyError(null);
        }
      } else {
        setDeleteError("Failed to update comment.");
      }
      setIsUpdating(false);
    },
    [isUpdating, onResolve],
  );

  const handleExpandToggle = useCallback(() => {
    setIsExpanded((value) => !value);
  }, []);

  const handleResolveClick = useCallback(() => {
    void handleResolve(true);
  }, [handleResolve]);

  const handleUnresolveClick = useCallback(() => {
    void handleResolve(false);
  }, [handleResolve]);

  const handleReplyChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReplyBody(event.target.value);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyBody("");
    setReplyError(null);
    setIsReplying(false);
  }, []);

  const handleReplyKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancelReply();
    }
  }, [handleCancelReply]);

  const handleReply = useCallback(async (): Promise<void> => {
    const trimmed = replyBody.trim();
    if (!trimmed || isUpdating) {
      return;
    }

    setReplyError(null);
    setIsUpdating(true);
    const saved = await onReply(trimmed).catch(() => false);
    if (saved) {
      setReplyBody("");
      setIsReplying(false);
      setIsExpanded(true);
    } else {
      setReplyError("Failed to save reply.");
    }
    setIsUpdating(false);
  }, [isUpdating, onReply, replyBody]);

  const handleReplyClick = useCallback(() => {
    void handleReply();
  }, [handleReply]);

  const handleStartReply = useCallback(() => {
    setIsExpanded(true);
    setIsReplying(true);
    setReplyError(null);
  }, []);

  const borderAccent = comment.tag
    ? (TAG_META[comment.tag]?.border ?? "border-l-ring/40")
    : "border-l-ring/40";
  const firstLine = comment.body.split(/\s+/).join(" ").slice(0, 60);
  const canResolve = comment.staleness !== "stale";

  return (
    <div
      id={getCommentElementId(comment.id)}
      data-comment-id={comment.id}
      data-testid="diffhub-comment-card"
      data-comment-resolved={comment.resolved ? "true" : "false"}
      data-comment-expanded={isExpanded ? "true" : "false"}
      className={cn(
        "group scroll-mt-24 overflow-hidden rounded-md border border-border bg-card shadow-sm dark:shadow-none border-l-2",
        borderAccent,
        active && "ring-1 ring-diff-purple/70",
      )}
    >
      {comment.staleness === "stale" && (
        <div className="border-b border-border/40 bg-muted/40 px-2.5 py-0.5 text-[10px] leading-4 text-muted-foreground">
          Stale — content changed
        </div>
      )}
      {comment.staleness === "moved" && comment.rebasedFromLine !== undefined && (
        <div className="border-b border-border/40 bg-diff-purple/10 px-2.5 py-0.5 text-[10px] leading-4 text-diff-purple">
          ↳ moved from line {comment.rebasedFromLine}
        </div>
      )}
      {comment.resolved && (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] leading-4 text-muted-foreground hover:bg-muted/40"
          onClick={handleExpandToggle}
        >
          <span className="min-w-0 flex-1 truncate">
            ✓ Resolved by {comment.resolvedBy ?? "unknown"}{" "}
            {comment.resolvedAt ? `at ${formatRelativeTime(comment.resolvedAt)}` : ""} — &quot;
            {firstLine}&quot;
          </span>
          <span className="inline-flex min-w-9 shrink-0 justify-end whitespace-nowrap break-normal leading-none">
            {isExpanded ? "Hide" : "Show"}
          </span>
        </button>
      )}
      {/* Body row */}
      {isExpanded && (
        <div className="flex items-start gap-2 px-2.5 py-2">
          {comment.tag && (
            <span
              className={cn(
                "shrink-0 mt-px text-[10px] leading-4",
                TAG_META[comment.tag]?.text ?? "text-muted-foreground",
              )}
            >
              {comment.tag}
            </span>
          )}
          <p className="flex-1 text-xs leading-5 text-foreground">{comment.body}</p>
          <TooltipProvider delay={400}>
            <div className="flex shrink-0 items-center gap-0.5 opacity-75 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              {canResolve && !comment.resolved && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isUpdating}
                  className="h-6 px-1.5 text-[11px] text-muted-foreground"
                  onClick={handleResolveClick}
                >
                  Resolve
                </Button>
              )}
              {comment.resolved && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isUpdating}
                  className="h-6 px-1.5 text-[11px] text-muted-foreground"
                  onClick={handleUnresolveClick}
                >
                  Unresolve
                </Button>
              )}
              {!isReplying && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] text-muted-foreground"
                  onClick={handleStartReply}
                >
                  Reply
                </Button>
              )}
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
      )}
      {isExpanded && comment.replies.length > 0 && (
        <div className="border-t border-border/40 px-2.5 py-1.5">
          <div className="space-y-1.5 border-l border-border pl-2.5">
            {comment.replies.map((reply) => (
              <div key={`${reply.at}:${reply.body}`} className="text-xs">
                <div className="text-muted-foreground">
                  {reply.by ?? "unknown"} · {formatRelativeTime(reply.at)}
                </div>
                <p className="mt-0.5 text-foreground">{reply.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {isExpanded && isReplying && (
        <div className="border-t border-border/40 px-2.5 py-1.5">
          <textarea
            autoFocus
            value={replyBody}
            onChange={handleReplyChange}
            onKeyDown={handleReplyKeyDown}
            placeholder="Reply"
            rows={2}
            className="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            {replyError ? <p className="text-xs text-destructive">{replyError}</p> : <span />}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[11px] text-muted-foreground"
                onClick={handleCancelReply}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!replyBody.trim() || isUpdating}
                onClick={handleReplyClick}
              >
                Reply
              </Button>
            </div>
          </div>
        </div>
      )}
      {isExpanded && (
        <div className="flex items-center gap-1.5 border-t border-border/40 px-2.5 py-0.5 text-[10px] leading-4 text-muted-foreground/60">
          <span>L{comment.lineNumber}</span>
          {comment.createdAt && (
            <>
              <span>·</span>
              <span>{formatRelativeTime(comment.createdAt)}</span>
            </>
          )}
        </div>
      )}
      {deleteError && <p className="px-3 pb-2 text-xs text-destructive">{deleteError}</p>}
    </div>
  );
};

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
  prerenderedHTML?: { dark?: string; light?: string };
  requirePrerenderedHTML: boolean;
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
  onResolveComment: (id: string, resolved: boolean) => Promise<boolean>;
  onReplyToComment: (id: string, body: string) => Promise<boolean>;
  activeCommentId: string | null;
  onNavigateComment: (id: string) => void;
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
  requirePrerenderedHTML,
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
  onResolveComment,
  onReplyToComment,
  activeCommentId,
  onNavigateComment,
}: SingleFileDiffProps) {
  const { resolvedTheme } = useTheme();
  // `comments` is already scoped to this file by DiffViewer's commentsByFile split.
  const fileComments = comments;
  const headerId = `${sectionId}-header`;
  const panelId = `${sectionId}-panel`;
  const [clientRenderLayout, setClientRenderLayout] = useState<"split" | "stacked" | null>(null);
  const [showPrerenderFallback, setShowPrerenderFallback] = useState(false);

  useEffect(() => {
    setShowPrerenderFallback(false);
    const timeoutId = setTimeout(() => setShowPrerenderFallback(true), 3000);
    return () => clearTimeout(timeoutId);
  }, [layout, requirePrerenderedHTML]);

  const lineAnnotations = useMemo((): DiffLineAnnotation<AnnotationData>[] => {
    const annotations: DiffLineAnnotation<AnnotationData>[] = [];

    if (commentTarget) {
      annotations.push({
        lineNumber: commentTarget.lineNumber,
        metadata: { file, type: "input" as const },
        side: commentTarget.side,
      });
    }

    return annotations;
  }, [commentTarget, file]);

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

      return null;
    },
    [file, onAddComment, onCommentTargetChange],
  );

  const renderFileComments = (): React.JSX.Element | null => {
    if (fileComments.length === 0) {
      return null;
    }

    return (
      <div
        className="border-t border-border/60 bg-muted/15 px-2 py-1.5"
        data-testid="diffhub-file-comments"
      >
        <div className="pb-1 text-[10px] font-medium leading-4 text-muted-foreground">
          Comments
        </div>
        <div className="flex flex-col gap-1">
          {fileComments.map((comment) => (
            <CommentDisplay
              key={comment.id}
              comment={comment}
              active={comment.id === activeCommentId}
              // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onDelete={() => onDeleteComment(comment.id)}
              // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onResolve={(resolved) => onResolveComment(comment.id, resolved)}
              // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onReply={(body) => onReplyToComment(comment.id, body)}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderGutterUtility = useCallback(
    (getHoveredLine: () => { lineNumber: number; side: AnnotationSide } | undefined) => (
      <GutterButton getHoveredLine={getHoveredLine} onCommentTargetChange={onCommentTargetChange} />
    ),
    [onCommentTargetChange],
  );
  const themeType = resolvedTheme === "light" ? "light" : "dark";
  const activePrerenderedHTML = prerenderedHTML?.[themeType];
  const canClientRenderPatch = !requirePrerenderedHTML || clientRenderLayout === layout;

  const handleRenderPatch = useCallback(() => {
    onRenderPatch();
  }, [onRenderPatch]);

  const handleClientRenderPatch = useCallback(() => {
    setClientRenderLayout(layout);
    onRenderPatch();
  }, [layout, onRenderPatch]);

  const handleJumpToFirstComment = useCallback(() => {
    const [firstComment] = fileComments;
    if (firstComment) {
      onNavigateComment(firstComment.id);
    }
  }, [fileComments, onNavigateComment]);

  const hidePanel = collapsed && commentTarget === null;
  let panelContent: React.ReactNode = null;

  if (!hidePanel) {
    if (!filePatch) {
      panelContent = (
        <>
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No textual patch available for this file.
          </div>
          {renderFileComments()}
        </>
      );
    } else if (shouldRenderPatch && (canClientRenderPatch || activePrerenderedHTML)) {
      panelContent = (
        <DiffErrorBoundary file={file}>
          <>
            <PatchDiff
              key={file}
              patch={filePatch}
              prerenderedHTML={activePrerenderedHTML}
              disableWorkerPool
              style={{ colorScheme: themeType }}
              options={{
                diffStyle: layout === "split" ? "split" : "unified",
                disableFileHeader: true,
                disableLineNumbers: false,
                enableGutterUtility: true,
                expansionLineCount: 20,
                hunkSeparators: "line-info",
                lineDiffType: "word-alt",
                lineHoverHighlight: "disabled",
                maxLineDiffLength: 500,
                overflow: "wrap",
                theme: { dark: "github-dark", light: "github-light" },
                themeType,
                unsafeCSS: getDiffUnsafeCSS((resolvedTheme ?? "dark") as DiffTheme),
              }}
              lineAnnotations={lineAnnotations}
              renderAnnotation={renderAnnotation}
              renderGutterUtility={renderGutterUtility}
            />
            {renderFileComments()}
          </>
        </DiffErrorBoundary>
      );
    } else {
      panelContent = (
        <>
          {shouldRenderPatch && requirePrerenderedHTML ? (
            showPrerenderFallback ? (
              <DeferredDiffPlaceholder
                onRender={handleClientRenderPatch}
                message="Still waiting for the server-rendered diff. Load this file locally if you need it now."
                variant={isLargeFile ? "large" : "auto"}
                changes={fileStat?.changes}
              />
            ) : (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                Loading server-rendered diff…
              </div>
            )
          ) : (
            <DeferredDiffPlaceholder
              onRender={handleRenderPatch}
              variant={isLargeFile ? "large" : "auto"}
              changes={fileStat?.changes}
            />
          )}
          {renderFileComments()}
        </>
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
        onJumpToFirstComment={handleJumpToFirstComment}
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
  onResolveComment: (id: string, resolved: boolean) => Promise<boolean>;
  onReplyToComment: (id: string, body: string) => Promise<boolean>;
  activeFileId: string | null;
  activeCommentId: string | null;
  onNavigateComment: (id: string) => void;
  fileStats: DiffFileStat[];
  collapsedFiles: Set<string>;
  onToggleCollapse: (file: string) => void;
  onActiveFileChange: (file: string) => void;
  forceRenderFiles?: ReadonlySet<string>;
  repoPath: string;
}

interface CollapsibleFileDiffProps {
  file: string;
  filePatch: string;
  layout: "split" | "stacked";
  prerenderedHTML?: PrerenderedDiffHtml;
  requirePrerenderedHTML: boolean;
  deferPatchRendering: boolean;
  isLargeFile: boolean;
  forceRender: boolean;
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
  onResolveComment: (id: string, resolved: boolean) => Promise<boolean>;
  onReplyToComment: (id: string, body: string) => Promise<boolean>;
  activeCommentId: string | null;
  onNavigateComment: (id: string) => void;
}

const CollapsibleFileDiff = memo(function CollapsibleFileDiff({
  file,
  filePatch,
  layout,
  prerenderedHTML,
  requirePrerenderedHTML,
  deferPatchRendering,
  isLargeFile,
  forceRender,
  comments,
  fileStat,
  collapsed,
  active,
  onToggleCollapse,
  onVisible,
  repoPath,
  onAddComment,
  onDeleteComment,
  onResolveComment,
  onReplyToComment,
  activeCommentId,
  onNavigateComment,
}: CollapsibleFileDiffProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [commentTarget, setCommentTarget] = useState<CommentTarget | null>(null);
  const isDeferred = deferPatchRendering || isLargeFile;
  // Latch once true: passive visibility may change `active` while the user is
  // scrolling, but it must not inflate placeholder sections into full diffs.
  const [hasRenderedPatch, setHasRenderedPatch] = useState(() => !isDeferred || forceRender);
  if (!hasRenderedPatch && (forceRender || commentTarget !== null)) {
    setHasRenderedPatch(true);
  }
  const handleRenderPatch = useCallback(() => {
    setHasRenderedPatch(true);
  }, []);

  const shouldRenderPatch =
    hasRenderedPatch || forceRender || commentTarget !== null || !isDeferred;

  const onVisibleRef = useRef(onVisible);
  useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry) {
          return;
        }
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          scheduleVisibleFlush(file, onVisibleRef.current);
        }
      },
      {
        // Observe against viewport — we use window scroll, not a container.
        // Top inset accounts for sticky StatusBar (52px).
        rootMargin: "-52px 0px -55% 0px",
        threshold: [0.35, 0.6],
      },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [file]);

  const sectionId = getDiffSectionId(file);
  const sectionStyle = useMemo<CSSProperties>(() => {
    if (collapsed || shouldRenderPatch) {
      return {};
    }

    return {
      minHeight: getReservedHeightPx(fileStat),
    };
  }, [collapsed, fileStat, shouldRenderPatch]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !shouldRenderPatch) {
      return;
    }

    section.style.minHeight = "";
  }, [collapsed, commentTarget, comments, layout, shouldRenderPatch]);

  return (
    <section
      ref={sectionRef}
      id={sectionId}
      data-file-section={file}
      className="scroll-mt-[52px]"
      style={sectionStyle}
    >
      <SingleFileDiff
        file={file}
        filePatch={filePatch}
        layout={layout}
        prerenderedHTML={prerenderedHTML?.[layout]}
        requirePrerenderedHTML={requirePrerenderedHTML}
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
        onResolveComment={onResolveComment}
        onReplyToComment={onReplyToComment}
        activeCommentId={activeCommentId}
        onNavigateComment={onNavigateComment}
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
  onResolveComment,
  onReplyToComment,
  activeFileId,
  activeCommentId,
  onNavigateComment,
  fileStats,
  collapsedFiles,
  onToggleCollapse,
  onActiveFileChange,
  forceRenderFiles,
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
  const deferPatchRendering =
    orderedFiles.length >= LARGE_DIFF_FALLBACK_FILE_THRESHOLD &&
    Object.keys(prerenderedHTMLByFile ?? {}).length === 0;
  const requirePrerenderedHTML = prerenderedHTMLByFile !== undefined;

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
            Press <Kbd>r</Kbd> to force refresh
          </p>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div id="diff-container">
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
            requirePrerenderedHTML={requirePrerenderedHTML}
            deferPatchRendering={deferPatchRendering}
            isLargeFile={isLargeFile}
            forceRender={forceRenderFiles?.has(file) ?? false}
            comments={commentsByFile.get(file) ?? (EMPTY_COMMENTS as Comment[])}
            fileStat={fileStat}
            collapsed={collapsedFiles.has(file)}
            active={activeFileId === file}
            activeCommentId={activeCommentId}
            onNavigateComment={onNavigateComment}
            // oxlint-disable-next-line typescript-eslint/no-non-null-assertion -- file always exists in toggleHandlers since both use orderedFiles
            onToggleCollapse={toggleHandlers.get(file)!}
            onVisible={onActiveFileChange}
            repoPath={repoPath}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
            onResolveComment={onResolveComment}
            onReplyToComment={onReplyToComment}
          />
        );
      })}
    </div>
  );
};
