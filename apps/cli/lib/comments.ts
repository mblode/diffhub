import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CommentSide } from "./comment-sides";
import { isCommentSide } from "./comment-sides";
import type {
  Comment,
  CommentAnchor,
  CommentReply,
  CommentStaleness,
  CommentTag,
} from "./comment-types";
import { getBaseBranch, getFileAtRef, getMergeBase } from "./git";
import { getGitDirectory, resolveRepoFilePath } from "./git-paths";
import { getConfiguredRepoPath } from "./repo-path";

export type { Comment, CommentTag } from "./comment-types";

const COMMENTS_FILENAME = "diffhub-comments.json";
const CONTEXT_LINES = 3;
const CONTEXT_MAX_CHARS = 120;
const NEARBY_LINE_WINDOW = 10;

let mutationQueue = Promise.resolve(null);

interface FileSnapshot {
  exists: boolean;
  fileSha: string;
  lines: string[];
  mtimeMs: number;
}

interface CommentRuntimeState {
  fileSnapshots: Map<string, FileSnapshot>;
}

const getRuntimeState = (): CommentRuntimeState => {
  const globalScope = globalThis as typeof globalThis & {
    __diffhubCommentRuntimeState?: CommentRuntimeState;
  };

  if (!globalScope.__diffhubCommentRuntimeState) {
    globalScope.__diffhubCommentRuntimeState = { fileSnapshots: new Map() };
  }

  return globalScope.__diffhubCommentRuntimeState;
};

const commentRuntimeState = getRuntimeState();

const getRepoPath = (): string => getConfiguredRepoPath();
const getCommentsPath = (): string => join(getGitDirectory(getRepoPath()), COMMENTS_FILENAME);

export const clearCommentCache = (): void => {
  commentRuntimeState.fileSnapshots.clear();
};

const isCommentTag = (value: unknown): value is CommentTag =>
  value === "" ||
  value === "[must-fix]" ||
  value === "[suggestion]" ||
  value === "[nit]" ||
  value === "[question]";

const truncateContext = (line: string): string => line.slice(0, CONTEXT_MAX_CHARS);

const isCommentStaleness = (value: unknown): value is CommentStaleness =>
  value === "fresh" || value === "moved" || value === "stale";

const isAnchor = (value: unknown): value is CommentAnchor => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const anchor = value as Record<string, unknown>;
  return (
    typeof anchor.fileSha === "string" &&
    typeof anchor.lineContent === "string" &&
    Array.isArray(anchor.beforeContext) &&
    anchor.beforeContext.every((line) => typeof line === "string") &&
    Array.isArray(anchor.afterContext) &&
    anchor.afterContext.every((line) => typeof line === "string") &&
    (anchor.createdFromMissingFile === undefined ||
      typeof anchor.createdFromMissingFile === "boolean") &&
    (anchor.diffHunkHeader === undefined || typeof anchor.diffHunkHeader === "string")
  );
};

const isReply = (value: unknown): value is CommentReply => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const reply = value as Record<string, unknown>;
  return (
    typeof reply.body === "string" &&
    typeof reply.at === "string" &&
    (reply.by === undefined || typeof reply.by === "string")
  );
};

const isCommentLike = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const comment = value as Record<string, unknown>;
  return (
    typeof comment.body === "string" &&
    typeof comment.createdAt === "string" &&
    typeof comment.file === "string" &&
    typeof comment.id === "string" &&
    typeof comment.lineNumber === "number" &&
    isCommentSide(comment.side) &&
    isCommentTag(comment.tag)
  );
};

