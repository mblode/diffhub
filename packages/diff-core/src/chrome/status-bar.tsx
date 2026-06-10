"use client";

import {
  BarsThree2Icon,
  CheckIcon,
  ChevronDownIcon,
  ChevronGrabberVerticalIcon,
  SquizedIcon,
  CircleBanSignIcon,
  CircleHalfFillIcon,
  CodeLinesIcon,
  LayoutColumnIcon,
  LayoutHalfIcon,
  CopySimpleIcon,
  SunIcon,
  MoonIcon,
  ArrowRightIcon,
  ArrowRotateClockwiseIcon,
  SettingsGear1Icon,
  ContrastIcon,
} from "blode-icons-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import type { DiffIndicatorStyle, DisplaySettings } from "../display/display-settings";
import type { DiffThemeSelection } from "../themes/diff-themes";
import { DIFF_THEMES } from "../themes/diff-themes";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { Kbd } from "../ui/kbd";
import { SidebarTrigger } from "../ui/sidebar";
import { Spinner } from "../ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
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
} from "../ui/dropdown-menu";

export type DiffMode = "all" | "committed" | "staged" | "unstaged" | "touched";
export type ThemeModeOption = "system" | "light" | "dark";

export interface StatusBarSyncNotice {
  detail?: string;
  label: string;
  tone: "neutral" | "warning" | "destructive";
}

// Ordered narrowest-base → widest. "All" and "Touched" include untracked files;
// the rest are tracked-only. See lib/git.ts `resolveDiff` for the git mappings.
const DIFF_MODES: { value: DiffMode; label: string; description: string }[] = [
  {
    description: "Everything since the base branch, plus untracked files",
    label: "All",
    value: "all",
  },
  {
    description: "Commits on this branch vs the base branch",
    label: "Committed",
    value: "committed",
  },
  { description: "Staged changes not yet committed", label: "Staged", value: "staged" },
  { description: "Unstaged changes to tracked files", label: "Unstaged", value: "unstaged" },
  { description: "All uncommitted work, plus untracked files", label: "Touched", value: "touched" },
];

const DIFF_MODE_LABELS: Record<DiffMode, string> = {
  all: "All",
  committed: "Committed",
  staged: "Staged",
  touched: "Touched",
  unstaged: "Unstaged",
};

const truncateMiddle = (str: string, maxLen = 24) => {
  if (str.length <= maxLen) {
    return str;
  }
  const half = Math.floor((maxLen - 1) / 2);
  return `${str.slice(0, half)}…${str.slice(-half)}`;
};

interface StatusBarProps {
  // Branch comparison badges (e.g. baseBranch ← branch). Hidden when omitted.
  branch?: string;
  baseBranch?: string;
  // Live status + force refresh. Hidden when onRefresh is omitted.
  refreshing?: boolean;
  onRefresh?: () => void;
  watch?: { label: string; dotClassName: string };
  syncNotice?: StatusBarSyncNotice | null;
  // Comment export. Hidden unless commentCount > 0 and onCopyComments is set.
  commentCount?: number;
  onCopyComments?: () => unknown;
  // Diff scope. Hidden when onDiffModeChange is omitted.
  diffMode?: DiffMode;
  onDiffModeChange?: (mode: DiffMode) => void;
  // View controls (always shown).
  layout: "split" | "stacked";
  onLayoutChange: (l: "split" | "stacked") => void;
  allCollapsed: boolean;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  displaySettings: DisplaySettings;
  onDisplaySettingsChange: (settings: DisplaySettings) => void;
  diffThemes: DiffThemeSelection;
  onDiffThemesChange: (themes: DiffThemeSelection) => void;
  // Color mode segmented control. Hidden when onThemeModeChange is omitted.
  themeMode?: ThemeModeOption;
  onThemeModeChange?: (mode: ThemeModeOption) => void;
  // Sidebar collapse toggle. Requires a SidebarProvider ancestor.
  showSidebarTrigger?: boolean;
  // Optional trailing link (e.g. "View on GitHub" for the live demo).
  githubUrl?: string;
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

const INDICATOR_OPTIONS: SegmentedOption<DiffIndicatorStyle>[] = [
  { icon: <BarsThree2Icon className="size-3" />, label: "Bars", value: "bars" },
  { icon: <CodeLinesIcon className="size-3" />, label: "Classic", value: "classic" },
  { icon: <CircleBanSignIcon className="size-3" />, label: "None", value: "none" },
];

const LIGHT_THEMES = DIFF_THEMES.filter((theme) => theme.type === "light");
const DARK_THEMES = DIFF_THEMES.filter((theme) => theme.type === "dark");

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

const THEME_MODE_OPTIONS: SegmentedOption<ThemeModeOption>[] = [
  { icon: <CircleHalfFillIcon className="size-4" />, label: "Auto", value: "system" },
  { icon: <SunIcon className="size-4" />, label: "Light", value: "light" },
  { icon: <MoonIcon className="size-4" />, label: "Dark", value: "dark" },
];

const themeNameById = (id: string): string =>
  DIFF_THEMES.find((theme) => theme.id === id)?.name ?? id;

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

const ThemePicker = ({
  diffThemes,
  onDiffThemesChange,
  themeMode,
  onModeChange,
}: {
  diffThemes: DiffThemeSelection;
  onDiffThemesChange: (themes: DiffThemeSelection) => void;
  themeMode?: ThemeModeOption;
  onModeChange?: (mode: ThemeModeOption) => void;
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
      {themeMode && onModeChange && (
        <div className="mb-1">
          <SegmentedControl
            ariaLabel="Color mode"
            value={themeMode}
            options={THEME_MODE_OPTIONS}
            onChange={onModeChange}
            fullWidth
          />
        </div>
      )}
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

const getSyncNoticeToneClass = (tone: StatusBarSyncNotice["tone"] | undefined) => {
  if (tone === "destructive") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  if (tone === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  return "border-border bg-muted/40 text-muted-foreground";
};

const SyncNoticeChip = ({ syncNotice }: { syncNotice: StatusBarSyncNotice | null | undefined }) => {
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

const BranchBadge = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={handleCopy}
            className="relative whitespace-nowrap rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs text-muted-foreground cursor-pointer hover:bg-secondary"
          />
        }
      >
        <span
          className={cn("transition-opacity duration-150", copied ? "opacity-0" : "opacity-100")}
        >
          {truncateMiddle(value)}
        </span>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center text-diff-green transition-opacity duration-150",
            copied ? "opacity-100" : "opacity-0",
          )}
        >
          <CheckIcon size={14} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{copied ? "Copied!" : "Click to copy"}</TooltipContent>
    </Tooltip>
  );
};

