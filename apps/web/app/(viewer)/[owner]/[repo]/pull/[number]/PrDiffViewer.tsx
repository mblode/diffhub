"use client";

import {
  DEFAULT_DIFF_THEMES,
  DEFAULT_DISPLAY_SETTINGS,
  normalizeDiffThemes,
  normalizeDisplaySettings,
} from "@diffhub/diff-core";
import type { DiffThemeSelection, DisplaySettings } from "@diffhub/diff-core";
import {
  FileDiffHeader,
  FileList,
  ReadOnlyDiffView,
  SidebarInset,
  SidebarProvider,
  StatusBar,
} from "@diffhub/diff-core/react";
import type {
  DiffFileStat,
  DiffHeaderInfo,
  ReadOnlyDiffViewHandle,
  ViewerFile,
} from "@diffhub/diff-core/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LAYOUT_KEY = "diffhub-demo-layout";
const THEME_KEY = "diffhub-diff-theme";
const DISPLAY_KEY = "diffhub-display-settings";
const COLOR_MODE_KEY = "diffhub-color-mode";

type Layout = "split" | "unified";
type ColorMode = "system" | "light" | "dark";

const normalizeColorMode = (value: unknown): ColorMode =>
  value === "light" || value === "system" ? value : "dark";

const readStored = <T,>(key: string, normalize: (value: unknown) => T, fallback: T): T => {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : normalize(JSON.parse(raw));
  } catch {
    return fallback;
  }
};

const usePersisted = <T,>(
  key: string,
  normalize: (value: unknown) => T,
  fallback: T,
): [T, (next: T) => void] => {
  const [value, setValue] = useState<T>(() => readStored(key, normalize, fallback));
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignore quota / privacy-mode errors
      }
    },
    [key],
  );
  return [value, set];
};

const normalizeLayout = (value: unknown): Layout => (value === "split" ? "split" : "unified");

interface PrDiffViewerProps {
  owner: string;
  repo: string;
  number: string;
  prUrl: string;
  baseRef: string;
  headRef: string;
}

