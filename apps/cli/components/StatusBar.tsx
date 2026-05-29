"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopySimpleIcon,
  SplitIcon,
  SunIcon,
  MoonIcon,
  ArrowRightIcon,
  ArrowRotateClockwiseIcon,
  SettingsGear1Icon,
  ContrastIcon,
} from "blode-icons-react";
import { useTheme } from "next-themes";
import { useRef, useState, useSyncExternalStore } from "react";
import type { Comment } from "@/lib/comment-types";
import type { DisplaySettings, DiffIndicatorStyle } from "@/lib/display-settings";
import type { DiffThemeSelection } from "@/lib/diff-themes";
import { DIFF_THEMES } from "@/lib/diff-themes";
import { exportCommentsAsPrompt } from "@/lib/export-comments";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
  diffMode: DiffMode;
  onDiffModeChange: (mode: DiffMode) => void;
  layout: "split" | "stacked";
  onLayoutChange: (l: "split" | "stacked") => void;
  displaySettings: DisplaySettings;
  onDisplaySettingsChange: (settings: DisplaySettings) => void;
  diffThemes: DiffThemeSelection;
  onDiffThemesChange: (themes: DiffThemeSelection) => void;
}

const INDICATOR_OPTIONS: { value: DiffIndicatorStyle; label: string }[] = [
  { label: "Classic", value: "classic" },
  { label: "Bars", value: "bars" },
  { label: "None", value: "none" },
];

const LIGHT_THEMES = DIFF_THEMES.filter((theme) => theme.type === "light");
const DARK_THEMES = DIFF_THEMES.filter((theme) => theme.type === "dark");

// ── Inline primitives (no Switch/ToggleGroup in components/ui) ───────────────

const Switch = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
    onClick={() => onChange(!checked)}
    className={cn(
      "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
      checked ? "bg-primary" : "bg-secondary",
    )}
  >
    <span
      className={cn(
        "inline-block h-3.5 w-3.5 rounded-full bg-background shadow-sm transition-transform",
        checked ? "translate-x-[18px]" : "translate-x-[3px]",
      )}
    />
  </button>
);

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

