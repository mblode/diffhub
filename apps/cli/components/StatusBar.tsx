"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  CopySimpleIcon,
  SunIcon,
  MoonIcon,
  SplitIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowRotateClockwiseIcon,
  ArrowUpIcon,
  EyeOpenIcon,
  EyeSlashIcon,
} from "blode-icons-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Comment } from "@/lib/comment-types";
import { exportCommentsAsPrompt } from "@/lib/export-comments";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

export type DiffMode = "all" | "uncommitted";
export type WatchStatus = "connecting" | "live" | "offline" | "updated";

const DIFF_MODES: { value: DiffMode; label: string }[] = [
  { label: "All", value: "all" },
  { label: "Uncommitted changes", value: "uncommitted" },
];

const truncateMiddle = (str: string, maxLen = 24) => {
  if (str.length <= maxLen) {
    return str;
  }
  const half = Math.floor((maxLen - 1) / 2);
  return `${str.slice(0, half)}…${str.slice(-half)}`;
};

interface StatusBarProps {
  branch: string;
  baseBranch: string;
  refreshing: boolean;
  onRefresh: () => void;
  watchStatus: WatchStatus;
  syncNotice: {
    detail?: string;
    label: string;
    tone: "neutral" | "warning" | "destructive";
  } | null;
  comments: Comment[];
  onClearComments: () => Promise<boolean>;
  totalCommentCount: number;
  activeCommentIndex: number;
  showResolvedComments: boolean;
  onShowResolvedCommentsChange: (show: boolean) => void;
  onPreviousComment: () => void;
  onNextComment: () => void;
  diffMode: DiffMode;
  onDiffModeChange: (mode: DiffMode) => void;
  layout: "split" | "stacked";
  onLayoutChange: (l: "split" | "stacked") => void;
}

const getSyncNoticeToneClass = (
  tone: NonNullable<StatusBarProps["syncNotice"]>["tone"] | undefined,
) => {
  if (tone === "destructive") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  if (tone === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }

  return "border-border bg-muted/40 text-muted-foreground";
};

const SyncNoticeChip = ({ syncNotice }: { syncNotice: StatusBarProps["syncNotice"] }) => {
  if (!syncNotice) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-full border px-2 py-1 text-[11px] leading-none",
        getSyncNoticeToneClass(syncNotice.tone),
      )}
    >
      {syncNotice.label}
    </div>
  );
};

const getWatchStatusMeta = (status: WatchStatus, updating: boolean) => {
  if (updating) {
    return {
      className: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
      label: "Updating…",
    };
  }

  if (status === "updated") {
    return {
      className: "border-diff-green/30 bg-diff-green/10 text-diff-green",
      label: "Updated just now",
    };
  }

  if (status === "offline") {
    return {
      className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      label: "Watch offline",
    };
  }

  if (status === "connecting") {
    return {
      className: "border-border bg-muted/40 text-muted-foreground",
      label: "Connecting…",
    };
  }

  return {
    className: "border-border bg-muted/40 text-muted-foreground",
    label: "Live",
  };
};

const WatchStatusChip = ({ status, updating }: { status: WatchStatus; updating: boolean }) => {
  const meta = getWatchStatusMeta(status, updating);

  return (
    <div className={cn("rounded-full border px-2 py-1 text-[11px] leading-none", meta.className)}>
      {meta.label}
    </div>
  );
};

const noop = () => null;

const useHasMounted = () =>
  useSyncExternalStore(
    () => noop,
    () => true,
    () => false,
  );

const useDismissableMenu = (
  open: boolean,
  menuRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
) => {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuRef, onClose, open]);
};

