"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useTransition,
  startTransition,
} from "react";
import { StatusBar } from "./StatusBar";
import type { DiffMode } from "./StatusBar";
import { FileList } from "./FileList";
import { DiffViewer } from "./DiffViewer";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import type { DiffFileStat } from "@/lib/git";
import type { Comment, CommentTag } from "@/lib/comments";

interface FilesData {
  files: DiffFileStat[];
  insertions: number;
  deletions: number;
  branch: string;
  baseBranch: string;
  fingerprint: string;
}

interface FileDiff {
  patch: string;
  baseBranch: string;
  mergeBase: string;
  branch: string;
}

interface MainPanelProps {
  filesData: FilesData | null;
  deferredFileDiff: FileDiff | null;
  fileDiffPending: boolean;
  layout: "split" | "stacked";
  comments: Comment[];
  onAddComment: (
    file: string,
    lineNumber: number,
    side: string,
    body: string,
    tag: CommentTag,
  ) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  selectedFile: string | null;
  viewedFiles: Set<string>;
  onToggleViewed: (file: string) => void;
  repoPath: string;
  onDiscard: ((file: string) => Promise<void>) | undefined;
}

interface PlaceholderProps {
  text: string;
  pulse?: boolean;
}

const Placeholder = ({ text, pulse = false }: PlaceholderProps): React.JSX.Element => (
  <div className="flex h-full items-center justify-center">
    <div className={`text-muted-foreground text-sm${pulse ? " animate-pulse" : ""}`}>{text}</div>
  </div>
);

const MainPanel = ({
  filesData,
  deferredFileDiff,
  fileDiffPending,
  layout,
  comments,
  onAddComment,
  onDeleteComment,
  selectedFile,
  viewedFiles,
  onToggleViewed,
  repoPath,
  onDiscard,
}: MainPanelProps): React.JSX.Element => {
  if (filesData === null) {
    return <Placeholder text="Loading diff…" pulse />;
  }
  if (filesData.files.length === 0) {
    return <Placeholder text="No changes" />;
  }
  if (!deferredFileDiff || fileDiffPending) {
    return <Placeholder text="Loading diff…" pulse />;
  }
  return (
    <DiffViewer
      patch={deferredFileDiff.patch}
      mergeBase={deferredFileDiff.mergeBase}
      layout={layout}
      comments={comments}
      onAddComment={onAddComment}
      onDeleteComment={onDeleteComment}
      selectedFileId={selectedFile}
      fileStats={filesData.files}
      viewedFiles={viewedFiles}
      onToggleViewed={onToggleViewed}
      repoPath={repoPath}
      onDiscard={onDiscard}
    />
  );
};

const POLL_INTERVAL = 5000;
const MAX_DIFF_CACHE_ENTRIES = 50;

const getCachedDiff = (cache: Map<string, FileDiff>, file: string): FileDiff | null => {
  const cached = cache.get(file);
  if (!cached) {
    return null;
  }

  cache.delete(file);
  cache.set(file, cached);
  return cached;
};

const setCachedDiff = (cache: Map<string, FileDiff>, file: string, diff: FileDiff): void => {
  if (cache.has(file)) {
    cache.delete(file);
  }
  cache.set(file, diff);

  if (cache.size <= MAX_DIFF_CACHE_ENTRIES) {
    return;
  }

  const oldestKey = cache.keys().next().value;
  if (oldestKey) {
    cache.delete(oldestKey);
  }
};