export const PrDiffViewer = ({
  owner,
  repo,
  number,
  prUrl,
  baseRef,
  headRef,
}: PrDiffViewerProps): React.JSX.Element => {
  const [layout, setLayout] = usePersisted<Layout>(LAYOUT_KEY, normalizeLayout, "unified");
  const [themes, setThemes] = usePersisted<DiffThemeSelection>(
    THEME_KEY,
    normalizeDiffThemes,
    DEFAULT_DIFF_THEMES,
  );
  const [display, setDisplay] = usePersisted<DisplaySettings>(
    DISPLAY_KEY,
    normalizeDisplaySettings,
    DEFAULT_DISPLAY_SETTINGS,
  );

  const [colorMode, setColorMode] = usePersisted<ColorMode>(
    COLOR_MODE_KEY,
    normalizeColorMode,
    "dark",
  );
  const [files, setFiles] = useState<ViewerFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [statsOpen, setStatsOpen] = useState(true);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [systemDark, setSystemDark] = useState(true);
  const viewerRef = useRef<ReadOnlyDiffViewHandle>(null);

  // Resolve Auto/Light/Dark to an effective mode, mirroring the CLI's behavior.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const isDark = colorMode === "dark" || (colorMode === "system" && systemDark);

  // Scope the palette at the document level too, so base-ui's portaled popups
  // (theme/settings dropdowns, tooltips) inherit it instead of the light
  // marketing tokens.
  useEffect(() => {
    document.documentElement.classList.add("diffhub-app");
    return () => document.documentElement.classList.remove("diffhub-app", "diffhub-light");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("diffhub-light", !isDark);
  }, [isDark]);

  const endpoint = useMemo(
    () =>
      `/api/github-diff?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(
        repo,
      )}&number=${encodeURIComponent(number)}`,
    [owner, repo, number],
  );
  const reloadKey = `${owner}/${repo}/${number}`;

  const scrollToFile = useCallback((id: string) => {
    setActiveFile(id);
    viewerRef.current?.scrollToFile(id);
  }, []);
  const collapseAll = useCallback(() => viewerRef.current?.collapseAll(), []);
  const expandAll = useCallback(() => viewerRef.current?.expandAll(), []);

  // The StatusBar speaks "split" | "stacked" (CLI vocabulary); the viewer speaks
  // "split" | "unified". Translate between the two.
  const statusBarLayout = layout === "unified" ? "stacked" : "split";
  const handleLayoutChange = useCallback(
    (next: "split" | "stacked") => setLayout(next === "split" ? "split" : "unified"),
    [setLayout],
  );

  const renderHeader = useCallback(
    (info: DiffHeaderInfo) => (
      <FileDiffHeader
        active={info.active}
        collapsed={info.collapsed}
        deletions={info.deletions}
        file={info.file}
        insertions={info.insertions}
        // oxlint-disable-next-line react/jsx-handler-names -- DiffHeaderInfo exposes the toggle as `onToggle`
        onToggleCollapse={info.onToggle}
      />
    ),
    [],
  );

  // j / k move through files and scroll the diff to the target.
  const filesRef = useRef(files);
  filesRef.current = files;
  const activeRef = useRef(activeFile);
  activeRef.current = activeFile;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "j" && event.key !== "k") {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        return;
      }
      const list = filesRef.current;
      if (list.length === 0) {
        return;
      }
      event.preventDefault();
      const currentIndex = list.findIndex((file) => file.id === activeRef.current);
      const delta = event.key === "j" ? 1 : -1;
      const nextIndex = Math.min(
        list.length - 1,
        Math.max(0, (currentIndex === -1 ? 0 : currentIndex) + delta),
      );
      scrollToFile(list[nextIndex].id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scrollToFile]);

  const totals = useMemo(() => {
    let insertionsSum = 0;
    let deletionsSum = 0;
    for (const file of files) {
      insertionsSum += file.insertions;
      deletionsSum += file.deletions;
    }
    return { deletions: deletionsSum, insertions: insertionsSum };
  }, [files]);

  // The shared FileList renders a `@pierre/trees` tree from DiffFileStat records.
  const fileStats = useMemo<DiffFileStat[]>(
    () =>
      files.map((file) => ({
        binary: false,
        changes: file.insertions + file.deletions,
        deletions: file.deletions,
        file: file.path,
        insertions: file.insertions,
      })),
    [files],
  );

  return (
    <SidebarProvider
      className={`min-h-svh diffhub-app ${isDark ? "" : "diffhub-light"}`}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      <FileList
        deletions={totals.deletions}
        files={fileStats}
        filterQuery={filterQuery}
        insertions={totals.insertions}
        onFilterChange={setFilterQuery}
        onSelectFile={scrollToFile}
        onSidebarWidthChange={setSidebarWidth}
        onStatsOpenChange={setStatsOpen}
        selectedFile={activeFile}
        sidebarWidth={sidebarWidth}
        statsOpen={statsOpen}
      />

      <SidebarInset className="flex h-svh flex-col overflow-hidden">
        <div className="sticky top-0 z-20">
          <StatusBar
            allCollapsed={allCollapsed}
            baseBranch={baseRef}
            branch={headRef}
            diffThemes={themes}
            displaySettings={display}
            githubUrl={prUrl}
            layout={statusBarLayout}
            onCollapseAll={collapseAll}
            onDiffThemesChange={setThemes}
            onDisplaySettingsChange={setDisplay}
            onExpandAll={expandAll}
            onLayoutChange={handleLayoutChange}
            onThemeModeChange={setColorMode}
            themeMode={colorMode}
          />
        </div>

        <ReadOnlyDiffView
          activeFileId={activeFile}
          diffIndicators={display.diffIndicators}
          diffThemes={themes}
          endpoint={endpoint}
          layout={layout}
          onActiveFileChange={setActiveFile}
          onAllCollapsedChange={setAllCollapsed}
          onFilesChange={setFiles}
          ref={viewerRef}
          reloadKey={reloadKey}
          renderHeader={renderHeader}
          showBackgrounds={display.showBackgrounds}
          showLineNumbers={display.showLineNumbers}
          themeType={isDark ? "dark" : "light"}
          wordWrap={display.wordWrap}
        />
      </SidebarInset>
    </SidebarProvider>
  );
};
