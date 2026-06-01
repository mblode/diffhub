import type { CodeViewDiffItem, FileDiffMetadata } from "@pierre/diffs";
import { parsePatchFiles } from "@pierre/diffs";

export interface DiffStats {
  addedLines: number;
  deletedLines: number;
  fileCount: number;
  totalLinesOfCode: number;
}

export interface DiffItemAccumulator<T = undefined> {
  diffStats: DiffStats;
  // item id -> file path
  itemIdToFile: Map<string, string>;
  items: CodeViewDiffItem<T>[];
  // Per-base next collision suffix, used to resolve rare duplicate paths.
  nextCollisionSuffixByBase: Map<string, number>;
  pendingItems: CodeViewDiffItem<T>[];
}

export interface BuiltDiffItems<T = undefined> {
  diffStats: DiffStats;
  itemIdToFile: Map<string, string>;
  items: CodeViewDiffItem<T>[];
}

export const createDiffItemAccumulator = <T = undefined>(): DiffItemAccumulator<T> => ({
  diffStats: {
    addedLines: 0,
    deletedLines: 0,
    fileCount: 0,
    totalLinesOfCode: 0,
  },
  itemIdToFile: new Map(),
  items: [],
  nextCollisionSuffixByBase: new Map(),
  pendingItems: [],
});

// Resolves rare id collisions by advancing a per-base suffix instead of scanning
// accumulated items.
const createUniqueItemId = <T>(accumulator: DiffItemAccumulator<T>, baseId: string): string => {
  if (!accumulator.itemIdToFile.has(baseId)) {
    return baseId;
  }

  let suffix = accumulator.nextCollisionSuffixByBase.get(baseId) ?? 2;
  let itemId = `${baseId}-${suffix}`;
  while (accumulator.itemIdToFile.has(itemId)) {
    suffix += 1;
    itemId = `${baseId}-${suffix}`;
  }
  accumulator.nextCollisionSuffixByBase.set(baseId, suffix + 1);
  return itemId;
};

export const appendFileDiffToAccumulator = <T = undefined>(
  accumulator: DiffItemAccumulator<T>,
  fileDiff: FileDiffMetadata,
): void => {
  const { diffStats } = accumulator;
  diffStats.fileCount += 1;
  diffStats.totalLinesOfCode += fileDiff.unifiedLineCount;
  for (const hunk of fileDiff.hunks) {
    diffStats.addedLines += hunk.additionLines;
    diffStats.deletedLines += hunk.deletionLines;
  }

  const path = fileDiff.name;
  const id = accumulator.itemIdToFile.has(path) ? createUniqueItemId(accumulator, path) : path;

  const item: CodeViewDiffItem<T> = {
    fileDiff,
    id,
    type: "diff",
    version: 0,
  };
  accumulator.items.push(item);
  accumulator.pendingItems.push(item);
  accumulator.itemIdToFile.set(id, path);
};

export const takePendingItems = <T = undefined>(
  accumulator: DiffItemAccumulator<T>,
): CodeViewDiffItem<T>[] => {
  const { pendingItems } = accumulator;
  accumulator.pendingItems = [];
  return pendingItems;
};

// Non-streaming fallback path: parse a full patch and accumulate every file.
export const buildDiffItems = <T = undefined>(
  fullPatch: string,
  cacheKeyPrefix: string,
): BuiltDiffItems<T> => {
  const parsedPatches = parsePatchFiles(fullPatch, encodeURIComponent(cacheKeyPrefix));
  const accumulator = createDiffItemAccumulator<T>();
  for (const patch of parsedPatches) {
    for (const fileDiff of patch.files) {
      appendFileDiffToAccumulator(accumulator, fileDiff);
    }
  }

  return {
    diffStats: accumulator.diffStats,
    itemIdToFile: accumulator.itemIdToFile,
    items: accumulator.items,
  };
};
