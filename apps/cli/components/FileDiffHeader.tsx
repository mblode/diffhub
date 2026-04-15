"use client";

import { ChevronDownIcon, BubbleDotsIcon } from "blode-icons-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, truncateFilePath } from "@/lib/utils";

interface FileDiffHeaderProps {
  file: string;
  insertions: number;
  deletions: number;
  commentCount: number;
  repoPath: string;
  collapsed?: boolean;
  active?: boolean;
  onToggleCollapse?: () => void;
  headingId?: string;
  panelId?: string;
}

export const FileDiffHeader = ({
  file,
  insertions,
  deletions,
  commentCount,
  repoPath,
  collapsed = false,
  active = false,
  onToggleCollapse,
  headingId,
  panelId,
}: FileDiffHeaderProps) => {
  const truncated = truncateFilePath(file);
  const lastSlash = truncated.lastIndexOf("/");
  const dir = lastSlash === -1 ? "" : truncated.slice(0, lastSlash);
  const filename = lastSlash === -1 ? truncated : truncated.slice(lastSlash + 1);

  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
      return;
    }

    window.dispatchEvent(
      new CustomEvent("diffhub:file:toggle-collapse", {
        detail: { file },
      }),
    );
  };

  return (
    <TooltipProvider delay={400}>
      <div
        data-active={active ? "true" : undefined}
        data-state={collapsed ? "collapsed" : "expanded"}
        className="flex items-center gap-2 px-3 h-9 border-b border-border bg-card sticky top-0 z-10"
      >
        <h3
          id={headingId}
          className="flex min-w-0 flex-1 items-center gap-2 text-[12px] font-normal"
        >
          {/* Collapse affordance */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleToggleCollapse}
                  aria-expanded={!collapsed}
                  aria-controls={panelId}
                  aria-label={collapsed ? "Expand file section" : "Collapse file section"}
                  className="text-muted-foreground hover:bg-transparent active:bg-transparent aria-expanded:bg-transparent"
                />
              }
            >
              <ChevronDownIcon
                size={14}
                className={cn("transition-transform duration-150", collapsed && "-rotate-90")}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {collapsed ? "Expand file section" : "Collapse file section"}
            </TooltipContent>
          </Tooltip>

          {/* File path + stats (left group) */}
          <span className="flex min-w-0 items-center gap-2">
            <Tooltip>
              <TooltipTrigger render={<span className="flex min-w-0 items-center gap-1" />}>
                <span className="flex min-w-0 items-baseline gap-0 font-mono">
                  {dir && <span className="text-muted-foreground truncate shrink">{dir}/</span>}
                  <span className="text-muted-foreground font-normal shrink-0">{filename}</span>
                </span>
                <CopyButton value={`${repoPath}/${file}`} />
              </TooltipTrigger>
              {file !== truncated && <TooltipContent side="bottom">{file}</TooltipContent>}
            </Tooltip>

            {/* Stats inline after filename */}
            <span className="flex items-center gap-1 shrink-0">
              {insertions > 0 && (
                <span className="font-mono text-[12px] text-diff-green">+{insertions}</span>
              )}
              {deletions > 0 && (
                <span className="font-mono text-[12px] text-destructive">−{deletions}</span>
              )}
            </span>
          </span>
        </h3>

        {/* Comment badge */}
        {commentCount > 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-diff-purple/10 text-diff-purple text-[10px] shrink-0">
            <BubbleDotsIcon size={10} />
            {commentCount}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
