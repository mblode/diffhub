// React entry point: the worker pool provider, streaming hook, the read-only
// CodeView wrapper, and the shared diff-viewer chrome (status bar, file list,
// per-file header) used by both the CLI viewer and the diffhub.blode.co demo.

export { DiffsWorkerProvider } from "./worker/DiffsWorkerProvider";
export { useIsWorkerPoolReady } from "./worker/use-worker-pool-ready";
export { usePatchLoader } from "./stream/use-patch-loader";
export type { PatchLoadState } from "./stream/use-patch-loader";
export { ReadOnlyDiffView } from "./viewer/ReadOnlyDiffView";
export { useCodeViewPaintNudge } from "./viewer/use-paint-nudge";
export type { DiffHeaderInfo, ReadOnlyDiffViewHandle, ViewerFile } from "./viewer/ReadOnlyDiffView";

// Chrome shared verbatim between apps/cli and apps/web.
export { FileDiffHeader } from "./chrome/file-diff-header";
export { FileList } from "./chrome/file-list";
export { StatusBar } from "./chrome/status-bar";
export type { DiffMode, StatusBarSyncNotice, ThemeModeOption } from "./chrome/status-bar";

// Sidebar shell + context (FileList renders inside a SidebarProvider).
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "./ui/sidebar";

export type { DiffFileStat } from "./lib/diff-file-stat";
export { isLargeDiffFile } from "./lib/diff-file-stat";
