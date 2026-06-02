"use client";

import dynamic from "next/dynamic";
import {
  Component,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ErrorInfo, ReactNode } from "react";
import type {
  CodeViewDiffItem,
  CodeViewItem,
  CodeViewOptions,
  FileDiffMetadata,
} from "@pierre/diffs";
import type { CodeViewHandle } from "@pierre/diffs/react";
import { useWorkerPool } from "@pierre/diffs/react";
import { CODE_VIEW_LAYOUT } from "../stream/constants";
import type { DiffStats } from "../stream/diffItemAccumulator";
import { usePatchLoader } from "../stream/use-patch-loader";
import type { DiffThemeSelection } from "../themes/diff-themes";
import { DEFAULT_DIFF_THEMES } from "../themes/diff-themes";
import { useIsWorkerPoolReady } from "../worker/use-worker-pool-ready";
import { useCodeViewPaintNudge } from "./use-paint-nudge";

// Lines longer than this skip syntax tokenization (rendered as plain text) so a
// single minified/generated line can't block the highlighter. Kept in sync with
// the worker-pool init in DiffsWorkerProvider.
const LONG_LINE_TOKENIZE_LIMIT = 5000;

export interface ViewerFile {
  id: string;
  path: string;
  oldPath?: string;
  insertions: number;
  deletions: number;
  status: FileDiffMetadata["type"];
}

export interface DiffHeaderInfo {
  file: string;
  path: string;
  insertions: number;
  deletions: number;
  status: FileDiffMetadata["type"];
  collapsed: boolean;
  active: boolean;
  onToggle: () => void;
}

export interface ReadOnlyDiffViewHandle {
  scrollToFile: (file: string) => void;
  collapseAll: () => void;
  expandAll: () => void;
}

// Minimal view of the CodeView instance handed to the onScroll listener, used to
// resolve the active file from the viewer's own scroll coordinates.
interface ActiveFileViewer {
  getRenderedItems?: () => { id: string }[];
  getTopForItem: (id: string) => number | undefined;
  getScrollTop: () => number;
}

interface ReadOnlyDiffViewProps {
  // Full endpoint (path + query) that returns the raw unified patch (text/plain).
  endpoint: string;
  // Bump to force a fresh stream.
  reloadKey: string;
  layout: "split" | "unified";
  showLineNumbers?: boolean;
  wordWrap?: boolean;
  showBackgrounds?: boolean;
  diffIndicators?: "classic" | "bars" | "none";
  diffThemes?: DiffThemeSelection;
  themeType?: "light" | "dark";
  activeFileId?: string | null;
  onActiveFileChange?: (file: string) => void;
  onFilesChange?: (files: ViewerFile[]) => void;
  onDiffStats?: (stats: DiffStats) => void;
  onAllCollapsedChange?: (allCollapsed: boolean) => void;
  // Custom per-file header; falls back to a minimal built-in header.
  renderHeader?: (info: DiffHeaderInfo) => ReactNode;
  // Rendered when the patch is empty (no files changed).
  emptyState?: ReactNode;
  // Rendered while the worker pool warms up / the first batch streams in.
  loadingState?: ReactNode;
}

const fileStats = (fileDiff: FileDiffMetadata): { insertions: number; deletions: number } => {
  let insertions = 0;
  let deletions = 0;
  for (const hunk of fileDiff.hunks) {
    insertions += hunk.additionLines;
    deletions += hunk.deletionLines;
  }
  return { deletions, insertions };
};

const toViewerFile = (item: CodeViewDiffItem<undefined>): ViewerFile => {
  const { fileDiff } = item;
  const { insertions, deletions } = fileStats(fileDiff);
  return {
    deletions,
    id: item.id,
    insertions,
    oldPath: fileDiff.prevName,
    path: fileDiff.name,
    status: fileDiff.type,
  };
};

class DiffErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[diffhub] CodeView threw", {
      componentStack: info.componentStack,
      error: error.message,
      previousError: this.state.error?.message,
    });
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="px-4 py-6 text-sm text-red-600">
          Failed to render diff: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

