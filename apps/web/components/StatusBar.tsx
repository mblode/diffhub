"use client";

import {
  CopySimpleIcon,
  CheckIcon,
  ChevronDownIcon,
  SunIcon,
  MoonIcon,
  SplitIcon,
  ArrowRightIcon,
} from "blode-icons-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import type { Comment } from "@/lib/comments";
import { exportCommentsAsPrompt } from "@/lib/export-comments";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DiffMode = "all" | "uncommitted";

const DIFF_MODES: { value: DiffMode; label: string }[] = [
  { label: "All changes", value: "all" },
  { label: "Uncommitted changes", value: "uncommitted" },
];

interface StatusBarProps {
  branch: string;
  baseBranch: string;
  insertions: number;
  deletions: number;
  fileCount: number;
  refreshing: boolean;
  lastUpdated: Date | null;
  comments: Comment[];
  diffMode: DiffMode;
  onDiffModeChange: (mode: DiffMode) => void;
  layout: "split" | "stacked";
  onLayoutChange: (l: "split" | "stacked") => void;
}

export const StatusBar = ({
  branch,
  baseBranch,
  insertions,
  deletions,
  fileCount,
  refreshing,
  lastUpdated,
  comments,
  diffMode,
  onDiffModeChange,
  layout,
  onLayoutChange,
}: StatusBarProps) => {
  const [copied, setCopied] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme, setTheme } = useTheme();

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const copyCommentsAsPrompt = async () => {
    try {
      const text = exportCommentsAsPrompt(comments);
      await navigator.clipboard.writeText(text);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      setCopied(true);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — don't flip copied state
    }
  };

  useEffect(() => {
    if (!modeMenuOpen) {
      return;
    }
    const handleClick = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setModeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modeMenuOpen]);

  return (
    <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-2.5 text-sm">
      {/* Branch comparison badges */}
      <div className="flex items-center gap-1.5">
        <span className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs font-medium text-foreground">
          {branch}
        </span>
        <ArrowRightIcon size={12} className="text-muted-foreground/50 shrink-0" />
        <span className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs text-muted-foreground">
          {baseBranch}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground">
          {fileCount} {fileCount === 1 ? "file" : "files"}
        </span>
        {insertions > 0 && <span className="text-xs font-mono text-diff-green">+{insertions}</span>}
        {deletions > 0 && <span className="text-xs font-mono text-destructive">−{deletions}</span>}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-0.5">
        {/* Live indicator */}
        {lastUpdated && (
          <span
            className={cn(
              "size-1.5 rounded-full bg-diff-green mx-1.5",
              refreshing && "animate-pulse",
            )}
          />
        )}

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

        {/* Theme toggle */}
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
      </div>
    </header>
  );
};