// oxlint-disable-next-line complexity
export const StatusBar = ({
  branch,
  baseBranch,
  refreshing = false,
  onRefresh,
  watch,
  syncNotice,
  commentCount = 0,
  onCopyComments,
  diffMode,
  onDiffModeChange,
  layout,
  onLayoutChange,
  allCollapsed,
  onCollapseAll,
  onExpandAll,
  displaySettings,
  onDisplaySettingsChange,
  diffThemes,
  onDiffThemesChange,
  themeMode,
  onThemeModeChange,
  showSidebarTrigger = true,
  githubUrl,
}: StatusBarProps) => {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const handleCopyComments = async () => {
    if (!onCopyComments) {
      return;
    }
    await onCopyComments();
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
    }
    setCopied(true);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const updateSetting = <K extends keyof DisplaySettings>(
    key: K,
    value: DisplaySettings[K],
  ): void => {
    onDisplaySettingsChange({ ...displaySettings, [key]: value });
  };

  const watchMeta = watch ?? { dotClassName: "bg-diff-green", label: "Live" };

  return (
    <TooltipProvider delay={400}>
      <header className="flex h-[52px] items-center gap-2 border-b border-border bg-card px-4 text-sm">
        {showSidebarTrigger && (
          <Tooltip>
            <TooltipTrigger render={<SidebarTrigger className="-ml-1" />} />
            <TooltipContent side="bottom" className="flex items-center gap-2">
              <span>Toggle sidebar</span>
              <Kbd>⌘B</Kbd>
            </TooltipContent>
          </Tooltip>
        )}

        {branch !== undefined && baseBranch !== undefined && (
          <div className="flex items-center gap-1.5">
            <BranchBadge value={baseBranch} />
            <ArrowRightIcon size={12} className="text-muted-foreground/50 shrink-0" />
            <BranchBadge value={branch} />
          </div>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
          <SyncNoticeChip syncNotice={syncNotice} />

          {onRefresh && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={onRefresh}
                    disabled={refreshing}
                    aria-label={`${watchMeta.label} — force refresh diff`}
                    className="group text-muted-foreground hover:text-foreground hover:bg-secondary"
                  />
                }
              >
                {refreshing ? (
                  <Spinner />
                ) : (
                  <>
                    <span
                      className={cn(
                        "size-2 rounded-full group-hover:hidden",
                        watchMeta.dotClassName,
                      )}
                    />
                    <ArrowRotateClockwiseIcon size={14} className="hidden group-hover:block" />
                  </>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom" className="flex items-center gap-2">
                <span>{watchMeta.label} · Force refresh</span>
                <Kbd>R</Kbd>
              </TooltipContent>
            </Tooltip>
          )}

          {onDiffModeChange && (
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
                {diffMode ? DIFF_MODE_LABELS[diffMode] : "All"}
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
                  {DIFF_MODES.map(({ value, label, description }) => (
                    <DropdownMenuRadioItem key={value} value={value}>
                      <span className="flex flex-col">
                        <span>{label}</span>
                        <span className="text-muted-foreground text-xs">{description}</span>
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {commentCount > 0 && onCopyComments && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={handleCopyComments}
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
                  : `Copy & clear ${commentCount} comment${commentCount === 1 ? "" : "s"}`}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Copy all comments as AI prompt, then clear them
              </TooltipContent>
            </Tooltip>
          )}

          <div className="mx-1 h-5 w-px bg-border" />

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={allCollapsed ? "Expand all files" : "Collapse all files"}
                  onClick={allCollapsed ? onExpandAll : onCollapseAll}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                />
              }
            >
              {allCollapsed ? (
                <ChevronGrabberVerticalIcon size={14} />
              ) : (
                <SquizedIcon size={14} className="rotate-90" />
              )}
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-2">
              <span>{allCollapsed ? "Expand all files" : "Collapse all files"}</span>
              <Kbd>{allCollapsed ? "⇧E" : "⇧C"}</Kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={
                    layout === "split" ? "Switch to unified view" : "Switch to split view"
                  }
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onClick={() => onLayoutChange(layout === "split" ? "stacked" : "split")}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                />
              }
            >
              {layout === "split" ? <LayoutHalfIcon size={14} /> : <LayoutColumnIcon size={14} />}
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {layout === "split" ? "Switch to unified view (S)" : "Switch to split view (S)"}
            </TooltipContent>
          </Tooltip>

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

          <ThemePicker
            diffThemes={diffThemes}
            onDiffThemesChange={onDiffThemesChange}
            themeMode={themeMode}
            onModeChange={onThemeModeChange}
          />

          {githubUrl && (
            <a
              className="ml-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              href={githubUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub
            </a>
          )}
        </div>
      </header>
    </TooltipProvider>
  );
};
