"use client";

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BubbleDotsIcon,
  Folder1Icon,
  FolderOpenFilledIcon,
  MagnifyingGlassIcon,
} from "blode-icons-react";
import { FileAddedIcon, FileDiffIcon, FileRemovedIcon } from "./icons/file-status-icons";
import type { DiffFileStat } from "@/lib/diff-file-stat";
import type { Comment } from "@/lib/comment-types";
import { cn, truncateFilePath } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";

const FILE_NAVIGATE_EVENT = "diffhub:file:navigate";
const FILE_TREE_EXPAND_ALL_EVENT = "diffhub:file-tree:expand-all";
const FILE_TREE_COLLAPSE_ALL_EVENT = "diffhub:file-tree:collapse-all";

interface FileListProps {
  files: DiffFileStat[];
  selectedFile: string | null;
  onSelectFile: (file: string, behavior?: ScrollBehavior) => void;
  comments: Comment[];
  filterQuery: string;
  onFilterChange: (q: string) => void;
  isLoading?: boolean;
  insertions: number;
  deletions: number;
}

// ── Tree types ──────────────────────────────────────────────────────────────

interface FileNode {
  type: "file";
  name: string;
  path: string;
  fileStat: DiffFileStat;
}

interface FolderNode {
  type: "folder";
  /** May be "a/b/c" after compaction of single-child chains. */
  name: string;
  /** Path of the deepest folder in the (possibly compacted) chain. */
  path: string;
  children: TreeNode[];
}

type TreeNode = FileNode | FolderNode;

// ── Phase 1: Build hierarchical tree from flat file list ────────────────────

const buildTree = (files: DiffFileStat[]): TreeNode[] => {
  interface RawNode {
    files: DiffFileStat[];
    folders: Record<string, RawNode>;
  }
  const root: RawNode = { files: [], folders: {} };

  for (const fileStat of files) {
    const parts = fileStat.file.split("/");
    let current = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      if (!current.folders[part]) {
        current.folders[part] = { files: [], folders: {} };
      }
      current = current.folders[part];
    }
    current.files.push(fileStat);
  }

  const convertFolder = (name: string, node: RawNode, parentPath: string): FolderNode => {
    const path = parentPath ? `${parentPath}/${name}` : name;
    const children: TreeNode[] = [];

    for (const [fn, child] of Object.entries(node.folders).toSorted()) {
      children.push(convertFolder(fn, child, path));
    }
    for (const fileStat of node.files) {
      const parts = fileStat.file.split("/");
      children.push({
        fileStat,
        name: parts.at(-1) ?? fileStat.file,
        path: fileStat.file,
        type: "file",
      });
    }
    return { children, name, path, type: "folder" };
  };

  const result: TreeNode[] = [];
  for (const [fn, node] of Object.entries(root.folders).toSorted()) {
    result.push(convertFolder(fn, node, ""));
  }
  for (const fileStat of root.files) {
    result.push({ fileStat, name: fileStat.file, path: fileStat.file, type: "file" });
  }
  return result;
};

// ── Phase 2: Compact single-child-folder chains (VS Code / Zed style) ───────
//
// When a folder has exactly 1 child that is itself a folder (and no files),
// merge them into one display node: "parent/child" (recursive).

const compactTree = (nodes: TreeNode[]): TreeNode[] =>
  nodes.map((node) => {
    if (node.type === "file") {
      return node;
    }

    const kids = compactTree(node.children);

    if (kids.length === 1 && kids[0].type === "folder") {
      const only = kids[0] as FolderNode;
      return { ...only, name: `${node.name}/${only.name}` } satisfies FolderNode;
    }

    return { ...node, children: kids };
  });

const collectFolderPaths = (nodes: TreeNode[], paths: string[] = []) => {
  for (const node of nodes) {
    if (node.type === "folder") {
      paths.push(node.path);
      collectFolderPaths(node.children, paths);
    }
  }

  return paths;
};

// ── Sub-components ──────────────────────────────────────────────────────────

interface FileRowProps {
  node: FileNode;
  depth: number;
  isSelected: boolean;
  commentCount: number;
  onNavigate: (path: string) => void;
}