const readFileSnapshot = (file: string): FileSnapshot => {
  const repoPath = getRepoPath();
  let absolutePath: string;

  try {
    absolutePath = resolveRepoFilePath(repoPath, file);
  } catch {
    return { exists: false, fileSha: "", lines: [], mtimeMs: -1 };
  }

  let mtimeMs = -1;
  try {
    ({ mtimeMs } = statSync(absolutePath));
  } catch {
    return { exists: false, fileSha: "", lines: [], mtimeMs };
  }

  const cacheKey = `${repoPath}:${file}`;
  const cached = commentRuntimeState.fileSnapshots.get(cacheKey);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached;
  }

  const content = readFileSync(absolutePath, "utf-8");
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === "") {
    lines.pop();
  }

  let fileSha = "";
  try {
    fileSha = execFileSync("git", ["hash-object", absolutePath], {
      cwd: repoPath,
      encoding: "utf-8",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    fileSha = "";
  }

  const snapshot = { exists: true, fileSha, lines, mtimeMs };
  commentRuntimeState.fileSnapshots.set(cacheKey, snapshot);
  return snapshot;
};

const buildAnchorFromLines = (
  lines: string[],
  exists: boolean,
  fileSha: string,
  lineNumber: number,
  diffHunkHeader?: string,
): CommentAnchor => {
  const lineIndex = lineNumber - 1;
  const lineContent = lines[lineIndex] ?? "";
  const beforeStart = Math.max(0, lineIndex - CONTEXT_LINES);
  const afterEnd = Math.min(lines.length, lineIndex + CONTEXT_LINES + 1);

  const anchor: CommentAnchor = {
    afterContext: lines.slice(lineIndex + 1, afterEnd).map(truncateContext),
    beforeContext: lines.slice(beforeStart, lineIndex).map(truncateContext),
    createdFromMissingFile: !exists,
    fileSha,
    lineContent,
  };

  if (diffHunkHeader !== undefined) {
    anchor.diffHunkHeader = diffHunkHeader;
  }

  return anchor;
};

const buildAnchor = (file: string, lineNumber: number, diffHunkHeader?: string): CommentAnchor => {
  const snapshot = readFileSnapshot(file);
  return buildAnchorFromLines(
    snapshot.lines,
    snapshot.exists,
    snapshot.fileSha,
    lineNumber,
    diffHunkHeader,
  );
};

const buildAnchorAsync = async (
  file: string,
  lineNumber: number,
  side: CommentSide,
  diffHunkHeader?: string,
): Promise<CommentAnchor> => {
  if (side === "left") {
    try {
      const baseBranch = await getBaseBranch();
      const mergeBase = await getMergeBase(baseBranch);
      const content = await getFileAtRef(file, mergeBase);
      const lines = content.split(/\r?\n/);
      if (lines.at(-1) === "") {
        lines.pop();
      }
      const exists = content.length > 0;
      return buildAnchorFromLines(lines, exists, "", lineNumber, diffHunkHeader);
    } catch {
      return buildAnchor(file, lineNumber, diffHunkHeader);
    }
  }
  return buildAnchor(file, lineNumber, diffHunkHeader);
};

const lineMatchesContext = (expected: string | undefined, actual: string | undefined): boolean =>
  expected !== undefined && actual !== undefined && truncateContext(actual) === expected;

const hasAdjacentContextMatch = (
  lines: string[],
  lineIndex: number,
  anchor: CommentAnchor,
): boolean => {
  for (let index = 0; index < anchor.beforeContext.length; index += 1) {
    const offset = anchor.beforeContext.length - index;
    if (lineMatchesContext(anchor.beforeContext[index], lines[lineIndex - offset])) {
      return true;
    }
  }

  for (let index = 0; index < anchor.afterContext.length; index += 1) {
    if (lineMatchesContext(anchor.afterContext[index], lines[lineIndex + index + 1])) {
      return true;
    }
  }

  return false;
};

const findNearbyLine = (
  lines: string[],
  lineNumber: number,
  anchor: CommentAnchor,
): number | null => {
  const start = Math.max(0, lineNumber - 1 - NEARBY_LINE_WINDOW);
  const end = Math.min(lines.length - 1, lineNumber - 1 + NEARBY_LINE_WINDOW);
  const immediateBefore = anchor.beforeContext.at(-1);

  for (let index = start; index <= end; index += 1) {
    if (lines[index] !== anchor.lineContent) {
      continue;
    }

    if (immediateBefore === undefined) {
      return index + 1;
    }

    if (lineMatchesContext(immediateBefore, lines[index - 1])) {
      return index + 1;
    }
  }

  return null;
};

const findUniqueContextualLine = (lines: string[], anchor: CommentAnchor): number | null => {
  const matches: number[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] !== anchor.lineContent) {
      continue;
    }

    if (hasAdjacentContextMatch(lines, index, anchor)) {
      matches.push(index + 1);
    }
  }

  return matches.length === 1 ? matches[0] : null;
};

