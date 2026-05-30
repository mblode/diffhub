import type { GitStatus, GitStatusEntry } from "@pierre/trees";
import type { DiffFileStat } from "./diff-file-stat";

/**
 * Map a diff file's insertion/deletion counts to a `@pierre/trees` git status,
 * which the tree uses to colour the filename (added → green, deleted → red,
 * everything else → modified/neutral): a pure add is "added", a pure delete is
 * "deleted", and any mixed or binary change is "modified".
 */
const toGitStatus = (stat: DiffFileStat): GitStatus => {
  if (stat.insertions > 0 && stat.deletions === 0) {
    return "added";
  }
  if (stat.deletions > 0 && stat.insertions === 0) {
    return "deleted";
  }
  return "modified";
};

export const toGitStatusEntries = (files: DiffFileStat[]): GitStatusEntry[] =>
  files.map((stat) => ({ path: stat.file, status: toGitStatus(stat) }));
