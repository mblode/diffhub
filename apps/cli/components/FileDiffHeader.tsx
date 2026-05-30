"use client";

import {
  BubbleDotsIcon,
  ChevronDownIcon,
  CircleDotsCenter1Icon,
  CircleMinusIcon,
  CirclePlusIcon,
} from "blode-icons-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, truncateFilePath } from "@/lib/utils";

// `DiffFileStat` carries no git change-type, so derive a coarse one from the
// line counts to colour the header icon (new = green, removed = red, else muted).
const CHANGE_ICONS = {
  modified: { Icon: CircleDotsCenter1Icon, className: "text-muted-foreground" },
  new: { Icon: CirclePlusIcon, className: "text-diff-green" },
  removed: { Icon: CircleMinusIcon, className: "text-destructive" },
} as const;

const resolveChangeType = (insertions: number, deletions: number): keyof typeof CHANGE_ICONS => {
  if (deletions === 0) {
    return "new";
  }
  if (insertions === 0) {
    return "removed";
  }
  return "modified";
};

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
  const change = resolveChangeType(insertions, deletions);
  const ChangeIcon = CHANGE_ICONS[change].Icon;

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
        className="flex items-center gap-2 px-3 h-11 border-b border-border bg-card"
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

          {/* Change-type icon */}
          <ChangeIcon size={14} className={cn("shrink-0", CHANGE_ICONS[change].className)} />

          {/* File path + stats (left group) */}
          <span className="flex min-w-0 items-center gap-2">
            <Tooltip>
              <TooltipTrigger render={<span className="flex min-w-0 items-center gap-1" />}>
                <span className="flex min-w-0 items-baseline gap-0 font-mono">
                  {dir && <span className="text-muted-foreground truncate shrink">{dir}/</span>}
                  <span className="text-foreground font-normal shrink-0">{filename}</span>
                </span>
                <CopyButton value={`${repoPath}/${file}`} />
              </TooltipTrigger>
              {file !== truncated && <TooltipContent side="bottom">{file}</TooltipContent>}
            </Tooltip>

            {/* Stats inline after filename */}
            <span className="flex items-center gap-1 shrink-0">
              {deletions > 0 && (
                <span className="font-mono text-[12px] text-destructive">−{deletions}</span>
              )}
              {insertions > 0 && (
                <span className="font-mono text-[12px] text-diff-green">+{insertions}</span>
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