export const DiffApp = ({ repoPath }: { repoPath: string }) => {
  const [filesData, setFilesData] = useState<FilesData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  // Ref mirror of selectedFile — lets pollFiles read it without a stale closure
  const selectedFileRef = useRef<string | null>(null);
  const [fileDiff, setFileDiff] = useState<FileDiff | null>(null);
  // Per-file patch cache: avoids re-fetching when switching back to a previously viewed file
  const diffCacheRef = useRef<Map<string, FileDiff>>(new Map());
  const [layout, setLayout] = useState<"split" | "stacked">("split");
  const [filterQuery, setFilterQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Diff mode — "all" shows mergeBase...HEAD, "uncommitted" shows git diff HEAD
  const [diffMode, setDiffMode] = useState<DiffMode>("all");
  // Ref so callbacks always read the latest mode without being recreated
  const diffModeRef = useRef<DiffMode>("all");
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const ignoreWhitespaceRef = useRef(false);
  // Fingerprint of the current diff tree. Unlike summary counts, this changes on renames
  // and mode-only edits as well as regular content changes.
  const lastDiffFingerprintRef = useRef<string | null>(null);
  // In-flight guard: don't start a new poll if previous is still running
  const fetchingRef = useRef(false);
  const latestDiffRequestRef = useRef(0);
  const [isFileDiffPending, startFileDiffTransition] = useTransition();
  // Viewed files — persisted to localStorage per repo
  const [viewedFiles, setViewedFiles] = useState<Set<string>>(() => {
    if (typeof window === "undefined") {
      return new Set();
    }
    try {
      const stored = localStorage.getItem(`diffhub-viewed:${repoPath}`);
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      // empty
      return new Set();
    }
  });

  const toggleViewed = useCallback(
    (file: string) => {
      setViewedFiles((prev) => {
        const next = new Set(prev);
        if (next.has(file)) {
          next.delete(file);
        } else {
          next.add(file);
        }
        try {
          localStorage.setItem(`diffhub-viewed:${repoPath}`, JSON.stringify([...next]));
        } catch {
          // empty
        }
        return next;
      });
    },
    [repoPath],
  );

  // Deferred patch for DiffViewer — keeps sidebar responsive during large renders
  const deferredFileDiff = useDeferredValue(fileDiff);

  const buildDiffQuery = useCallback((file?: string): string => {
    const params = new URLSearchParams();
    if (file) {
      params.set("file", file);
    }
    if (diffModeRef.current === "uncommitted") {
      params.set("mode", "uncommitted");
    }
    if (ignoreWhitespaceRef.current) {
      params.set("ws", "ignore");
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  }, []);

  // Fetch the diff for a single file; uses local cache
  const fetchFileDiff = useCallback(async (file: string) => {
    latestDiffRequestRef.current += 1;
    const requestId = latestDiffRequestRef.current;
    const cached = getCachedDiff(diffCacheRef.current, file);
    if (cached) {
      if (selectedFileRef.current !== file || requestId !== latestDiffRequestRef.current) {
        return;
      }
      startFileDiffTransition(() => setFileDiff(cached));
      return;
    }
    try {
      const res = await fetch(`/api/diff${buildDiffQuery(file)}`);
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as FileDiff;
      if (selectedFileRef.current !== file || requestId !== latestDiffRequestRef.current) {
        return;
      }
      startFileDiffTransition(() => {
        setCachedDiff(diffCacheRef.current, file, data);
        setFileDiff(data);
      });
    } catch {
      // empty
    }
  }, [buildDiffQuery, startFileDiffTransition]);

  const handleSelectFile = useCallback(
    (file: string) => {
      selectedFileRef.current = file;
      startTransition(() => setSelectedFile(file));
      fetchFileDiff(file);
    },
    [fetchFileDiff],
  );

  const reconcileSelectedFile = useCallback(
    (files: FilesData) => {
      if (files.files.length === 0) {
        selectedFileRef.current = null;
        latestDiffRequestRef.current += 1;
        startTransition(() => {
          setSelectedFile(null);
          setFileDiff(null);
        });
        lastDiffFingerprintRef.current = files.fingerprint;
        return;
      }

      if (!selectedFileRef.current) {
        const first = files.files[0].file;
        selectedFileRef.current = first;
        startTransition(() => setSelectedFile(first));
        fetchFileDiff(first);
      }

      const currentSelection = selectedFileRef.current;
      if (currentSelection && !files.files.some((file) => file.file === currentSelection)) {
        const nextFile = files.files[0]?.file ?? null;
        selectedFileRef.current = nextFile;
        latestDiffRequestRef.current += 1;
        startTransition(() => {
          setSelectedFile(nextFile);
          setFileDiff(null);
        });
        if (nextFile) {
          fetchFileDiff(nextFile);
        }
      }

      if (files.fingerprint === lastDiffFingerprintRef.current) {
        return;
      }

      lastDiffFingerprintRef.current = files.fingerprint;
      latestDiffRequestRef.current += 1;
      diffCacheRef.current.clear();
      const curr = selectedFileRef.current;
      if (curr) {
        fetchFileDiff(curr);
      }
    },
    [fetchFileDiff],
  );

  const invalidateDiffState = useCallback(() => {
    latestDiffRequestRef.current += 1;
    diffCacheRef.current.clear();
    lastDiffFingerprintRef.current = null;
  }, []);

  // Poll /api/files for change detection (lightweight) + /api/comments
  const pollFiles = useCallback(
    async (silent = false) => {
      if (fetchingRef.current) {
        return;
      }
      fetchingRef.current = true;
      if (!silent) {
        setRefreshing(true);
      }
      setLoadError(null);

      try {
        const [filesRes, commentsRes] = await Promise.all([
          fetch(`/api/files${buildDiffQuery()}`),
          fetch("/api/comments"),
        ]);

        if (!filesRes.ok) {
          const err = await filesRes.json().catch(() => ({ error: "Network error" }));
          setLoadError(err.error ?? "Failed to load files");
          return;
        }

        const [files, commentsData] = await Promise.all([
          filesRes.json() as Promise<FilesData>,
          commentsRes.json() as Promise<Comment[]>,
        ]);

        startTransition(() => {
          setFilesData(files);
          setComments(commentsData);
        });
        setLastUpdated(new Date());
        reconcileSelectedFile(files);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!silent) {
          setRefreshing(false);
        }
        fetchingRef.current = false;
      }
    },
    [buildDiffQuery, reconcileSelectedFile],
  );

  // Initial load
  useEffect(() => {
    pollFiles();
  }, [pollFiles]);

  // Polling — only /api/files, not the full patch
  useEffect(() => {
    const interval = setInterval(() => pollFiles(true), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [pollFiles]);

  // Keyboard shortcuts
  useEffect(() => {
    // oxlint-disable-next-line complexity
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }

      if (e.key === "s" && !e.metaKey && !e.ctrlKey) {
        setLayout((l) => (l === "split" ? "stacked" : "split"));
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder="Filter files…"]')?.focus();
      }
      if (e.key === "v" && !e.metaKey && !e.ctrlKey && selectedFile) {
        toggleViewed(selectedFile);
      }
      if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
        pollFiles();
      }
      if (e.key === "j" || e.key === "k") {
        const files = filesData?.files ?? [];
        if (files.length === 0) {
          return;
        }
        const idx = files.findIndex((f) => f.file === selectedFile);
        const next = e.key === "j" ? files[idx + 1] : files[idx - 1];
        if (next) {
          handleSelectFile(next.file);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [filesData, selectedFile, toggleViewed, pollFiles, handleSelectFile]);

  const handleDiffModeChange = useCallback(
    (mode: DiffMode) => {
      // update ref immediately so next poll/fetch uses it
      diffModeRef.current = mode;
      setDiffMode(mode);
      invalidateDiffState();
      pollFiles(false);
    },
    [invalidateDiffState, pollFiles],
  );

  const handleIgnoreWhitespaceChange = useCallback(
    (nextIgnoreWhitespace: boolean) => {
      ignoreWhitespaceRef.current = nextIgnoreWhitespace;
      setIgnoreWhitespace(nextIgnoreWhitespace);
      invalidateDiffState();
      pollFiles(false);
    },
    [invalidateDiffState, pollFiles],
  );

  const handleAddComment = useCallback(
    async (file: string, lineNumber: number, side: string, body: string, tag: CommentTag) => {
      const res = await fetch("/api/comments", {
        body: JSON.stringify({ body, file, lineNumber, side, tag }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (res.ok) {
        const comment = (await res.json()) as Comment;
        setComments((prev) => [...prev, comment]);
      }
    },
    [],
  );

  const handleDeleteComment = useCallback(async (id: string) => {
    await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
    setComments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleDiscard = useCallback(
    async (file: string) => {
      const res = await fetch("/api/discard", {
        body: JSON.stringify({ file }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (res.ok) {
        // Bust cache for this file and re-poll
        diffCacheRef.current.delete(file);
        await pollFiles(false);
      }
    },
    [pollFiles],
  );

  if (loadError) {
    return (
      <SidebarProvider className="h-svh">
        <SidebarInset className="flex flex-col h-svh items-center justify-center gap-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-6 py-4 text-sm text-destructive max-w-md text-center">
            <p className="font-semibold mb-1">Failed to load diff</p>
            <p className="text-xs opacity-80">{loadError}</p>
          </div>
          <Button
            variant="outline"
            // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onClick={() => pollFiles()}
          >
            Retry
          </Button>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider className="h-svh">
      <FileList
        files={filesData?.files ?? []}
        selectedFile={selectedFile}
        onSelectFile={handleSelectFile}
        comments={comments}
        repoPath={repoPath}
        filterQuery={filterQuery}
        onFilterChange={setFilterQuery}
        viewedFiles={viewedFiles}
      />

      <SidebarInset className="flex flex-col h-svh overflow-hidden">
        <StatusBar
          branch={filesData?.branch ?? "…"}
          baseBranch={filesData?.baseBranch ?? "main"}
          insertions={filesData?.insertions ?? 0}
          deletions={filesData?.deletions ?? 0}
          fileCount={filesData?.files.length ?? 0}
          refreshing={refreshing}
          lastUpdated={lastUpdated}
          comments={comments}
          diffMode={diffMode}
          onDiffModeChange={handleDiffModeChange}
          ignoreWhitespace={ignoreWhitespace}
          onIgnoreWhitespaceChange={handleIgnoreWhitespaceChange}
          layout={layout}
          onLayoutChange={setLayout}
        />

        <div className="flex-1 overflow-hidden">
          <MainPanel
            filesData={filesData}
            deferredFileDiff={deferredFileDiff}
            fileDiffPending={isFileDiffPending}
            layout={layout}
            comments={comments}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            selectedFile={selectedFile}
            viewedFiles={viewedFiles}
            onToggleViewed={toggleViewed}
            repoPath={repoPath}
            onDiscard={diffMode === "uncommitted" ? handleDiscard : undefined}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
