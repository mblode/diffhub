"use client";

import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import type { WorkerInitializationRenderOptions, WorkerPoolOptions } from "@pierre/diffs/react";
import { useMemo } from "react";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from "@/lib/diff-themes";

interface DiffsWorkerProviderProps {
  children: React.ReactNode;
}

const isMobileBrowser = (): boolean => {
  if (typeof navigator === "undefined") {
    return false;
  }

  return (
    navigator.maxTouchPoints > 0 &&
    globalThis.matchMedia?.("(max-width: 767px), (pointer: coarse)").matches === true
  );
};

const createDiffWorker = (): Worker =>
  new Worker(new URL("@pierre/diffs/worker/worker.js", import.meta.url), { type: "module" });

export const DiffsWorkerProvider = ({ children }: DiffsWorkerProviderProps): React.JSX.Element => {
  const poolOptions = useMemo<WorkerPoolOptions>(() => {
    const isMobile = isMobileBrowser();

    return {
      poolSize: Math.min(Math.max(1, (navigator.hardwareConcurrency ?? 1) - 1), isMobile ? 1 : 3),
      totalASTLRUCacheSize: isMobile ? 10 : 100,
      workerFactory: createDiffWorker,
    };
  }, []);

  const highlighterOptions = useMemo<WorkerInitializationRenderOptions>(
    () => ({
      langs: ["cpp", "css", "go", "python", "rust", "sh", "swift", "tsx", "typescript", "zig"],
      preferredHighlighter: "shiki-wasm",
      theme: { dark: DEFAULT_DARK_THEME, light: DEFAULT_LIGHT_THEME },
      // Long-line safeguard kept in sync with DiffViewer's CodeView options:
      // skip tokenizing pathological (minified) lines so they can't stall a worker.
      tokenizeMaxLineLength: 5000,
    }),
    [],
  );

  return (
    <WorkerPoolContextProvider highlighterOptions={highlighterOptions} poolOptions={poolOptions}>
      {children}
    </WorkerPoolContextProvider>
  );
};