const SegmentedControl = <T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (next: T) => void;
  ariaLabel: string;
}) => (
  <div
    role="group"
    aria-label={ariaLabel}
    className="inline-flex items-center gap-0.5 rounded-md border border-border bg-secondary p-0.5"
  >
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          type="button"
          key={option.value}
          aria-pressed={active}
          // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded px-2 py-0.5 text-[11px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
            active
              ? "bg-card text-foreground shadow-sm dark:shadow-none"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

type ThemeModeOption = "system" | "light" | "dark";
const THEME_MODE_OPTIONS: SegmentedOption<ThemeModeOption>[] = [
  { label: "Auto", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

const themeNameById = (id: string): string =>
  DIFF_THEMES.find((theme) => theme.id === id)?.name ?? id;

type ThemeView = "root" | "light" | "dark";

// Theme picker with in-place drill-in navigation (root → light/dark theme
// lists with a back button) inside a single Popover, matching the reference UX.
const ThemePicker = ({
  diffThemes,
  onDiffThemesChange,
  themeMode,
  onModeChange,
}: {
  diffThemes: DiffThemeSelection;
  onDiffThemesChange: (themes: DiffThemeSelection) => void;
  themeMode: ThemeModeOption;
  onModeChange: (mode: ThemeModeOption) => void;
}) => {
  const [view, setView] = useState<ThemeView>("root");
  const isLight = view === "light";
  const themes = isLight ? LIGHT_THEMES : DARK_THEMES;
  const selectedId = isLight ? diffThemes.light : diffThemes.dark;

  return (
    <Popover
      // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
      onOpenChange={(open) => {
        if (!open) {
          setView("root");
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Theme"
            className="text-muted-foreground hover:text-foreground hover:bg-secondary"
          />
        }
      >
        <ContrastIcon size={14} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[260px]">
        {view === "root" ? (
          <>
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                Mode
              </span>
              <SegmentedControl
                ariaLabel="Color mode"
                value={themeMode}
                options={THEME_MODE_OPTIONS}
                onChange={onModeChange}
              />
            </div>
            <div className="-mx-1 my-1 h-px bg-border" />
            <button
              type="button"
              // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onClick={() => setView("light")}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
            >
              <SunIcon size={14} className="shrink-0 text-muted-foreground" />
              <span className="flex-1">
                <span className="block text-[11px] uppercase tracking-wide text-muted-foreground/70">
                  Light theme
                </span>
                <span className="block text-sm text-foreground">
                  {themeNameById(diffThemes.light)}
                </span>
              </span>
              <ChevronRightIcon size={14} className="shrink-0 text-muted-foreground" />
            </button>
            <button
              type="button"
              // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onClick={() => setView("dark")}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
            >
              <MoonIcon size={14} className="shrink-0 text-muted-foreground" />
              <span className="flex-1">
                <span className="block text-[11px] uppercase tracking-wide text-muted-foreground/70">
                  Dark theme
                </span>
                <span className="block text-sm text-foreground">
                  {themeNameById(diffThemes.dark)}
                </span>
              </span>
              <ChevronRightIcon size={14} className="shrink-0 text-muted-foreground" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onClick={() => setView("root")}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
            >
              <ChevronLeftIcon size={14} className="shrink-0 text-muted-foreground" />
              {isLight ? <SunIcon size={14} /> : <MoonIcon size={14} />}
              <span>{isLight ? "Light theme" : "Dark theme"}</span>
            </button>
            <div className="-mx-1 my-1 h-px bg-border" />
            <div className="max-h-[280px] overflow-y-auto">
              {themes.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onClick={() =>
                    onDiffThemesChange(
                      isLight
                        ? { ...diffThemes, light: entry.id }
                        : { ...diffThemes, dark: entry.id },
                    )
                  }
                >
                  <span className={cn("text-foreground", selectedId === entry.id && "font-medium")}>
                    {entry.name}
                  </span>
                  {selectedId === entry.id && (
                    <CheckIcon size={14} className="shrink-0 text-diff-green" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
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

// oxlint-disable-next-line complexity
export const StatusBar = ({
  branch,
  baseBranch,
  refreshing,
  onRefresh,
  watchStatus,
  syncNotice,
  comments,
  onClearComments,
  diffMode,
  onDiffModeChange,
  layout,
  onLayoutChange,
  displaySettings,
  onDisplaySettingsChange,
  diffThemes,
  onDiffThemesChange,
}: StatusBarProps) => {
  const [copied, setCopied] = useState(false);
  const [copiedBranch, setCopiedBranch] = useState<"branch" | "base" | null>(null);
  const mounted = useHasMounted();
  const { setTheme, theme } = useTheme();

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

  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const updateSetting = <K extends keyof DisplaySettings>(
    key: K,
    value: DisplaySettings[K],
  ): void => {
    onDisplaySettingsChange({ ...displaySettings, [key]: value });
  };

  const themeMode: ThemeModeOption = theme === "light" || theme === "dark" ? theme : "system";

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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary gap-1 group"
                />
              }
            >
              {diffMode === "uncommitted" ? "Uncommitted" : "All"}
              <ChevronDownIcon
                size={10}
                className="transition-transform duration-150 group-data-[popup-open]:rotate-180"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              <DropdownMenuRadioGroup
                value={diffMode}
                // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                onValueChange={(value) => onDiffModeChange(value as DiffMode)}
              >
                {DIFF_MODES.map(({ value, label }) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Comments export */}
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

          {/* Settings panel */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Display settings"
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                />
              }
            >
              <SettingsGear1Icon size={14} />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[260px]">
              <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                Display
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 text-sm">
                <span className="text-foreground">Backgrounds</span>
                <Switch
                  label="Toggle diff backgrounds"
                  checked={displaySettings.showBackgrounds}
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onChange={(next) => updateSetting("showBackgrounds", next)}
                />
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 text-sm">
                <span className="text-foreground">Line numbers</span>
                <Switch
                  label="Toggle line numbers"
                  checked={displaySettings.showLineNumbers}
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onChange={(next) => updateSetting("showLineNumbers", next)}
                />
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 text-sm">
                <span className="text-foreground">Word wrap</span>
                <Switch
                  label="Toggle word wrap"
                  checked={displaySettings.wordWrap}
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onChange={(next) => updateSetting("wordWrap", next)}
                />
              </div>
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                <span className="text-foreground">Indicators</span>
                <SegmentedControl
                  ariaLabel="Diff indicator style"
                  value={displaySettings.diffIndicators}
                  options={INDICATOR_OPTIONS}
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onChange={(next) => updateSetting("diffIndicators", next)}
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* Theme picker - only render after mount to avoid hydration mismatch */}
          {mounted && (
            <ThemePicker
              diffThemes={diffThemes}
              onDiffThemesChange={onDiffThemesChange}
              themeMode={themeMode}
              onModeChange={setTheme}
            />
          )}
        </div>
      </header>
    </TooltipProvider>
  );
};