const FileRow = memo(function FileRow({
  node,
  depth,
  isSelected,
  commentCount,
  onNavigate,
}: FileRowProps) {
  const indent = depth * 16 + 8;
  const { insertions, deletions } = node.fileStat;

  let FileStatusIcon = FileDiffIcon;
  if (insertions > 0 && deletions === 0) {
    FileStatusIcon = FileAddedIcon;
  } else if (deletions > 0 && insertions === 0) {
    FileStatusIcon = FileRemovedIcon;
  }

  let iconClass = "shrink-0 text-sidebar-foreground/40";
  if (insertions > 0 && deletions === 0) {
    iconClass = "shrink-0 text-diff-green";
  } else if (deletions > 0 && insertions === 0) {
    iconClass = "shrink-0 text-destructive";
  }

  return (
    <button
      type="button"
      aria-current={isSelected ? "true" : undefined}
      className={cn(
        "flex w-full cursor-pointer items-center gap-1.5 py-1 text-left transition-colors",
        isSelected
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
      data-file-path={node.path}
      data-selected={isSelected ? "true" : undefined}
      style={{
        containIntrinsicBlockSize: "26px",
        contentVisibility: "auto",
        paddingLeft: indent,
        paddingRight: 8,
      }}
      // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
      onClick={() => onNavigate(node.path)}
    >
      <FileStatusIcon size={16} className={iconClass} />
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="flex-1 truncate text-[12px] leading-tight text-muted-foreground" />
          }
        >
          {node.name}
        </TooltipTrigger>
        <TooltipContent side="right">{node.path}</TooltipContent>
      </Tooltip>
      {commentCount > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-sidebar-foreground/50">
          <BubbleDotsIcon size={10} />
          {commentCount}
        </span>
      )}
    </button>
  );
});

interface FolderRowProps {
  node: FolderNode;
  depth: number;
  isCollapsed: boolean;
  onToggle: (path: string) => void;
  children: React.ReactNode;
}

interface FileTreeProps {
  nodes: TreeNode[];
  depth: number;
  selectedFile: string | null;
  commentsByFile: Map<string, number>;
  collapsedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onNavigate: (path: string) => void;
}

const FolderRow = memo(function FolderRow({
  node,
  depth,
  isCollapsed,
  onToggle,
  children,
}: FolderRowProps) {
  const indent = depth * 16 + 8;
  const truncatedName = truncateFilePath(node.name);
  const segments = truncatedName.split("/");

  return (
    <>
      <button
        type="button"
        aria-expanded={!isCollapsed}
        className="flex w-full items-center gap-1.5 py-1 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
        style={{ paddingLeft: indent, paddingRight: 8 }}
        // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onClick={() => onToggle(node.path)}
      >
        {isCollapsed ? (
          <Folder1Icon size={16} className="shrink-0 text-sidebar-foreground/50" />
        ) : (
          <FolderOpenFilledIcon size={16} className="shrink-0 text-sidebar-foreground/50" />
        )}
        <Tooltip>
          <TooltipTrigger render={<span className="truncate text-[12px] text-muted-foreground" />}>
            {segments.map((seg, i) => {
              const key = segments.slice(0, i + 1).join("/");

              return (
                <Fragment key={key}>
                  {seg}
                  {i < segments.length - 1 && <span className="text-sidebar-foreground/30">/</span>}
                </Fragment>
              );
            })}
          </TooltipTrigger>
          {node.name !== truncatedName && <TooltipContent side="right">{node.name}</TooltipContent>}
        </Tooltip>
      </button>
      {!isCollapsed && (
        <div className="relative">
          {/* Indent guide line — centred on the folder icon (icon is 16px wide, offset 8px) */}
          <div
            className="pointer-events-none absolute inset-y-0 border-l border-sidebar-border/60"
            style={{ left: indent + 8 }}
          />
          {children}
        </div>
      )}
    </>
  );
});

const FileTree = memo(function FileTree({
  nodes,
  depth,
  selectedFile,
  commentsByFile,
  collapsedFolders,
  onToggleFolder,
  onNavigate,
}: FileTreeProps) {
  return nodes.map((node) => {
    if (node.type === "folder") {
      return (
        <FolderRow
          key={node.path}
          node={node}
          depth={depth}
          isCollapsed={collapsedFolders.has(node.path)}
          onToggle={onToggleFolder}
        >
          <FileTree
            nodes={node.children}
            depth={depth + 1}
            selectedFile={selectedFile}
            commentsByFile={commentsByFile}
            collapsedFolders={collapsedFolders}
            onToggleFolder={onToggleFolder}
            onNavigate={onNavigate}
          />
        </FolderRow>
      );
    }

    return (
      <FileRow
        key={node.path}
        node={node}
        depth={depth}
        isSelected={selectedFile === node.path}
        commentCount={commentsByFile.get(node.path) ?? 0}
        onNavigate={onNavigate}
      />
    );
  });
});

// ── Main component ──────────────────────────────────────────────────────────

const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 8;

