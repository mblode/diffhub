import type { CodeViewLayout } from "@pierre/diffs";

export const CODE_VIEW_LAYOUT: CodeViewLayout = {
  gap: 1,
  paddingBottom: 0,
  paddingTop: 0,
};

export const CODE_VIEW_FILE_TREE_ITEM_HEIGHT = 24;
export const CODE_VIEW_BATCH_COUNT = 25;
export const CODE_VIEW_BATCH_COUNT_MAX = 96;

// Streaming publish cadence used by the patch loader (built in a later phase).
export const STREAM_PUBLISH_INTERVAL_MS = 100;
export const STREAM_INITIAL_PUBLISH_INTERVAL_MS = 500;
export const STREAM_WORK_BUDGET_MS = 8;

const getViewportHeight = (): number | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  return Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : null;
};

export const getInitialBatchSize = (): number => {
  const viewportHeight = getViewportHeight();
  if (viewportHeight === null) {
    return CODE_VIEW_BATCH_COUNT;
  }

  return Math.min(
    CODE_VIEW_BATCH_COUNT_MAX,
    Math.max(CODE_VIEW_BATCH_COUNT, Math.ceil(viewportHeight / CODE_VIEW_FILE_TREE_ITEM_HEIGHT)),
  );
};
