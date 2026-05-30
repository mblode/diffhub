"use client";

import {
  BarsThree2Icon,
  CheckIcon,
  ChevronDownIcon,
  CircleBanSignIcon,
  CircleHalfFillIcon,
  CodeLinesIcon,
  ColumnWideAddIcon,
  ColumnWideHalfIcon,
  CopySimpleIcon,
  SunIcon,
  MoonIcon,
  ArrowRightIcon,
  ArrowRotateClockwiseIcon,
  SettingsGear1Icon,
  ContrastIcon,
} from "blode-icons-react";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { useRef, useState, useSyncExternalStore } from "react";
import type { Comment } from "@/lib/comment-types";
import type { WatchStatus } from "@/lib/watch-status";
import { getWatchStatusMeta } from "@/lib/watch-status";
import type { DisplaySettings, DiffIndicatorStyle } from "@/lib/display-settings";
import type { DiffThemeSelection } from "@/lib/diff-themes";
import { DIFF_THEMES } from "@/lib/diff-themes";
import { exportCommentsAsPrompt } from "@/lib/export-comments";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type DiffMode = "all" | "uncommitted";
export type { WatchStatus };

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

const INDICATOR_OPTIONS: SegmentedOption<DiffIndicatorStyle>[] = [
  { icon: <BarsThree2Icon className="size-3" />, label: "Bars", value: "bars" },
  { icon: <CodeLinesIcon className="size-3" />, label: "Classic", value: "classic" },
  { icon: <CircleBanSignIcon className="size-3" />, label: "None", value: "none" },
];

const LIGHT_THEMES = DIFF_THEMES.filter((theme) => theme.type === "light");
const DARK_THEMES = DIFF_THEMES.filter((theme) => theme.type === "dark");

// ── Inline primitives (no Switch/ToggleGroup in components/ui) ───────────────

const Switch = ({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  id?: string;
}) => (
  <button
    type="button"
    id={id}
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
  icon?: ReactNode;
}

const SegmentedControl = <T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  iconOnly = false,
  fullWidth = false,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (next: T) => void;
  ariaLabel: string;
  iconOnly?: boolean;
  fullWidth?: boolean;
}) => (
  <div
    role="group"
    aria-label={ariaLabel}
    className={cn(
      "inline-flex items-center gap-0.5 rounded-md border border-border bg-secondary p-0.5",
      fullWidth && "flex w-full",
    )}
  >
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          type="button"
          key={option.value}
          title={iconOnly ? option.label : undefined}
          aria-label={iconOnly ? option.label : undefined}
          aria-pressed={active}
          // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
            iconOnly ? "size-7" : "gap-1.5 px-2.5 text-[11px] leading-none",
            fullWidth && "h-9 flex-1",
            active
              ? "border-border bg-background text-foreground shadow-xs"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {option.icon}
          {!iconOnly && option.label}
        </button>
      );
    })}
  </div>
);

type ThemeModeOption = "system" | "light" | "dark";
const THEME_MODE_OPTIONS: SegmentedOption<ThemeModeOption>[] = [
  { icon: <CircleHalfFillIcon className="size-4" />, label: "Auto", value: "system" },
  { icon: <SunIcon className="size-4" />, label: "Light", value: "light" },
  { icon: <MoonIcon className="size-4" />, label: "Dark", value: "dark" },
];

const themeNameById = (id: string): string =>
  DIFF_THEMES.find((theme) => theme.id === id)?.name ?? id;

// A per-mode syntax-theme picker rendered as a drill-in submenu: the trigger
// row shows the current selection; the submenu lists every theme of that type.
const ThemeSubmenu = ({
  icon,
  selectedId,
  themes,
  onSelect,
  className,
}: {
  icon: ReactNode;
  selectedId: string;
  themes: typeof DIFF_THEMES;
  onSelect: (id: string) => void;
  className?: string;
}) => (
  <DropdownMenuSub>
    <DropdownMenuSubTrigger className={cn("gap-2", className)}>
      {icon}
      <span className="min-w-0 flex-1 truncate text-foreground">{themeNameById(selectedId)}</span>
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent className="max-h-[280px] w-56">
      {themes.map((entry) => (
        <DropdownMenuItem
          key={entry.id}
          closeOnClick={false}
          className="justify-between"
          // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
          onClick={() => onSelect(entry.id)}
        >
          <span className={cn("truncate", selectedId === entry.id && "font-medium")}>
            {entry.name}
          </span>
          {selectedId === entry.id && <CheckIcon className="text-diff-green" />}
        </DropdownMenuItem>
      ))}
    </DropdownMenuSubContent>
  </DropdownMenuSub>
);

