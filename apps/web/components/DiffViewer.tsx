"use client";

import { PatchDiff } from "@pierre/diffs/react";
import { useCallback, useMemo, useState } from "react";
import type {
  DiffLineAnnotation,
  AnnotationSide,
} from "@pierre/diffs";
import type { Comment, CommentTag } from "@/lib/comments";

const TAGS: CommentTag[] = [
  "[must-fix]",
  "[suggestion]",
  "[nit]",
  "[question]",
];
const TAG_COLORS: Record<string, string> = {
  "[must-fix]": "text-[#f85149]",
  "[suggestion]": "text-[#3fb950]",
  "[nit]": "text-[#8b949e]",
  "[question]": "text-[#d2a8ff]",
};

type AnnotationData =
  | { type: "comment"; comment: Comment }
  | { type: "input"; file: string };

interface InlineCommentInputProps {
  lineNumber: number;
  side: AnnotationSide;
  file: string;
  onSubmit: (body: string, tag: CommentTag) => void;
  onCancel: () => void;
}

function InlineCommentInput({
  file,
  onSubmit,
  onCancel,
}: InlineCommentInputProps) {
  const [body, setBody] = useState("");
  const [tag, setTag] = useState<CommentTag>("[suggestion]");

  return (
    <div className="my-1 mx-4 rounded-md border border-[#388bfd]/40 bg-[#0d1117] p-3 shadow-lg">
      <div className="text-[11px] text-[#8b949e] font-mono mb-2">
        {file.split("/").pop()}
      </div>
      <div className="flex gap-1.5 mb-2 flex-wrap">
        {TAGS.map((t) => (
          <button
            key={t}
            onClick={() => setTag(t)}
            className={`rounded px-1.5 py-0.5 text-[11px] font-mono border transition-colors ${
              tag === t
                ? "border-current " + TAG_COLORS[t]
                : "border-transparent text-[#8b949e] hover:text-[#e6edf3]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment for the AI"
        rows={3}
        onKeyDown={(e) => {
          if ((e.key === "Enter" && e.metaKey) || e.key === "Return") {
            if (body.trim()) onSubmit(body.trim(), tag);
          }
          if (e.key === "Escape") onCancel();
        }}
        className="w-full resize-none rounded bg-[#161b22] border border-white/10 px-3 py-2 text-sm text-[#e6edf3] placeholder-[#8b949e] focus:outline-none focus:border-[#388bfd]/50"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded px-3 py-1.5 text-sm text-[#8b949e] hover:text-[#e6edf3] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => body.trim() && onSubmit(body.trim(), tag)}
          disabled={!body.trim()}
          className="rounded bg-[#238636] px-3 py-1.5 text-sm text-white hover:bg-[#2ea043] transition-colors disabled:opacity-40"
        >
          Comment ↵
        </button>
      </div>
    </div>
  );
}

function CommentDisplay({
  comment,
  onDelete,
}: {
  comment: Comment;
  onDelete: () => void;
}) {
  return (
    <div className="my-1 mx-4 flex items-start gap-2 rounded border border-white/10 bg-[#161b22] p-2.5 text-xs">
      {comment.tag && (
        <span
          className={`shrink-0 mt-0.5 font-mono ${TAG_COLORS[comment.tag] ?? "text-[#8b949e]"}`}
        >
          {comment.tag}
        </span>
      )}
      <p className="flex-1 text-[#e6edf3] leading-relaxed">{comment.body}</p>
      <button
        onClick={onDelete}
        className="shrink-0 text-[#8b949e] hover:text-[#f85149] transition-colors"
      >
        ×
      </button>
    </div>
  );
}

// PatchDiff only handles single-file patches. Split the full multi-file patch
// on "diff --git" boundaries and render one PatchDiff per file.
function splitPatch(patch: string): Array<{ file: string; patch: string }> {
  return patch
    .split(/(?=^diff --git )/gm)
    .filter((s) => s.trimStart().startsWith("diff --git "))
    .map((filePatch) => {
      const match = filePatch.match(/^diff --git a\/(.+?) b\//m);
      return { file: match?.[1] ?? "", patch: filePatch };
    });
}

interface SingleFileDiffProps {
  file: string;
  filePatch: string;
  layout: "split" | "stacked";
  comments: Comment[];
  onAddComment: (
    file: string,
    lineNumber: number,
    side: string,
    body: string,
    tag: CommentTag
  ) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
}

function SingleFileDiff({
  file,
  filePatch,
  layout,
  comments,
  onAddComment,
  onDeleteComment,
}: SingleFileDiffProps) {
  const [commentTarget, setCommentTarget] = useState<{
    lineNumber: number;
    side: AnnotationSide;
  } | null>(null);

  const lineAnnotations = useMemo((): DiffLineAnnotation<AnnotationData>[] => {
    const annotations: DiffLineAnnotation<AnnotationData>[] = comments
      .filter((c) => c.file === file)
      .map((c) => ({
        side: (c.side ?? "right") as AnnotationSide,
        lineNumber: c.lineNumber,
        metadata: { type: "comment" as const, comment: c },
      }));

    if (commentTarget) {
      annotations.push({
        side: commentTarget.side,
        lineNumber: commentTarget.lineNumber,
        metadata: { type: "input" as const, file },
      });
    }

    return annotations;
  }, [comments, commentTarget, file]);

  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<AnnotationData>) => {
      const d = annotation.metadata;
      if (!d) return null;

      if (d.type === "input") {
        return (
          <InlineCommentInput
            lineNumber={annotation.lineNumber}
            side={annotation.side}
            file={file}
            onSubmit={async (body, tag) => {
              await onAddComment(file, annotation.lineNumber, annotation.side, body, tag);
              setCommentTarget(null);
            }}
            onCancel={() => setCommentTarget(null)}
          />
        );
      }

      if (d.type === "comment") {
        return (
          <CommentDisplay
            comment={d.comment}
            onDelete={() => onDeleteComment(d.comment.id)}
          />
        );
      }

      return null;
    },
    [file, onAddComment, onDeleteComment]
  );

  const renderGutterUtility = useCallback(
    (getHoveredLine: () => { lineNumber: number; side: AnnotationSide } | undefined) => (
      <button
        className="cmux-gutter-btn"
        title="Add comment for AI"
        onClick={() => {
          const line = getHoveredLine();
          if (line) setCommentTarget({ lineNumber: line.lineNumber, side: line.side });
        }}
      >
        +
      </button>
    ),
    []
  );

  return (
    <div data-filename={file}>
      <PatchDiff
        patch={filePatch}
        options={{
          diffStyle: layout === "split" ? "split" : "unified",
          disableLineNumbers: false,
          theme: "github-dark",
          lineDiffType: "word",
        }}
        lineAnnotations={lineAnnotations}
        renderAnnotation={renderAnnotation}
        renderGutterUtility={renderGutterUtility}
      />
    </div>
  );
}

interface DiffViewerProps {
  patch: string;
  layout: "split" | "stacked";
  comments: Comment[];
  onAddComment: (
    file: string,
    lineNumber: number,
    side: string,
    body: string,
    tag: CommentTag
  ) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  selectedFileId: string | null;
}

export function DiffViewer({
  patch,
  layout,
  comments,
  onAddComment,
  onDeleteComment,
  selectedFileId,
}: DiffViewerProps) {
  const filePatches = useMemo(() => splitPatch(patch), [patch]);

  if (!patch || filePatches.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-[#8b949e] text-sm">
        No changes relative to main branch
      </div>
    );
  }

  const visible = useMemo(() => {
    if (!selectedFileId) return filePatches.slice(0, 1);
    const match = filePatches.filter((f) => f.file === selectedFileId);
    return match.length > 0 ? match : filePatches.slice(0, 1);
  }, [filePatches, selectedFileId]);

  return (
    <div className="flex-1 overflow-auto" id="diff-container">
      <style>{`
        .cmux-gutter-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 4px;
          border: 1px solid rgba(56, 139, 253, 0.5);
          background: rgba(56, 139, 253, 0.1);
          color: #388bfd;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .cmux-gutter-btn:hover {
          opacity: 1;
          background: rgba(56, 139, 253, 0.2);
        }
        [data-line-row]:hover .cmux-gutter-btn {
          opacity: 1;
        }
      `}</style>

      {visible.map(({ file, patch: filePatch }) => (
        <SingleFileDiff
          key={file}
          file={file}
          filePatch={filePatch}
          layout={layout}
          comments={comments}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
        />
      ))}
    </div>
  );
}
