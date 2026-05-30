"use client";

import type { CodeViewDiffItem } from "@pierre/diffs";
import { processFile } from "@pierre/diffs";
import type { CodeViewHandle } from "@pierre/diffs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  CODE_VIEW_BATCH_COUNT,
  getInitialBatchSize,
  STREAM_INITIAL_PUBLISH_INTERVAL_MS,
  STREAM_PUBLISH_INTERVAL_MS,
  STREAM_WORK_BUDGET_MS,
} from "@/lib/diff-stream/constants";
import type { DiffStats } from "@/lib/diff-stream/diffItemAccumulator";
import {
  appendFileDiffToAccumulator,
  buildDiffItems,
  createDiffItemAccumulator,
  takePendingItems,
} from "@/lib/diff-stream/diffItemAccumulator";
import { streamGitPatchFiles } from "@/lib/diff-stream/streamGitPatchFiles";

export type PatchLoadState = "idle" | "streaming" | "parsing" | "ready" | "error";

const GENERIC_PATCH_LOAD_ERROR = "Failed to load the diff. Try refreshing.";

interface UsePatchLoaderOptions<T> {
  // Bump to force a fresh load (mode change, manual refresh, watcher change).
  reloadKey: string;
  // Query string appended to /api/diff (e.g. "?mode=uncommitted").
  diffQuery: string;
  viewerRef: RefObject<CodeViewHandle<T> | null>;
  // Stamp collapse state + annotations onto freshly built items, and record
  // their ids, before they are handed to the viewer. Mutates in place.
  prepareItems: (items: CodeViewDiffItem<T>[]) => void;
  // Clear per-request tracking (loaded ids, annotation bookkeeping).
  onReset: () => void;
}

interface UsePatchLoaderResult<T> {
  initialItems: CodeViewDiffItem<T>[];
  loadState: PatchLoadState;
  errorMessage: string | null;
  diffStats: DiffStats | null;
  // Bumps every load; key the <CodeView> with it so a re-stream remounts clean.
  viewerKey: number;
  retry: () => void;
}

const yieldToBrowser = (): Promise<void> =>
  // oxlint-disable-next-line promise/avoid-new -- a microtask gate is intrinsically a new Promise
  new Promise((resolve) => {
    const timeout = globalThis.setTimeout(() => resolve(), 50);
    globalThis.requestAnimationFrame(() => {
      globalThis.clearTimeout(timeout);
      resolve();
    });
  });

