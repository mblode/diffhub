"use client";

import { useWorkerPool } from "@pierre/diffs/react";
import { useEffect, useRef, useState } from "react";

/**
 * Returns true once the diff worker pool has finished initializing. Defaults to
 * true when no pool is mounted (worker pool disabled), so consumers gate only on
 * an actively-initializing pool. Ported from the diffshub reference
 * `useIsWorkerPoolReadyOrDisabled`.
 */
export const useIsWorkerPoolReady = (): boolean => {
  const workerPool = useWorkerPool();
  const [isReady, setIsReady] = useState(() => workerPool?.isInitialized() ?? true);
  const isReadyRef = useRef(isReady);

  // The callback always fires immediately with the current state, so we don't
  // need to seed it in the effect.
  useEffect(
    () =>
      workerPool?.subscribeToStatChanges((stats) => {
        const nextIsReady = stats.managerState === "initialized";
        if (nextIsReady !== isReadyRef.current) {
          setIsReady(nextIsReady);
          isReadyRef.current = nextIsReady;
        }
      }),
    [workerPool],
  );

  return isReady;
};
