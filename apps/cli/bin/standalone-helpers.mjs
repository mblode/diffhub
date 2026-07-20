import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const TRACE_ALIAS_PATTERN = /^(?:@[^/\\]+[/\\])?[^/\\]+-[0-9a-f]{16}$/;

const copyDirectory = (from, to) => {
  rmSync(to, { force: true, recursive: true });
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { dereference: true, force: true, recursive: true });
};

const walkDirectory = (dir, predicate, matches = []) => {
  if (!existsSync(dir)) {
    return matches;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    if (predicate(entry, entryPath)) {
      matches.push(entryPath);
    }

    if (entry.isDirectory()) {
      walkDirectory(entryPath, predicate, matches);
    }
  }

  return matches;
};

const getStandaloneTraceAliasRoot = (standaloneDir) => join(standaloneDir, ".next", "node_modules");

const getStandaloneServerRoot = (standaloneDir) => join(standaloneDir, ".next", "server");

export const materializeStandaloneNodeModuleAliases = (standaloneDir) => {
  const aliasRoot = getStandaloneTraceAliasRoot(standaloneDir);
  const symlinks = walkDirectory(aliasRoot, (entry) => entry.isSymbolicLink());

  const materializedAliases = [];
  for (const symlinkPath of symlinks) {
    const targetPath = realpathSync(symlinkPath);
    copyDirectory(targetPath, symlinkPath);
    materializedAliases.push(relative(standaloneDir, symlinkPath));
  }

  return materializedAliases.toSorted();
};

export const findMissingStandaloneNodeModuleAliases = (standaloneDir) => {
  const serverRoot = getStandaloneServerRoot(standaloneDir);
  const traceFiles = walkDirectory(
    serverRoot,
    (entry, entryPath) => entry.isFile() && entryPath.endsWith(".nft.json"),
  );

  const missingAliases = new Set();
  for (const traceFile of traceFiles) {
    const trace = JSON.parse(readFileSync(traceFile, "utf-8"));
    const tracedFiles = Array.isArray(trace.files) ? trace.files : [];

    for (const tracedFile of tracedFiles) {
      const absolutePath = resolve(dirname(traceFile), tracedFile);
      const marker = `${sep}.next${sep}node_modules${sep}`;
      const markerIndex = absolutePath.indexOf(marker);
      if (markerIndex === -1) {
        continue;
      }

      const relativeAliasPath = absolutePath.slice(markerIndex + marker.length);
      const segments = relativeAliasPath.split(sep).filter(Boolean);
      const aliasName =
        segments.length >= 2 && segments[0]?.startsWith("@")
          ? `${segments[0]}/${segments[1]}`
          : segments[0];

      if (!aliasName || !TRACE_ALIAS_PATTERN.test(aliasName)) {
        continue;
      }

      if (!existsSync(absolutePath)) {
        missingAliases.add(aliasName);
      }
    }
  }

  return [...missingAliases].toSorted();
};

// Traced-but-never-loaded packages, dropped from the npm package at pack time:
// - sharp/@img: pulled in via Next's own server trace (next-server.js.nft.json,
//   unreachable by outputFileTracingExcludes); with images.unoptimized the
//   optimizer never loads them, and the binaries only fit the publish machine.
// - @shikijs/langs + themes: shiki is a server external, so its lazy
//   per-language/theme dynamic imports get traced wholesale. Highlighting runs
//   exclusively in client-side workers (bundled into .next/static); the server
//   never creates a highlighter. If server-side highlighting ever returns, the
//   failure is a loud "Cannot find module '@shikijs/langs/…'" in the server log.
const PRUNED_STANDALONE_PACKAGES = ["sharp", "@img", "@shikijs/langs", "@shikijs/themes"];

export const pruneStandalonePackages = (standaloneRoot) => {
  const pruned = [];
  for (const name of PRUNED_STANDALONE_PACKAGES) {
    const packageDir = join(standaloneRoot, "node_modules", name);
    if (existsSync(packageDir)) {
      rmSync(packageDir, { force: true, recursive: true });
      pruned.push(name);
    }
  }

  return pruned;
};

export const syncStandaloneAssets = (appDir, standaloneDir) => {
  const copies = [
    {
      from: join(appDir, ".next", "static"),
      to: join(standaloneDir, ".next", "static"),
    },
    {
      from: join(appDir, "public"),
      to: join(standaloneDir, "public"),
    },
  ];

  for (const copy of copies) {
    if (!existsSync(copy.from)) {
      continue;
    }

    copyDirectory(copy.from, copy.to);
  }

  return materializeStandaloneNodeModuleAliases(standaloneDir);
};