const normalizeComment = (raw: Record<string, unknown>): { changed: boolean; comment: Comment } => {
  let changed = false;
  const comment = raw as unknown as Comment;

  if (!isAnchor(raw.anchor)) {
    comment.anchor = buildAnchor(comment.file, comment.lineNumber);
    changed = true;
  }
  if (!isCommentStaleness(raw.staleness)) {
    comment.staleness = "fresh";
    changed = true;
  }
  if (raw.rebasedFromLine !== undefined && typeof raw.rebasedFromLine !== "number") {
    delete comment.rebasedFromLine;
    changed = true;
  }
  if (typeof raw.resolved !== "boolean") {
    comment.resolved = false;
    changed = true;
  }
  if (raw.resolvedBy !== undefined && typeof raw.resolvedBy !== "string") {
    delete comment.resolvedBy;
    changed = true;
  }
  if (raw.resolvedAt !== undefined && typeof raw.resolvedAt !== "string") {
    delete comment.resolvedAt;
    changed = true;
  }
  if (!Array.isArray(raw.replies) || !raw.replies.every(isReply)) {
    comment.replies = [];
    changed = true;
  }
  if (raw.createdBy !== undefined && typeof raw.createdBy !== "string") {
    delete comment.createdBy;
    changed = true;
  }

  return { changed, comment };
};

const reanchorComment = (comment: Comment): boolean => {
  const snapshot = readFileSnapshot(comment.file);
  const previousStaleness = comment.staleness;
  const previousLineNumber = comment.lineNumber;
  const previousRebasedFromLine = comment.rebasedFromLine;
  const wasCreatedFromMissingFile = comment.anchor.createdFromMissingFile === true;
  const previousCreatedFromMissingFile = comment.anchor.createdFromMissingFile;
  const suppressInitialMissingFileAutoResolve =
    wasCreatedFromMissingFile && !snapshot.exists && previousStaleness === "fresh";

  delete comment.rebasedFromLine;
  if (wasCreatedFromMissingFile && snapshot.exists) {
    comment.anchor.createdFromMissingFile = false;
  }

  if (!snapshot.exists) {
    comment.staleness = "stale";
  } else if (snapshot.lines[comment.lineNumber - 1] === comment.anchor.lineContent) {
    comment.staleness = "fresh";
  } else {
    const movedLine =
      findNearbyLine(snapshot.lines, comment.lineNumber, comment.anchor) ??
      findUniqueContextualLine(snapshot.lines, comment.anchor);

    if (movedLine === null) {
      comment.staleness = "stale";
    } else {
      comment.staleness = "moved";
      comment.rebasedFromLine = comment.lineNumber;
      comment.lineNumber = movedLine;
    }
  }

  if (
    process.env.DIFFHUB_AUTO_RESOLVE_STALE === "1" &&
    previousStaleness !== "stale" &&
    comment.staleness === "stale" &&
    comment.resolved !== true &&
    !suppressInitialMissingFileAutoResolve
  ) {
    comment.resolved = true;
    comment.resolvedBy = "diffhub:auto-stale";
    comment.resolvedAt = new Date().toISOString();
  }

  return (
    previousStaleness !== comment.staleness ||
    previousLineNumber !== comment.lineNumber ||
    previousRebasedFromLine !== comment.rebasedFromLine ||
    previousCreatedFromMissingFile !== comment.anchor.createdFromMissingFile
  );
};

