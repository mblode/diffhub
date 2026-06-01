export const COMMIT_HASH_METADATA_PATTERN = /^From\s+([a-f0-9]+)\s/im;

const commitPrefixEncoder = new TextEncoder();
const commitPrefixDecoder = new TextDecoder();

const detachCommitPrefix = (value: string): string =>
  commitPrefixDecoder.decode(commitPrefixEncoder.encode(value));

// Local `git diff` output has no `From <hash>` commit-format-patch headers, so
// this never produces a real prefix for a plain diff. GitHub PR `.diff` output
// is the same shape. Ported faithfully so the stream parser stays identical to
// the reference.
export const getPatchTreePathPrefix = (
  patchMetadata: string | undefined,
  patchIndex: number,
): string => {
  const commitHash = patchMetadata?.match(COMMIT_HASH_METADATA_PATTERN)?.[1];
  return commitHash === undefined
    ? `Commit ${patchIndex + 1}`
    : detachCommitPrefix(commitHash.slice(0, 5));
};
