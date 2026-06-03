"use client";

import { useEffect, useMemo, useRef } from "react";
import { FileTree as PierreFileTree, useFileTree, useFileTreeSearch } from "@pierre/trees/react";
import type { FileTreeRowDecoration, FileTreeRowDecorationContext } from "@pierre/trees";
import type { DiffFileStat } from "../lib/diff-file-stat";
import { toGitStatusEntries } from "../lib/file-tree-git-status";

const EMPTY_COMMENTS = new Map<string, number>();

interface FileTreeBodyProps {
  files: DiffFileStat[];
  selectedFile: string | null;
  /** Called when the user activates a file row (single click / keyboard). */
  onNavigate: (file: string) => void;
  /** path → comment count, rendered as a trailing row decoration. */
  commentsByFile?: Map<string, number>;
  /** Current filter text; drives the tree's hide-non-matches search. */
  filterQuery: string;
}

// Swap the tree's built-in chevron (a bold 16px filled glyph) for the lighter
// blode-icons-react ChevronDownIcon. The tree references icons by sprite symbol
// id, so we inject a <symbol> and remap the `file-tree-icon-chevron` slot to it.
const CHEVRON_SYMBOL_ID = "diffhub-tree-chevron";
const CHEVRON_VIEW_BOX = "0 0 24 24";
const CHEVRON_SPRITE = `<svg data-icon-sprite aria-hidden="true" width="0" height="0"><symbol id="${CHEVRON_SYMBOL_ID}" viewBox="${CHEVRON_VIEW_BOX}"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9.5 6 6 6-6"/></symbol></svg>`;

// Map the tree's themeable surface onto the app's sidebar / diff tokens. CSS
// custom properties inherit across the shadow boundary, so setting the
// `*-override` vars on the host element reaches the tree's internal styles.
const TREE_STYLE = {
  "--trees-accent-override": "var(--sidebar-accent-foreground)",
  "--trees-bg-override": "var(--sidebar)",
  "--trees-border-color-override": "var(--sidebar-border)",
  "--trees-fg-muted-override": "color-mix(in oklch, var(--sidebar-foreground) 55%, transparent)",
  "--trees-fg-override": "var(--sidebar-foreground)",
  "--trees-focus-ring-color-override": "var(--sidebar-ring)",
  "--trees-git-added-color-override": "var(--diff-green)",
  "--trees-git-deleted-color-override": "var(--destructive)",
  "--trees-git-modified-color-override":
    "color-mix(in oklch, var(--sidebar-foreground) 70%, transparent)",
  "--trees-indent-guide-bg-override": "color-mix(in oklch, var(--sidebar-border) 60%, transparent)",
  "--trees-scrollbar-thumb-override": "var(--sidebar-border)",
  "--trees-selected-bg-override": "var(--sidebar-accent)",
  "--trees-selected-fg-override": "var(--sidebar-accent-foreground)",
  "--trees-selected-focused-border-color-override": "var(--sidebar-ring)",
  height: "100%",
} as React.CSSProperties;

const FileTreeBody = ({
  files,
  selectedFile,
  onNavigate,
  commentsByFile = EMPTY_COMMENTS,
  filterQuery,
}: FileTreeBodyProps) => {
  const paths = useMemo(() => files.map((f) => f.file), [files]);
  const gitStatus = useMemo(() => toGitStatusEntries(files), [files]);

  // The model captures these closures once (at construction), so read live
  // values through refs to avoid a stale-closure bug after re-renders.
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const commentsRef = useRef(commentsByFile);
  commentsRef.current = commentsByFile;
  const selectedRef = useRef(selectedFile);

  const { model } = useFileTree({
    fileTreeSearchMode: "hide-non-matches",
    flattenEmptyDirectories: true,
    gitStatus,
    icons: {
      colored: true,
      remap: {
        // The blode glyph spans less of its viewBox than the bundled chevron,
        // so it reads noticeably smaller within the same 16px icon slot.
        "file-tree-icon-chevron": { name: CHEVRON_SYMBOL_ID, viewBox: CHEVRON_VIEW_BOX },
      },
      set: "standard",
      spriteSheet: CHEVRON_SPRITE,
    },
    initialSelectedPaths: selectedFile ? [selectedFile] : [],
    onSelectionChange: (selectedPaths) => {
      const [file] = selectedPaths;
      // Ignore selection changes we triggered ourselves while reflecting the
      // externally-driven active file (set via selectedRef before .select()).
      if (file && file !== selectedRef.current) {
        onNavigateRef.current(file);
      }
    },
    paths,
    renderRowDecoration: ({ item }: FileTreeRowDecorationContext): FileTreeRowDecoration | null => {
      if (item.kind !== "file") {
        return null;
      }
      const count = commentsRef.current.get(item.path);
      if (!count) {
        return null;
      }
      return { text: String(count), title: `${count} comment${count === 1 ? "" : "s"}` };
    },
  });

  const search = useFileTreeSearch(model);

  // Rebuilding the tree (`resetPaths`) clears its DOM and visibly flashes, so do
  // it only when the *set* of files actually changes — not on every re-fetch
  // that merely changed line counts. Status/decoration changes are applied
  // incrementally via `setGitStatus` below, which doesn't flash.
  const pathsKey = useMemo(() => paths.join("\n"), [paths]);
  const prevPathsKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevPathsKeyRef.current === null) {
      prevPathsKeyRef.current = pathsKey;
      return;
    }
    if (prevPathsKeyRef.current === pathsKey) {
      return;
    }
    prevPathsKeyRef.current = pathsKey;
    model.resetPaths(paths);
    model.setGitStatus(gitStatus);
  }, [model, paths, pathsKey, gitStatus]);

  // Comments aren't part of the tree input; re-applying git status nudges the
  // virtualizer to re-render visible rows so comment decorations update live.
  useEffect(() => {
    model.setGitStatus(gitStatus);
  }, [model, commentsByFile, gitStatus]);

  // Mirror the external filter input into the tree's search session.
  useEffect(() => {
    model.setSearch(filterQuery || null);
  }, [model, filterQuery]);

  // Reflect the scroll-driven active file back into the tree's selection.
  useEffect(() => {
    selectedRef.current = selectedFile;
    if (!selectedFile) {
      return;
    }
    const current = model.getSelectedPaths();
    if (current[0] === selectedFile && current.length === 1) {
      return;
    }
    for (const path of current) {
      if (path !== selectedFile) {
        model.getItem(path)?.deselect();
      }
    }
    model.getItem(selectedFile)?.select();
    model.scrollToPath(selectedFile, { offset: "nearest" });
  }, [model, selectedFile]);

  const noMatches = filterQuery.length > 0 && search.matchingPaths.length === 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <PierreFileTree model={model} className="min-h-0 flex-1" style={TREE_STYLE} />
      {noMatches && (
        <div className="pointer-events-none absolute inset-x-0 top-8 flex flex-col items-center gap-2 px-4 text-center">
          <p className="text-xs text-sidebar-foreground/50">No changes</p>
          <p className="text-[10px] text-sidebar-foreground/30">
            No files match &ldquo;{filterQuery}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
};

export default FileTreeBody;