// Theme picker: color mode (Auto/Light/Dark) plus per-mode syntax-theme
// submenus, all inside a single DropdownMenu (matches the reference layout).
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
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
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
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-72 p-2">
      <div className="mb-1">
        <SegmentedControl
          ariaLabel="Color mode"
          value={themeMode}
          options={THEME_MODE_OPTIONS}
          onChange={onModeChange}
          fullWidth
        />
      </div>
      <ThemeSubmenu
        icon={<SunIcon className="size-4 shrink-0 text-muted-foreground" />}
        selectedId={diffThemes.light}
        themes={LIGHT_THEMES}
        // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onSelect={(id) => onDiffThemesChange({ ...diffThemes, light: id })}
      />
      <ThemeSubmenu
        icon={<MoonIcon className="size-4 shrink-0 text-muted-foreground" />}
        selectedId={diffThemes.dark}
        themes={DARK_THEMES}
        // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onSelect={(id) => onDiffThemesChange({ ...diffThemes, dark: id })}
      />
    </DropdownMenuContent>
  </DropdownMenu>
);

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

          {/* Layout toggle — unified / split */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Switch to unified view"
                  aria-pressed={layout === "stacked"}
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onClick={() => onLayoutChange("stacked")}
                  className={cn(
                    "text-muted-foreground hover:text-foreground hover:bg-secondary",
                    layout === "stacked" && "border border-border bg-secondary text-foreground",
                  )}
                />
              }
            >
              <ColumnWideAddIcon size={14} />
            </TooltipTrigger>
            <TooltipContent side="bottom">Switch to unified view (S)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Switch to split view"
                  aria-pressed={layout === "split"}
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onClick={() => onLayoutChange("split")}
                  className={cn(
                    "text-muted-foreground hover:text-foreground hover:bg-secondary",
                    layout === "split" && "border border-border bg-secondary text-foreground",
                  )}
                />
              }
            >
              <ColumnWideHalfIcon size={14} />
            </TooltipTrigger>
            <TooltipContent side="bottom">Switch to split view (S)</TooltipContent>
          </Tooltip>

          {/* Display settings panel */}
          <DropdownMenu>
            <DropdownMenuTrigger
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
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 space-y-px">
              <label
                htmlFor="diffhub-toggle-backgrounds"
                className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
              >
                <span className="min-w-0 flex-1 text-foreground">Backgrounds</span>
                <Switch
                  id="diffhub-toggle-backgrounds"
                  label="Toggle diff backgrounds"
                  checked={displaySettings.showBackgrounds}
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onChange={(next) => updateSetting("showBackgrounds", next)}
                />
              </label>
              <label
                htmlFor="diffhub-toggle-line-numbers"
                className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
              >
                <span className="min-w-0 flex-1 text-foreground">Line numbers</span>
                <Switch
                  id="diffhub-toggle-line-numbers"
                  label="Toggle line numbers"
                  checked={displaySettings.showLineNumbers}
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onChange={(next) => updateSetting("showLineNumbers", next)}
                />
              </label>
              <label
                htmlFor="diffhub-toggle-word-wrap"
                className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
              >
                <span className="min-w-0 flex-1 text-foreground">Word wrap</span>
                <Switch
                  id="diffhub-toggle-word-wrap"
                  label="Toggle word wrap"
                  checked={displaySettings.wordWrap}
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onChange={(next) => updateSetting("wordWrap", next)}
                />
              </label>
              <div className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 text-sm">
                <span className="text-foreground">Indicator style</span>
                <SegmentedControl
                  ariaLabel="Diff indicator style"
                  value={displaySettings.diffIndicators}
                  options={INDICATOR_OPTIONS}
                  iconOnly
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onChange={(next) => updateSetting("diffIndicators", next)}
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

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