export const FileList = ({
  files,
  selectedFile,
  onSelectFile,
  comments,
  filterQuery,
  onFilterChange,
  isLoading = false,
  insertions,
  deletions,
}: FileListProps) => {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const clearDragState = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) {
        return;
      }
      const newWidth = Math.max(
        MIN_SIDEBAR_WIDTH,
        dragRef.current.startWidth + e.clientX - dragRef.current.startX,
      );
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (!dragRef.current) {
        return;
      }
      clearDragState();
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleMouseUp);
    return () => {
      clearDragState();
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleMouseUp);
    };
  }, []);

  const handleRailMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startWidth: sidebarWidth, startX: e.clientX };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [sidebarWidth],
  );

  const filtered = useMemo(
    () =>
      filterQuery
        ? files.filter((f) => f.file.toLowerCase().includes(filterQuery.toLowerCase()))
        : files,
    [files, filterQuery],
  );

  const tree = useMemo(() => compactTree(buildTree(filtered)), [filtered]);
  const folderPaths = useMemo(() => collectFolderPaths(tree), [tree]);

  useEffect(() => {
    const handleExpandAll = () => {
      setCollapsedFolders(new Set());
    };
    const handleCollapseAll = () => {
      setCollapsedFolders(new Set(folderPaths));
    };

    window.addEventListener(FILE_TREE_EXPAND_ALL_EVENT, handleExpandAll);
    window.addEventListener(FILE_TREE_COLLAPSE_ALL_EVENT, handleCollapseAll);

    return () => {
      window.removeEventListener(FILE_TREE_EXPAND_ALL_EVENT, handleExpandAll);
      window.removeEventListener(FILE_TREE_COLLAPSE_ALL_EVENT, handleCollapseAll);
    };
  }, [folderPaths]);

  const commentsByFile = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of comments) {
      map.set(c.file, (map.get(c.file) ?? 0) + 1);
    }
    return map;
  }, [comments]);

  const toggleFolder = useCallback((path: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleNavigate = useCallback(
    (file: string) => {
      const navigationEvent = new CustomEvent(FILE_NAVIGATE_EVENT, {
        cancelable: true,
        detail: { file, source: "sidebar" as const },
      });
      const wasCanceled = !window.dispatchEvent(navigationEvent);
      if (wasCanceled) {
        return;
      }

      // Always navigate - scrollToFile handles lazy-loaded sections
      onSelectFile(file, "auto");
    },
    [onSelectFile],
  );

  let treeContent: React.ReactNode = null;
  if (isLoading) {
    treeContent = (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <p className="animate-pulse text-xs text-sidebar-foreground/50">Loading…</p>
      </div>
    );
  } else if (filtered.length === 0) {
    treeContent = (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <p className="text-xs text-sidebar-foreground/50">No changes</p>
        {filterQuery && (
          <p className="text-[10px] text-sidebar-foreground/30">
            No files match &ldquo;{filterQuery}&rdquo;
          </p>
        )}
      </div>
    );
  } else {
    treeContent = (
      <FileTree
        nodes={tree}
        depth={0}
        selectedFile={selectedFile}
        commentsByFile={commentsByFile}
        collapsedFolders={collapsedFolders}
        onToggleFolder={toggleFolder}
        onNavigate={handleNavigate}
      />
    );
  }

  return (
    <TooltipProvider delay={400}>
      <Sidebar
        collapsible="none"
        className="sticky top-0 h-svh self-start overflow-hidden border-r border-sidebar-border"
        style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
      >
        {/* Filter */}
        <SidebarHeader className="border-b border-sidebar-border h-[52px] flex-row items-center py-0 px-2">
          <div className="relative flex w-full items-center">
            <MagnifyingGlassIcon
              size={12}
              className="pointer-events-none absolute left-2.5 text-sidebar-foreground/40"
            />
            <input
              type="text"
              value={filterQuery}
              // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder="Filter files…"
              aria-label="Filter files"
              className="w-full rounded-md border border-sidebar-border bg-sidebar-accent py-1.5 pl-7 pr-7 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40 transition-colors focus:border-sidebar-ring/50 focus:outline-none"
            />
            {filterQuery && (
              <button
                type="button"
                // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                onClick={() => onFilterChange("")}
                aria-label="Clear filter"
                className="absolute right-2 text-sm leading-none text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
              >
                ×
              </button>
            )}
          </div>
        </SidebarHeader>

        {/* Tree */}
        <SidebarContent className="gap-0 py-1">{treeContent}</SidebarContent>

        {/* Stats footer */}
        <SidebarFooter className="border-t border-sidebar-border px-3 py-2">
          <div className="flex items-center gap-2 text-[12px] font-mono text-sidebar-foreground/60">
            <span>
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
            {insertions > 0 && <span className="text-diff-green">+{insertions}</span>}
            {deletions > 0 && <span className="text-destructive">−{deletions}</span>}
          </div>
        </SidebarFooter>

        {/* Resize rail */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 z-20 w-[5px] cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:-translate-x-1/2 after:w-px after:transition-colors hover:after:bg-sidebar-border"
          onMouseDown={handleRailMouseDown}
        />
      </Sidebar>
    </TooltipProvider>
  );
};