export const usePatchLoader = <T>({
  reloadKey,
  diffQuery,
  viewerRef,
  prepareItems,
  onReset,
}: UsePatchLoaderOptions<T>): UsePatchLoaderResult<T> => {
  const [initialItems, setInitialItems] = useState<CodeViewDiffItem<T>[]>([]);
  const [loadState, setLoadState] = useState<PatchLoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diffStats, setDiffStats] = useState<DiffStats | null>(null);
  const [viewerKey, setViewerKey] = useState(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const requestIdRef = useRef(0);

  // Keep the latest callbacks/query in refs so the streaming closure can read
  // live values without re-binding the load effect on every render.
  const prepareItemsRef = useRef(prepareItems);
  prepareItemsRef.current = prepareItems;
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;
  const diffQueryRef = useRef(diffQuery);
  diffQueryRef.current = diffQuery;

  const retry = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  // oxlint-disable-next-line exhaustive-deps -- viewerRef is a stable ref object
  useEffect(() => {
    const controller = new AbortController();
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const cacheKeyPrefix = encodeURIComponent(reloadKey);
    const isCurrent = (): boolean =>
      requestIdRef.current === requestId && !controller.signal.aborted;

    onResetRef.current();
    setViewerKey(requestId);
    setInitialItems([]);
    setDiffStats(null);
    setErrorMessage(null);
    setLoadState("streaming");

    const publishFull = (items: CodeViewDiffItem<T>[]): void => {
      prepareItemsRef.current(items);
      setInitialItems(items);
    };

    const loadPatch = async (): Promise<void> => {
      const accumulator = createDiffItemAccumulator<T>();
      let hasPublishedInitial = false;
      let pendingCount = 0;
      let lastPublishTime = performance.now();
      let lastWorkYieldTime = lastPublishTime;
      const initialBatchSize = getInitialBatchSize();

      const publishPending = async (): Promise<void> => {
        if (pendingCount === 0 || !isCurrent()) {
          return;
        }
        pendingCount = 0;
        lastPublishTime = performance.now();
        const pendingItems = takePendingItems(accumulator);
        prepareItemsRef.current(pendingItems);
        if (hasPublishedInitial) {
          const viewer = viewerRef.current;
          if (viewer === null) {
            setInitialItems((previous) => [...previous, ...pendingItems]);
          } else {
            viewer.addItems(pendingItems);
          }
        } else {
          hasPublishedInitial = true;
          setInitialItems([...accumulator.items]);
        }
        await yieldToBrowser();
        lastWorkYieldTime = performance.now();
      };

      const publishPendingIfNeeded = async (): Promise<void> => {
        if (pendingCount === 0) {
          return;
        }
        const elapsed = performance.now() - lastPublishTime;
        const batchSize = hasPublishedInitial ? CODE_VIEW_BATCH_COUNT : initialBatchSize;
        const interval = hasPublishedInitial
          ? STREAM_PUBLISH_INTERVAL_MS
          : STREAM_INITIAL_PUBLISH_INTERVAL_MS;
        if (pendingCount < batchSize && elapsed < interval) {
          return;
        }
        await publishPending();
      };

      const appendFile = async (fileText: string): Promise<void> => {
        const cacheKey = `${cacheKeyPrefix}-0-${accumulator.items.length}`;
        const fileDiff = processFile(fileText, { cacheKey, isGitDiff: true });
        if (fileDiff === undefined) {
          return;
        }
        appendFileDiffToAccumulator(accumulator, fileDiff);
        pendingCount += 1;
        await (performance.now() - lastWorkYieldTime >= STREAM_WORK_BUDGET_MS
          ? publishPending()
          : publishPendingIfNeeded());
      };

      try {
        const response = await fetch(`/api/diff${diffQueryRef.current}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          const detail = errorText.trim();
          throw new Error(detail.length > 0 ? detail : `Request failed (${response.status}).`);
        }

        if (response.body === null) {
          // No streaming body — parse the full patch in one pass.
          setLoadState("parsing");
          const patchContent = await response.text();
          if (!isCurrent()) {
            return;
          }
          const built = buildDiffItems<T>(patchContent, reloadKey);
          if (!isCurrent()) {
            return;
          }
          publishFull(built.items);
          setDiffStats(built.diffStats);
          setLoadState("ready");
          return;
        }

        const fallbackPatch = await streamGitPatchFiles(response.body, appendFile);
        if (!isCurrent()) {
          return;
        }

        await publishPending();

        if (fallbackPatch !== undefined) {
          // The body was not actually a multi-file patch; parse it whole.
          setLoadState("parsing");
          const built = buildDiffItems<T>(fallbackPatch, reloadKey);
          if (!isCurrent()) {
            return;
          }
          publishFull(built.items);
          setDiffStats(built.diffStats);
          setLoadState("ready");
          return;
        }

        if (!hasPublishedInitial) {
          // Empty diff (clean tree) — publish an empty list so the viewer
          // settles into its empty state instead of an infinite spinner.
          setInitialItems([]);
        }
        setDiffStats({ ...accumulator.diffStats });
        setLoadState("ready");
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("[diffhub] patch load failed", { error });
        setErrorMessage(GENERIC_PATCH_LOAD_ERROR);
        setLoadState("error");
      }
    };

    void loadPatch();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, loadAttempt]);

  return { diffStats, errorMessage, initialItems, loadState, retry, viewerKey };
};