const saveComments = (comments: Comment[]): void => {
  const path = getCommentsPath();
  const tempPath = `${path}.tmp`;
  writeFileSync(tempPath, JSON.stringify(comments, null, 2));
  renameSync(tempPath, path);
};

const readCommentsWithMetadata = ({ persistChanges = true } = {}): {
  changed: boolean;
  comments: Comment[];
} => {
  const path = getCommentsPath();
  if (!existsSync(path)) {
    return { changed: false, comments: [] };
  }

  const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  if (!Array.isArray(parsed) || parsed.some((comment) => !isCommentLike(comment))) {
    throw new Error("Comment store is corrupted");
  }

  let changed = false;
  const comments = parsed.map((raw) => {
    const normalized = normalizeComment(raw);
    changed ||= normalized.changed;
    changed ||= reanchorComment(normalized.comment);
    return normalized.comment;
  });

  if (changed && persistChanges) {
    saveComments(comments);
  }

  return { changed, comments };
};

export const readComments = (): Comment[] => readCommentsWithMetadata().comments;

const mutateComments = <T>(updater: (comments: Comment[]) => T): Promise<T> => {
  const runUpdate = (): T => {
    const { comments } = readCommentsWithMetadata({ persistChanges: false });
    const result = updater(comments);
    saveComments(comments);
    return result;
  };

  // oxlint-disable-next-line promise/prefer-await-to-then
  const nextMutation = mutationQueue.then(runUpdate, runUpdate);
  // oxlint-disable-next-line promise/prefer-await-to-then
  mutationQueue = nextMutation.then(
    () => null,
    () => null,
  );
  return nextMutation;
};

export const addComment = async (
  data: Omit<Comment, "anchor" | "createdAt" | "id" | "replies" | "resolved" | "staleness"> & {
    diffHunkHeader?: string;
  },
): Promise<Comment> => {
  const { diffHunkHeader, ...commentData } = data;
  const anchor = await buildAnchorAsync(data.file, data.lineNumber, data.side, diffHunkHeader);
  return mutateComments((comments) => {
    const comment: Comment = {
      ...commentData,
      anchor,
      createdAt: new Date().toISOString(),
      id: crypto.randomUUID(),
      replies: [],
      resolved: false,
      staleness: "fresh",
    };
    comments.push(comment);
    return comment;
  });
};

const getCurrentUser = (): string => {
  if (process.env.DIFFHUB_USER) {
    return process.env.DIFFHUB_USER;
  }

  try {
    const name = execFileSync("git", ["config", "user.name"], {
      cwd: getRepoPath(),
      encoding: "utf-8",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return name || "unknown";
  } catch {
    return "unknown";
  }
};

export const setCommentResolved = (id: string, resolved: boolean): Promise<Comment | null> =>
  mutateComments((comments) => {
    const comment = comments.find((candidate) => candidate.id === id);
    if (!comment) {
      return null;
    }

    comment.resolved = resolved;
    if (resolved) {
      comment.resolvedBy = getCurrentUser();
      comment.resolvedAt = new Date().toISOString();
    } else {
      delete comment.resolvedBy;
      delete comment.resolvedAt;
    }

    return comment;
  });

export const addReply = (id: string, body: string): Promise<Comment | null> =>
  mutateComments((comments) => {
    const comment = comments.find((candidate) => candidate.id === id);
    if (!comment) {
      return null;
    }

    comment.replies.push({
      at: new Date().toISOString(),
      body,
      by: getCurrentUser(),
    });
    return comment;
  });

export const deleteComment = (id: string): Promise<void> =>
  mutateComments((comments) => {
    const index = comments.findIndex((comment) => comment.id === id);
    if (index !== -1) {
      comments.splice(index, 1);
    }
  });

export const clearComments = (): Promise<void> =>
  mutateComments((comments) => {
    comments.splice(0);
  });
