"use client";

import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import { useMemo } from "react";

interface DiffsWorkerProviderProps {
  children: React.ReactNode;
}

const createDiffWorker = (): Worker =>
  new Worker(new URL("../workers/diffs.worker.ts", import.meta.url), { type: "module" });

export const DiffsWorkerProvider = ({
  children,
}: DiffsWorkerProviderProps): React.JSX.Element => {
  const poolOptions = useMemo(
    () => ({
      poolSize: Math.min(4, navigator.hardwareConcurrency || 4),
      workerFactory: createDiffWorker,
    }),
    [],
  );

  return (
    <WorkerPoolContextProvider highlighterOptions={{}} poolOptions={poolOptions}>
      {children}
    </WorkerPoolContextProvider>
  );
};