const CommentNavigationControls = ({
  activeCommentIndex,
  commentCount,
  onNextComment,
  onPreviousComment,
}: {
  activeCommentIndex: number;
  commentCount: number;
  onNextComment: () => void;
  onPreviousComment: () => void;
}) => {
  if (commentCount === 0) {
    return null;
  }

  const label =
    activeCommentIndex >= 0 ? `${activeCommentIndex + 1}/${commentCount}` : String(commentCount);

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-background px-1 py-0.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onPreviousComment}
              aria-label="Previous comment"
              className="text-muted-foreground hover:text-foreground hover:bg-secondary"
            />
          }
        >
          <ArrowUpIcon size={12} />
        </TooltipTrigger>
        <TooltipContent side="bottom">Previous comment</TooltipContent>
      </Tooltip>
      <span className="min-w-10 text-center font-mono text-[11px] text-muted-foreground">
        {label}
      </span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onNextComment}
              aria-label="Next comment"
              className="text-muted-foreground hover:text-foreground hover:bg-secondary"
            />
          }
        >
          <ArrowDownIcon size={12} />
        </TooltipTrigger>
        <TooltipContent side="bottom">Next comment</TooltipContent>
      </Tooltip>
    </div>
  );
};

const ResolvedCommentsToggle = ({
  showResolvedComments,
  totalCommentCount,
  onShowResolvedCommentsChange,
}: {
  showResolvedComments: boolean;
  totalCommentCount: number;
  onShowResolvedCommentsChange: (show: boolean) => void;
}) => {
  const handleToggle = useCallback(() => {
    onShowResolvedCommentsChange(!showResolvedComments);
  }, [onShowResolvedCommentsChange, showResolvedComments]);

  if (totalCommentCount === 0) {
    return null;
  }

  const label = showResolvedComments ? "Hide resolved comments" : "Show resolved comments";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleToggle}
            aria-label={label}
            aria-pressed={!showResolvedComments}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary"
          />
        }
      >
        {showResolvedComments ? <EyeOpenIcon size={14} /> : <EyeSlashIcon size={14} />}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
};

