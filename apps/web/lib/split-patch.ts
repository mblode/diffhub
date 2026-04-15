export const splitPatchByFile = (patch: string): Map<string, string> => {
  const patches = new Map<string, string>();
  const headerPattern = /^diff --git a\/(.+?) b\/(.+)$/gm;
  const entries: { file: string; start: number }[] = [];

  let match = headerPattern.exec(patch);
  while (match) {
    entries.push({ file: match[2], start: match.index });
    match = headerPattern.exec(patch);
  }

  for (const [index, entry] of entries.entries()) {
    const nextStart = entries[index + 1]?.start ?? patch.length;
    const filePatch = patch.slice(entry.start, nextStart).trimEnd();
    patches.set(entry.file, filePatch ? `${filePatch}\n` : "");
  }

  return patches;
};