/* oxlint-disable promise/prefer-await-to-then */
const CodeView = dynamic(
  () => import("@pierre/diffs/react").then((m) => ({ default: m.CodeView })),
  { ssr: false },
) as unknown as (props: {
  key?: React.Key;
  ref?: React.Ref<CodeViewHandle<undefined>>;
  initialItems?: readonly CodeViewItem<undefined>[];
  options?: CodeViewOptions<undefined>;
  className?: string;
  containerRef?: React.Ref<HTMLDivElement>;
  onScroll?: (scrollTop: number, viewer: unknown) => void;
  renderCustomHeader?: (item: CodeViewItem<undefined>) => ReactNode;
}) => React.JSX.Element;
/* oxlint-enable promise/prefer-await-to-then */

const DefaultHeader = ({ path, insertions, deletions, collapsed, onToggle }: DiffHeaderInfo) => {
  const slash = path.lastIndexOf("/");
  const dir = slash === -1 ? "" : path.slice(0, slash + 1);
  const name = slash === -1 ? path : path.slice(slash + 1);
  return (
    <button
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/60"
      // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop -- react-compiler memoizes this handler
      onClick={onToggle}
      type="button"
    >
      <svg
        aria-hidden="true"
        className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${collapsed ? "-rotate-90" : ""}`}
        fill="none"
        height="14"
        viewBox="0 0 24 24"
        width="14"
      >
        <path
          d="m6 9 6 6 6-6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      <span className="truncate font-mono text-xs">
        {dir && <span className="text-muted-foreground">{dir}</span>}
        <span className="text-foreground">{name}</span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-xs tabular-nums">
        {insertions > 0 && <span className="text-green-600">+{insertions}</span>}
        {deletions > 0 && <span className="text-red-600">-{deletions}</span>}
      </span>
    </button>
  );
};

const DefaultEmpty = () => (
  <div className="flex h-full items-center justify-center p-10 text-sm text-muted-foreground">
    No file changes in this diff.
  </div>
);

const DefaultLoading = () => (
  <div className="flex h-full items-center justify-center p-10 text-sm text-muted-foreground">
    Loading diff…
  </div>
);

// oxlint-disable-next-line complexity -- streaming + collapse + nudge + theme wiring in one view
const ReadOnlyDiffViewInner = (
  {
    endpoint,
    reloadKey,
    layout,
    showLineNumbers = true,
    wordWrap = true,
    showBackgrounds = true,
    diffIndicators = "bars",
    diffThemes = DEFAULT_DIFF_THEMES,
    themeType = "light",
    activeFileId = null,
    onActiveFileChange,
    onFilesChange,
    onDiffStats,
    onAllCollapsedChange,
    renderHeader,
    emptyState,
    loadingState,
  }: ReadOnlyDiffViewProps,
  ref: React.Ref<ReadOnlyDiffViewHandle>,
) => {
  const workerPool = useWorkerPool();
  const isWorkerReady = useIsWorkerPoolReady();
  const workerPoolRef = useRef(workerPool);
  workerPoolRef.current = workerPool;

  const codeViewRef = useRef<CodeViewHandle<undefined> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Files collected as they stream in, reported to the parent for the sidebar.
  const filesRef = useRef<ViewerFile[]>([]);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => new Set());
  const collapsedFilesRef = useRef(collapsedFiles);
  collapsedFilesRef.current = collapsedFiles;
  const loadedItemIdsRef = useRef<Set<string>>(new Set());

  const onFilesChangeRef = useRef(onFilesChange);
  onFilesChangeRef.current = onFilesChange;
  const onActiveFileChangeRef = useRef(onActiveFileChange);
  onActiveFileChangeRef.current = onActiveFileChange;
  const onAllCollapsedChangeRef = useRef(onAllCollapsedChange);
  onAllCollapsedChangeRef.current = onAllCollapsedChange;

  const prepareItems = useCallback((items: CodeViewDiffItem<undefined>[]): void => {
    const collapsed = collapsedFilesRef.current;
    for (const item of items) {
      loadedItemIdsRef.current.add(item.id);
      item.collapsed = collapsed.has(item.id);
      filesRef.current.push(toViewerFile(item));
    }
    onFilesChangeRef.current?.([...filesRef.current]);
  }, []);

  const handleReset = useCallback(() => {
    filesRef.current = [];
    loadedItemIdsRef.current = new Set();
    onFilesChangeRef.current?.([]);
  }, []);

  const { initialItems, loadState, errorMessage, diffStats, viewerKey, retry } =
    usePatchLoader<undefined>({
      endpoint,
      onReset: handleReset,
      prepareItems,
      reloadKey,
      viewerRef: codeViewRef,
    });

  const onDiffStatsRef = useRef(onDiffStats);
  onDiffStatsRef.current = onDiffStats;
  useLayoutEffect(() => {
    if (diffStats) {
      onDiffStatsRef.current?.(diffStats);
    }
  }, [diffStats]);

  // Push theme changes into the worker pool so background tokenizers reload the
  // active theme pair (they keep their init theme otherwise).
  useLayoutEffect(() => {
    if (workerPool === undefined) {
      return;
    }
    void workerPool.setRenderOptions({ theme: { dark: diffThemes.dark, light: diffThemes.light } });
  }, [workerPool, diffThemes.dark, diffThemes.light]);

  // Reconcile collapse state imperatively (header chevron + collapse-all driven).
  useLayoutEffect(() => {
    const viewer = codeViewRef.current;
    if (!viewer) {
      return;
    }
    for (const id of loadedItemIdsRef.current) {
      const item = viewer.getItem(id);
      if (!item || item.type !== "diff") {
        continue;
      }
      const shouldCollapse = collapsedFiles.has(id);
      if ((item.collapsed ?? false) === shouldCollapse) {
        continue;
      }
      item.collapsed = shouldCollapse;
      item.version = (item.version ?? 0) + 1;
      viewer.updateItem(item);
    }
    const count = loadedItemIdsRef.current.size;
    onAllCollapsedChangeRef.current?.(count > 0 && collapsedFiles.size >= count);
  }, [collapsedFiles]);

  const toggleCollapse = useCallback((file: string) => {
    setCollapsedFiles((previous) => {
      const next = new Set(previous);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      collapseAll: () => setCollapsedFiles(new Set(loadedItemIdsRef.current)),
      expandAll: () => setCollapsedFiles(new Set()),
      scrollToFile: (file: string) => {
        const item = codeViewRef.current?.getItem(file);
        const pool = workerPoolRef.current;
        if (pool && item?.type === "diff") {
          pool.primeDiffHighlightCache(item.fileDiff);
        }
        codeViewRef.current?.scrollTo({ align: "start", id: file, type: "item" });
      },
    }),
    [],
  );

  // Force CodeView's first window to paint (Chrome can skip compositing the
  // freshly-mounted shadow-DOM grid until something forces a repaint).
  const hasInitialContent = isWorkerReady && (loadState === "ready" || initialItems.length > 0);
  useCodeViewPaintNudge(rootRef, hasInitialContent, viewerKey);

  // Active-file tracking: find the file section that contains the top of the
  // viewport (rAF-debounced). `getRenderedItems()` carries no geometry and lists
  // the file scrolled partially above the viewport first, so use the viewer's own
  // coordinates — the active file is the item with the greatest content-top still
  // at/above the scroll position (the section the viewport top sits inside).
  const activeFileRafRef = useRef(0);
  const pendingViewerRef = useRef<ActiveFileViewer | null>(null);
  const handleScroll = useCallback((_scrollTop: number, viewer: unknown) => {
    pendingViewerRef.current = viewer as ActiveFileViewer | null;
    if (activeFileRafRef.current !== 0) {
      return;
    }
    activeFileRafRef.current = requestAnimationFrame(() => {
      activeFileRafRef.current = 0;
      const instance = pendingViewerRef.current;
      pendingViewerRef.current = null;
      const rendered = instance?.getRenderedItems?.();
      if (!instance || !rendered || rendered.length === 0) {
        return;
      }
      // `+ 1` px absorbs sub-pixel landing when scrollTo() snaps a file to the top.
      const reference = instance.getScrollTop() + 1;
      let activeId: string | null = null;
      let activeTop = Number.NEGATIVE_INFINITY;
      for (const { id } of rendered) {
        const top = instance.getTopForItem(id);
        if (top !== undefined && top <= reference && top > activeTop) {
          activeTop = top;
          activeId = id;
        }
      }
      onActiveFileChangeRef.current?.(activeId ?? rendered[0].id);
    });
  }, []);

  const options = useMemo<CodeViewOptions<undefined>>(
    () => ({
      diffIndicators,
      diffStyle: layout === "split" ? "split" : "unified",
      disableBackground: !showBackgrounds,
      // Must stay false: providing `renderCustomHeader` switches the header into
      // "custom" mode, but the header host is only created when the file header
      // is not disabled. Setting this true renders no headers at all.
      disableFileHeader: false,
      disableLineNumbers: !showLineNumbers,
      expandUnchanged: true,
      expansionLineCount: 100,
      hunkSeparators: "line-info",
      layout: CODE_VIEW_LAYOUT,
      lineDiffType: "word-alt",
      lineHoverHighlight: "number",
      maxLineDiffLength: 500,
      overflow: wordWrap ? "wrap" : "scroll",
      stickyHeaders: true,
      theme: { dark: diffThemes.dark, light: diffThemes.light },
      themeType,
      tokenizeMaxLineLength: LONG_LINE_TOKENIZE_LIMIT,
    }),
    [
      diffIndicators,
      layout,
      showBackgrounds,
      showLineNumbers,
      wordWrap,
      themeType,
      diffThemes.dark,
      diffThemes.light,
    ],
  );

  const activeFileRef = useRef(activeFileId);
  activeFileRef.current = activeFileId;
  const renderHeaderRef = useRef(renderHeader);
  renderHeaderRef.current = renderHeader;
  const renderCustomHeader = useCallback(
    (item: CodeViewItem<undefined>) => {
      if (item.type !== "diff") {
        return null;
      }
      const file = item.id;
      const { insertions, deletions } = fileStats(item.fileDiff);
      const info: DiffHeaderInfo = {
        active: activeFileRef.current === file,
        collapsed: item.collapsed ?? false,
        deletions,
        file,
        insertions,
        onToggle: () => toggleCollapse(file),
        path: item.fileDiff.name,
        status: item.fileDiff.type,
      };
      return (renderHeaderRef.current ?? DefaultHeader)(info);
    },
    [toggleCollapse],
  );

  if (loadState === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-red-600">{errorMessage ?? "Failed to load the diff."}</p>
        <button
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
          onClick={retry}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  const hasContent = loadState === "ready" || initialItems.length > 0;
  if (!isWorkerReady || !hasContent) {
    if (loadState === "ready" && initialItems.length === 0) {
      return emptyState ?? <DefaultEmpty />;
    }
    return loadingState ?? <DefaultLoading />;
  }

  if (loadState === "ready" && initialItems.length === 0) {
    return emptyState ?? <DefaultEmpty />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" ref={rootRef}>
      <DiffErrorBoundary>
        <CodeView
          className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-clip overscroll-contain [overflow-anchor:none]"
          containerRef={containerRef}
          initialItems={initialItems}
          key={viewerKey}
          onScroll={handleScroll}
          options={options}
          ref={codeViewRef}
          renderCustomHeader={renderCustomHeader}
        />
      </DiffErrorBoundary>
    </div>
  );
};

export const ReadOnlyDiffView = forwardRef<ReadOnlyDiffViewHandle, ReadOnlyDiffViewProps>(
  ReadOnlyDiffViewInner,
);