export const StatusBar = ({
  branch,
  baseBranch,
  refreshing,
  onRefresh,
  watchStatus,
  syncNotice,
  comments,
  onClearComments,
  totalCommentCount,
  activeCommentIndex,
  showResolvedComments,
  onShowResolvedCommentsChange,
  onPreviousComment,
  onNextComment,
  diffMode,
  onDiffModeChange,
  layout,
  onLayoutChange,
}: StatusBarProps) => {
  const [copied, setCopied] = useState(false);
  const [copiedBranch, setCopiedBranch] = useState<"branch" | "base" | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const mounted = useHasMounted();
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme, setTheme } = useTheme();

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const branchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const copyBranch = async (value: string, which: "branch" | "base") => {
    try {
      await navigator.clipboard.writeText(value);
      if (branchTimerRef.current) {
        clearTimeout(branchTimerRef.current);
      }
      setCopiedBranch(which);
      branchTimerRef.current = setTimeout(() => setCopiedBranch(null), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const copyCommentsAsPrompt = async () => {
    try {
      const text = exportCommentsAsPrompt(comments);
      await navigator.clipboard.writeText(text);
      const cleared = await onClearComments();
      if (!cleared) {
        return;
      }
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      setCopied(true);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — don't flip copied state
    }
  };

  useDismissableMenu(modeMenuOpen, modeMenuRef, () => setModeMenuOpen(false));

  return (
    <TooltipProvider delay={400}>
      <header className="flex h-[52px] items-center gap-2 border-b border-border bg-card px-4 text-sm">
        {/* Sidebar toggle */}
        <Tooltip>
          <TooltipTrigger render={<SidebarTrigger className="-ml-1" />} />
          <TooltipContent side="bottom" className="flex items-center gap-2">
            <span>Toggle sidebar</span>
            <Kbd>⌘B</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Branch comparison badges */}
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onClick={() => copyBranch(branch, "branch")}
                  className="relative whitespace-nowrap rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs text-muted-foreground cursor-pointer hover:bg-secondary"
                />
              }
            >
              <span
                className={cn(
                  "transition-opacity duration-150",
                  copiedBranch === "branch" ? "opacity-0" : "opacity-100",
                )}
              >
                {truncateMiddle(branch)}
              </span>
              <span
                className={cn(
                  "absolute inset-0 flex items-center justify-center text-diff-green transition-opacity duration-150",
                  copiedBranch === "branch" ? "opacity-100" : "opacity-0",
                )}
              >
                <CheckIcon size={14} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {copiedBranch === "branch" ? "Copied!" : "Click to copy"}
            </TooltipContent>
          </Tooltip>
          <ArrowRightIcon size={12} className="text-muted-foreground/50 shrink-0" />
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onClick={() => copyBranch(baseBranch, "base")}
                  className="relative whitespace-nowrap rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs text-muted-foreground cursor-pointer hover:bg-secondary"
                />
              }
            >
              <span
                className={cn(
                  "transition-opacity duration-150",
                  copiedBranch === "base" ? "opacity-0" : "opacity-100",
                )}
              >
                {truncateMiddle(baseBranch)}
              </span>
              <span
                className={cn(
                  "absolute inset-0 flex items-center justify-center text-diff-green transition-opacity duration-150",
                  copiedBranch === "base" ? "opacity-100" : "opacity-0",
                )}
              >
                <CheckIcon size={14} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {copiedBranch === "base" ? "Copied!" : "Click to copy"}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
          <SyncNoticeChip syncNotice={syncNotice} />
          <WatchStatusChip status={watchStatus} updating={refreshing} />

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onRefresh}
                  disabled={refreshing}
                  aria-label="Force refresh diff"
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                />
              }
            >
              <ArrowRotateClockwiseIcon size={14} className={cn(refreshing && "animate-spin")} />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-2">
              <span>Force refresh</span>
              <Kbd>R</Kbd>
            </TooltipContent>
          </Tooltip>

          {/* Diff mode dropdown */}
          <div className="relative" ref={modeMenuRef}>
            <Button
              variant="ghost"
              size="xs"
              // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onClick={() => setModeMenuOpen((o) => !o)}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary gap-1"
            >
              {diffMode === "uncommitted" ? "Uncommitted" : "All"}
              <ChevronDownIcon
                size={10}
                className={cn("transition-transform duration-150", modeMenuOpen && "rotate-180")}
              />
            </Button>

            {modeMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-border bg-card shadow-lg dark:shadow-none py-1 overflow-hidden">
                {DIFF_MODES.map(({ value, label }) => (
                  <button
                    type="button"
                    key={value}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm text-left hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
                    // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                    onClick={() => {
                      onDiffModeChange(value);
                      setModeMenuOpen(false);
                    }}
                  >
                    <span className={cn("text-foreground", diffMode === value && "font-medium")}>
                      {label}
                    </span>
                    {diffMode === value && (
                      <CheckIcon size={14} className="text-diff-green shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <CommentNavigationControls
            activeCommentIndex={activeCommentIndex}
            commentCount={comments.length}
            onNextComment={onNextComment}
            onPreviousComment={onPreviousComment}
          />

          <ResolvedCommentsToggle
            showResolvedComments={showResolvedComments}
            totalCommentCount={totalCommentCount}
            onShowResolvedCommentsChange={onShowResolvedCommentsChange}
          />

          {comments.length > 0 && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={copyCommentsAsPrompt}
                    className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                  />
                }
              >
                {copied ? (
                  <CheckIcon data-icon="inline-start" />
                ) : (
                  <CopySimpleIcon data-icon="inline-start" />
                )}
                {copied
                  ? "Copied!"
                  : `Copy & clear ${comments.length} comment${comments.length === 1 ? "" : "s"}`}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Copy all comments as AI prompt, then clear them
              </TooltipContent>
            </Tooltip>
          )}

          {/* Layout toggle */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onClick={() => onLayoutChange(layout === "split" ? "stacked" : "split")}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                />
              }
            >
              <SplitIcon size={14} />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {layout === "split" ? "Switch to unified view (S)" : "Switch to split view (S)"}
            </TooltipContent>
          </Tooltip>

          {/* Theme toggle - only render after mount to avoid hydration mismatch */}
          {mounted && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                    onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                    className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                  />
                }
              >
                {resolvedTheme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </header>
    </TooltipProvider>
  );
};
