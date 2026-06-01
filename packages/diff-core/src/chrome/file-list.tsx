"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef } from "react";
import { ChevronDownIcon, MagnifyingGlassIcon } from "blode-icons-react";
import type { DiffFileStat } from "../lib/diff-file-stat";
import { cn } from "../lib/utils";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "../ui/sidebar";

// Loaded client-only: the tree mounts a Preact subtree into a custom element
// and owns its own DOM, so it can't be server-rendered (mirrors CodeView).
const FileTreeBody = dynamic(() => import("./file-tree-body"), { ssr: false });

const FILE_NAVIGATE_EVENT = "diffhub:file:navigate";

const numberFormat = new Intl.NumberFormat("en-US");

interface FileListProps {
  files: DiffFileStat[];
  selectedFile: string | null;
  onSelectFile: (file: string, behavior?: ScrollBehavior) => void;
  /** path → comment count, rendered as a trailing tree-row decoration. */
  commentsByFile?: Map<string, number>;
  filterQuery: string;
  onFilterChange: (q: string) => void;
  isLoading?: boolean;
  insertions: number;
  deletions: number;
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  // Collapsible panels
  statsOpen: boolean;
  onStatsOpenChange: (open: boolean) => void;
}

// ── Collapsible panels ──────────────────────────────────────────────────────

interface PanelHeaderProps {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  open: boolean;
  onToggle: () => void;
  trailing?: React.ReactNode;
}

const PanelHeader = ({ icon: Icon, title, open, onToggle, trailing }: PanelHeaderProps) => (
  <button
    type="button"
    aria-expanded={open}
    onClick={onToggle}
    className="flex h-9 w-full items-center gap-2 px-3 text-left text-[12px] transition-colors hover:bg-sidebar-accent/50"
  >
    {Icon && <Icon size={14} className="shrink-0 text-sidebar-foreground/50" />}
    <span className="min-w-0 flex-1 truncate font-medium text-sidebar-foreground/80">{title}</span>
    {trailing && <span className="shrink-0">{trailing}</span>}
    <ChevronDownIcon
      size={14}
      className={cn(
        "shrink-0 text-sidebar-foreground/40 transition-transform",
        !open && "-rotate-90",
      )}
    />
  </button>
);

const PanelRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between px-3 py-1 text-[12px]">
    <span className="text-sidebar-foreground/60">{label}</span>
    <span className="font-mono tabular-nums">{children}</span>
  </div>
);

interface DiffStatsPanelProps {
  open: boolean;
  onToggle: () => void;
  fileCount: number;
  insertions: number;
  deletions: number;
}

const DiffStatsPanel = ({
  open,
  onToggle,
  fileCount,
  insertions,
  deletions,
}: DiffStatsPanelProps) => (
  <div className="border-t border-sidebar-border">
    <PanelHeader title="Diff stats" open={open} onToggle={onToggle} />
    {open && (
      <div className="pb-1">
        <PanelRow label="Files">
          <span className="text-sidebar-foreground/80">{numberFormat.format(fileCount)}</span>
        </PanelRow>
        <PanelRow label="Additions">
          <span className="text-diff-green">+{numberFormat.format(insertions)}</span>
        </PanelRow>
        <PanelRow label="Deletions">
          <span className="text-destructive">−{numberFormat.format(deletions)}</span>
        </PanelRow>
        <PanelRow label="Lines">
          <span className="text-sidebar-foreground/80">
            {numberFormat.format(insertions + deletions)}
          </span>
        </PanelRow>
      </div>
    )}
  </div>
);

// ── Main component ──────────────────────────────────────────────────────────

const MIN_SIDEBAR_WIDTH = 8;

export const FileList = ({
  files,
  selectedFile,
  onSelectFile,
  commentsByFile,
  filterQuery,
  onFilterChange,
  isLoading = false,
  insertions,
  deletions,
  sidebarWidth,
  onSidebarWidthChange,
  statsOpen,
  onStatsOpenChange,
}: FileListProps) => {
  const filterInputRef = useRef<HTMLInputElement>(null);
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
      onSidebarWidthChange(newWidth);
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
  }, [onSidebarWidthChange]);

  const handleRailMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startWidth: sidebarWidth, startX: e.clientX };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [sidebarWidth],
  );

  const visibleFiles = files;

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
      onSelectFile(file, "auto");
    },
    [onSelectFile],
  );

  const handleFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange(e.target.value);
    },
    [onFilterChange],
  );

  const clearFilter = useCallback(() => {
    onFilterChange("");
  }, [onFilterChange]);

  const toggleStats = useCallback(() => {
    onStatsOpenChange(!statsOpen);
  }, [onStatsOpenChange, statsOpen]);

  let treeContent: React.ReactNode;
  if (isLoading) {
    treeContent = (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <p className="animate-pulse text-xs text-sidebar-foreground/50">Loading…</p>
      </div>
    );
  } else if (visibleFiles.length === 0) {
    treeContent = (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <p className="text-xs text-sidebar-foreground/50">No changes</p>
      </div>
    );
  } else {
    treeContent = (
      <FileTreeBody
        files={visibleFiles}
        selectedFile={selectedFile}
        onNavigate={handleNavigate}
        commentsByFile={commentsByFile}
        filterQuery={filterQuery}
      />
    );
  }

  return (
    <Sidebar collapsible="offcanvas" className="overflow-hidden border-r border-sidebar-border">
      <SidebarHeader className="gap-0 border-b border-sidebar-border p-0">
        {/* Filter — height matches the StatusBar header (h-[52px]) */}
        <div className="flex h-[52px] items-center px-2">
          <div className="relative flex w-full items-center">
            <MagnifyingGlassIcon
              size={12}
              className="pointer-events-none absolute left-2.5 text-sidebar-foreground/40"
            />
            <input
              ref={filterInputRef}
              type="text"
              value={filterQuery}
              onChange={handleFilterChange}
              placeholder="Filter files…"
              aria-label="Filter files"
              className="w-full rounded-md border border-sidebar-border bg-sidebar-accent py-1.5 pl-7 pr-7 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40 transition-colors focus:border-sidebar-ring/50 focus:outline-none"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={clearFilter}
                aria-label="Clear filter"
                className="absolute right-2 text-sm leading-none text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </SidebarHeader>

      {/* Tree */}
      <SidebarContent className="gap-0 overflow-hidden p-0">{treeContent}</SidebarContent>

      {/* Panels */}
      <SidebarFooter className="gap-0 p-0">
        <DiffStatsPanel
          open={statsOpen}
          onToggle={toggleStats}
          fileCount={files.length}
          insertions={insertions}
          deletions={deletions}
        />
      </SidebarFooter>

      {/* Resize rail */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 z-20 w-[5px] cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:transition-colors hover:after:bg-sidebar-border"
        onMouseDown={handleRailMouseDown}
      />
    </Sidebar>
  );
};
