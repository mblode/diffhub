"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import type { DiffLineAnnotation, AnnotationSide } from "@pierre/diffs";
import type { Comment, CommentTag } from "@/lib/comments";
import type { DiffFileStat } from "@/lib/git";
import type { PrerenderedDiffHtml } from "@/lib/diff-prerender";
import { FileDiffHeader } from "./FileDiffHeader";
import { cn } from "@/lib/utils";
import { BranchIcon, CopySimpleIcon, TrashIcon, CheckIcon } from "blode-icons-react";
import { Button } from "@/components/ui/button";
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

const PatchDiff = dynamic(
  // oxlint-disable-next-line promise/prefer-await-to-then
  () => import("@pierre/diffs/react").then((m) => ({ default: m.PatchDiff })),
  { loading: () => <DiffSkeleton />, ssr: false },
);

interface InlineCommentInputProps {
  onSubmit: (body: string, tag: CommentTag) => void;
  onCancel: () => void;
}

const InlineCommentInput = ({ onSubmit, onCancel }: InlineCommentInputProps) => {
  const [body, setBody] = useState("");

  return (
    <div className="my-1 mx-4 rounded-md border border-border bg-background p-3 shadow-lg dark:shadow-none">
      <textarea
        autoFocus
        value={body}
        // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment for the AI"
        rows={3}
        // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onKeyDown={(e) => {
          if (((e.key === "Enter" && e.metaKey) || e.key === "Return") && body.trim()) {
            onSubmit(body.trim(), "");
          }
          if (e.key === "Escape") {
            onCancel();
          }
        }}
        className="w-full resize-none rounded border-0 bg-transparent px-0 py-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!body.trim()}
          // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
          onClick={() => body.trim() && onSubmit(body.trim(), "")}
        >
          Comment ↵
        </Button>
      </div>
    </div>
  );
};

