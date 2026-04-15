"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  CopySimpleIcon,
  SunIcon,
  MoonIcon,
  SplitIcon,
  ArrowRightIcon,
} from "blode-icons-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Comment } from "@/lib/comments";
import type { FileWatchState } from "@/lib/use-file-watch";
import { exportCommentsAsPrompt } from "@/lib/export-comments";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type DiffMode = "all" | "uncommitted";

const DIFF_MODES: { value: DiffMode; label: string }[] = [
  { label: "All changes", value: "all" },
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
  fileWatchState: FileWatchState;
  syncNotice: {
    detail?: string;
    label: string;
    tone: "neutral" | "warning" | "destructive";
  } | null;
  comments: Comment[];
  diffMode: DiffMode;
  onDiffModeChange: (mode: DiffMode) => void;
  layout: "split" | "stacked";
  onLayoutChange: (l: "split" | "stacked") => void;
}

const getWatchStateMeta = (fileWatchState: FileWatchState) => {
  if (fileWatchState === "connecting") {
    return {
      className: "bg-muted-foreground/50",
      label: "Connecting",
    };
  }

  if (fileWatchState === "live") {
    return {
      className: "bg-diff-green",
      label: "Live",
    };
  }

  return {
    className: "bg-amber-500",
    label: "Polling",
  };
};

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

export const StatusBar = ({
  branch,
  baseBranch,
  refreshing,
  fileWatchState,
  syncNotice,
  comments,
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

  const { className: watchStateClass, label: watchStateLabel } = getWatchStateMeta(fileWatchState);

  return (
    <header className="flex h-[52px] items-center gap-2 border-b border-border bg-card px-4 text-sm">
      {/* Branch comparison badges */}
      <TooltipProvider delay={400}>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onClick={() => copyBranch(branch, "branch")}
                  className="relative whitespace-nowrap rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs font-medium text-foreground cursor-pointer hover:bg-secondary"
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
      </TooltipProvider>

      <div className="flex-1" />

      <div className="flex items-center gap-0.5">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 pr-1.5">
          <span
            className={cn(
              "mx-1 size-1.5 rounded-full",
              watchStateClass,
              refreshing && "animate-pulse",
            )}
          />
          <span className="text-[11px] text-muted-foreground">{watchStateLabel}</span>
        </div>

        <SyncNoticeChip syncNotice={syncNotice} />

        {/* Diff mode dropdown */}
        <div className="relative" ref={modeMenuRef}>
          <Button
            variant="ghost"
            size="xs"
            // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onClick={() => setModeMenuOpen((o) => !o)}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary gap-1"
          >
            {diffMode === "uncommitted" ? "Uncommitted" : "All changes"}
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

        {/* Comments export */}
        {comments.length > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={copyCommentsAsPrompt}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary"
            title="Copy all comments as AI prompt"
          >
            {copied ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CopySimpleIcon data-icon="inline-start" />
            )}
            {copied
              ? "Copied!"
              : `Copy ${comments.length} comment${comments.length === 1 ? "" : "s"}`}
          </Button>
        )}

        {/* Layout toggle */}
        <Button
          variant="ghost"
          size="icon-xs"
          // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
          onClick={() => onLayoutChange(layout === "split" ? "stacked" : "split")}
          className="text-muted-foreground hover:text-foreground hover:bg-secondary"
          title={layout === "split" ? "Switch to unified view (S)" : "Switch to split view (S)"}
        >
          <SplitIcon size={14} />
        </Button>

        {/* Theme toggle - only render after mount to avoid hydration mismatch */}
        {mounted && (
          <Button
            variant="ghost"
            size="icon-xs"
            // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary"
            title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {resolvedTheme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
          </Button>
        )}
      </div>
    </header>
  );
};
