"use client";

import { useRef, useState } from "react";
import {
  DotGrid1x3HorizontalIcon,
  EyeOpenIcon,
  EyeSlashIcon,
  BubbleDotsIcon,
} from "blode-icons-react";
import { ContextMenu } from "./ContextMenu";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

interface FileDiffHeaderProps {
  file: string;
  insertions: number;
  deletions: number;
  commentCount: number;
  repoPath: string;
  viewed: boolean;
  onToggleViewed: () => void;
  onDiscard?: () => Promise<void>;
}

export const FileDiffHeader = ({
  file,
  insertions,
  deletions,
  commentCount,
  repoPath,
  viewed,
  onToggleViewed,
  onDiscard,
}: FileDiffHeaderProps) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const lastSlash = file.lastIndexOf("/");
  const dir = lastSlash === -1 ? "" : file.slice(0, lastSlash);
  const filename = lastSlash === -1 ? file : file.slice(lastSlash + 1);

  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const handleOpenMenu = () => {
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    setContextMenu({ x: rect.left, y: rect.bottom + 4 });
  };

  return (
    <div className="flex items-center gap-2 px-3 h-9 border-b border-border bg-card sticky top-0 z-10">
      {/* File path + stats (left group) */}
      <div className="flex items-center gap-2 min-w-0 flex-1 text-[13px]">
        <div className="flex items-baseline gap-0 min-w-0">
          {dir && <span className="text-muted-foreground truncate shrink">{dir}/</span>}
          <span className="text-foreground font-medium shrink-0">{filename}</span>
        </div>

        {/* Stats inline after filename */}
        <div className="flex items-center gap-1 shrink-0">
          {insertions > 0 && (
            <span className="font-mono text-[12px] text-diff-green">+{insertions}</span>
          )}
          {deletions > 0 && (
            <span className="font-mono text-[12px] text-destructive">−{deletions}</span>
          )}
        </div>
      </div>

      {/* Comment badge */}
      {commentCount > 0 && (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-diff-purple/10 text-diff-purple text-[10px] shrink-0">
          <BubbleDotsIcon size={10} />
          {commentCount}
        </div>
      )}

      {/* Open in… button */}
      <Button
        ref={menuButtonRef}
        variant="ghost"
        size="icon-xs"
        onClick={handleOpenMenu}
        className="text-muted-foreground hover:text-foreground hover:bg-secondary"
        title="Open in…"
      >
        <DotGrid1x3HorizontalIcon />
      </Button>

      {/* Viewed toggle */}
      <Toggle
        pressed={viewed}
        onPressedChange={onToggleViewed}
        className={cn(
          viewed ? "text-ring hover:text-ring/80" : "text-muted-foreground hover:text-foreground",
        )}
        title={viewed ? "Mark as not viewed" : "Mark as viewed"}
        aria-label={viewed ? "Mark as not viewed" : "Mark as viewed"}
      >
        {viewed ? <EyeOpenIcon /> : <EyeSlashIcon />}
      </Toggle>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          filePath={file}
          repoPath={repoPath}
          // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
          onClose={() => setContextMenu(null)}
          onDiscard={onDiscard}
        />
      )}
    </div>
  );
};