const CommentDisplay = ({ comment, onDelete }: { comment: Comment; onDelete: () => void }) => {
  const [copied, setCopied] = useState(false);

  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const handleCopy = () => {
    const text = comment.tag ? `${comment.tag} ${comment.body}` : comment.body;
    // oxlint-disable-next-line promise/prefer-await-to-then
    navigator.clipboard.writeText(text).catch(() => {
      // empty
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy comment"}
            className={cn(
              "rounded p-1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
              copied
                ? "text-diff-green"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary",
            )}
          >
            {copied ? <CheckIcon size={12} /> : <CopySimpleIcon size={12} />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete comment"
            aria-label="Delete comment"
            className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
          >
            <TrashIcon size={12} />
          </button>
        </div>
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
    </div>
  );
};

const getPatchFile = (patch: string): string | null => {
  const match = patch.match(/^diff --git a\/(.+?) b\//m);
  return match?.[1] ?? null;
};

interface SingleFileDiffProps {
  file: string;
  filePatch: string;
  layout: "split" | "stacked";
  prerenderedHTML?: { dark: string; light: string };
  comments: Comment[];
  fileStat: DiffFileStat | undefined;
  viewed: boolean;
  onToggleViewed: () => void;
  repoPath: string;
  onAddComment: (
    file: string,
    lineNumber: number,
    side: string,
    body: string,
    tag: CommentTag,
  ) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  onDiscard?: (file: string) => Promise<void>;
}

const SingleFileDiff = ({
  file,
  filePatch,
  layout,
  prerenderedHTML,
  comments,
  fileStat,
  viewed,
  onToggleViewed,
  repoPath,
  onAddComment,
  onDeleteComment,
  onDiscard,
}: SingleFileDiffProps) => {
  const { resolvedTheme } = useTheme();
  const [commentTarget, setCommentTarget] = useState<{
    lineNumber: number;
    side: AnnotationSide;
  } | null>(null);

  const fileComments = useMemo(() => comments.filter((c) => c.file === file), [comments, file]);

  const lineAnnotations = useMemo((): DiffLineAnnotation<AnnotationData>[] => {
    const annotations: DiffLineAnnotation<AnnotationData>[] = fileComments.map((c) => ({
      lineNumber: c.lineNumber,
      metadata: { comment: c, type: "comment" as const },
      side: (c.side ?? "right") as AnnotationSide,
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
              await onAddComment(file, annotation.lineNumber, annotation.side, body, tag);
              setCommentTarget(null);
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
    [file, onAddComment, onDeleteComment],
  );

  const renderGutterUtility = useCallback(
    (getHoveredLine: () => { lineNumber: number; side: AnnotationSide } | undefined) => (
      <button
        type="button"
        className="diffhub-gutter-btn"
        title="Add comment for AI"
        // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onClick={() => {
          const line = getHoveredLine();
          if (line) {
            setCommentTarget({ lineNumber: line.lineNumber, side: line.side });
          }
        }}
      >
        +
      </button>
    ),
    [],
  );

  return (
    <div data-filename={file} className="border-b border-border font-sans">
      <FileDiffHeader
        file={file}
        insertions={fileStat?.insertions ?? 0}
        deletions={fileStat?.deletions ?? 0}
        commentCount={fileComments.length}
        repoPath={repoPath}
        viewed={viewed}
        onToggleViewed={onToggleViewed}
        // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onDiscard={onDiscard ? () => onDiscard(file) : undefined}
      />
      <div className={cn("transition-opacity duration-200", viewed && "opacity-60")}>
        <PatchDiff
          key={`${file}:${layout}:${resolvedTheme}`}
          patch={filePatch}
          prerenderedHTML={prerenderedHTML?.[resolvedTheme === "light" ? "light" : "dark"]}
          disableWorkerPool
          style={
            {
              "--diffs-addition-color-override": "var(--diff-green)",
              colorScheme: resolvedTheme === "light" ? "light" : "dark",
            } as React.CSSProperties
          }
          options={{
            diffStyle: layout === "split" ? "split" : "unified",
            disableFileHeader: true,
            disableLineNumbers: false,
            enableGutterUtility: true,
            expansionLineCount: 20,
            hunkSeparators: "line-info",
            lineDiffType: "char",
            lineHoverHighlight: "line",
            maxLineDiffLength: 500,
            overflow: "scroll",
            theme: { dark: "github-dark", light: "github-light" },
            themeType: resolvedTheme === "light" ? "light" : "dark",
            unsafeCSS: `[data-diff-span] { border-radius: 0; }`,
          }}
          lineAnnotations={lineAnnotations}
          renderAnnotation={renderAnnotation}
          renderGutterUtility={renderGutterUtility}
        />
      </div>
    </div>
  );
};

interface DiffViewerProps {
  patch: string;
  prerenderedHTML?: PrerenderedDiffHtml;
  layout: "split" | "stacked";
  comments: Comment[];
  onAddComment: (
    file: string,
    lineNumber: number,
    side: string,
    body: string,
    tag: CommentTag,
  ) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  selectedFileId: string | null;
  fileStats: DiffFileStat[];
  viewedFiles: Set<string>;
  onToggleViewed: (file: string) => void;
  repoPath: string;
  onDiscard?: (file: string) => Promise<void>;
}

export const DiffViewer = ({
  patch,
  prerenderedHTML,
  layout,
  comments,
  onAddComment,
  onDeleteComment,
  selectedFileId,
  fileStats,
  viewedFiles,
  onToggleViewed,
  repoPath,
  onDiscard,
}: DiffViewerProps) => {
  const fileStatMap = useMemo(() => {
    const map = new Map<string, DiffFileStat>();
    for (const s of fileStats) {
      map.set(s.file, s);
    }
    return map;
  }, [fileStats]);

  const file = useMemo(() => selectedFileId ?? getPatchFile(patch), [patch, selectedFileId]);

  if (!patch || !file) {
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
    <div className="h-full overflow-auto" id="diff-container">
      <SingleFileDiff
        file={file}
        filePatch={patch}
        layout={layout}
        prerenderedHTML={prerenderedHTML?.[layout]}
        comments={comments}
        fileStat={fileStatMap.get(file)}
        viewed={viewedFiles.has(file)}
        // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onToggleViewed={() => onToggleViewed(file)}
        repoPath={repoPath}
        onAddComment={onAddComment}
        onDeleteComment={onDeleteComment}
        onDiscard={onDiscard}
      />
    </div>
  );
};
