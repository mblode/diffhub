"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

export type FileWatchState = "connecting" | "live" | "fallback";

interface FileWatchResponse {
  changed: boolean;
  revision: number;
}

const RETRY_DELAYS_MS = [1000, 2000, 5000] as const;
const MAX_CONSECUTIVE_FAILURES = 10;

export const useFileWatch = (onChange: () => void): FileWatchState => {
  const [state, setState] = useState<FileWatchState>("connecting");
  const onChangeEvent = useEffectEvent(onChange);
  const latestRevisionRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let failureCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const pollWatch = async () => {
      if (cancelled) {
        return;
      }

      try {
        const revisionQuery =
          latestRevisionRef.current === null ? "" : `?revision=${latestRevisionRef.current}`;
        const response = await fetch(`/api/watch${revisionQuery}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          throw new Error(`Watch request failed with status ${response.status}`);
        }

        const data = (await response.json()) as FileWatchResponse;
        if (cancelled) {
          return;
        }

        failureCount = 0;
        setState("live");
        const previousRevision = latestRevisionRef.current;
        latestRevisionRef.current = data.revision;

        if (data.changed && previousRevision !== null && data.revision !== previousRevision) {
          onChangeEvent();
        }

        // Guard against request leaks on unmount
        if (!cancelled) {
          queueMicrotask(() => {
            if (!cancelled) {
              void pollWatch();
            }
          });
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }

        failureCount += 1;
        console.error("[diffhub] file watch failed", { error, failureCount });

        // Stop retrying after too many consecutive failures
        if (failureCount > MAX_CONSECUTIVE_FAILURES) {
          console.error("[diffhub] file watch: max retries exceeded, stopping");
          setState("fallback");
          return;
        }

        setState(failureCount >= RETRY_DELAYS_MS.length ? "fallback" : "connecting");

        const retryDelay = RETRY_DELAYS_MS[Math.min(failureCount - 1, RETRY_DELAYS_MS.length - 1)];
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (!cancelled) {
            void pollWatch();
          }
        }, retryDelay);
      }
    };

    setState("connecting");
    void pollWatch();

    return () => {
      cancelled = true;
      controller.abort();
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, []);

  return state;
};
