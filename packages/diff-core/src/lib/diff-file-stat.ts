export interface DiffFileStat {
  file: string;
  changes: number;
  insertions: number;
  deletions: number;
  binary: boolean;
}

export const LARGE_FILE_CHANGES_THRESHOLD = 500;
export const LARGE_FILE_PATCH_BYTES_THRESHOLD = 500_000;

export const isLargeDiffFile = (stat: DiffFileStat, patchBytes?: number): boolean => {
  if (stat.binary) {
    return false;
  }
  if (stat.changes >= LARGE_FILE_CHANGES_THRESHOLD) {
    return true;
  }
  return patchBytes !== undefined && patchBytes >= LARGE_FILE_PATCH_BYTES_THRESHOLD;
};
