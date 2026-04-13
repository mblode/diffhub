"use client";

import { useCallback, useEffect, useDeferredValue, useRef, useState, startTransition } from "react";
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

const Placeholder = ({ text, pulse = false }: { text: string; pulse?: boolean }) => (
  <div className="flex h-full items-center justify-center">
    <div className={`text-muted-foreground text-sm${pulse ? " animate-pulse" : ""}`}>{text}</div>
  </div>
);

const MainPanel = ({
  filesData,
  deferredFileDiff,
  layout,
  comments,
  onAddComment,
  onDeleteComment,
  selectedFile,
  viewedFiles,
  onToggleViewed,
  repoPath,
  onDiscard,
}: MainPanelProps) => {
  if (filesData === null) {
    return <Placeholder text="Loading diff…" pulse />;
  }
  if (filesData.files.length === 0) {
    return <Placeholder text="No changes" />;
  }
  if (!deferredFileDiff) {
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
  // Fingerprint of last-seen file stats to detect real changes between polls
  const lastStatsRef = useRef<string | null>(null);
  // In-flight guard: don't start a new poll if previous is still running
  const fetchingRef = useRef(false);
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

  // Fetch the diff for a single file; uses local cache
  const fetchFileDiff = useCallback(async (file: string) => {
    const cached = diffCacheRef.current.get(file);
    if (cached) {
      setFileDiff(cached);
      return;
    }
    try {
      const mode = diffModeRef.current;
      const modeParam = mode === "uncommitted" ? "&mode=uncommitted" : "";
      const res = await fetch(`/api/diff?file=${encodeURIComponent(file)}${modeParam}`);
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as FileDiff;
      diffCacheRef.current.set(file, data);
      setFileDiff(data);
    } catch {
      // empty
    }
  }, []);

  const handleSelectFile = useCallback(
    (file: string) => {
      selectedFileRef.current = file;
      startTransition(() => setSelectedFile(file));
      fetchFileDiff(file);
    },
    [fetchFileDiff],
  );

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
        const mode = diffModeRef.current;
        const modeParam = mode === "uncommitted" ? "?mode=uncommitted" : "";

        const [filesRes, commentsRes] = await Promise.all([
          fetch(`/api/files${modeParam}`),
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

        // Auto-select first file on initial load
        if (!selectedFileRef.current && files.files.length > 0) {
          const first = files.files[0].file;
          selectedFileRef.current = first;
          setSelectedFile(first);
          fetchFileDiff(first);
        }

        // Detect if file stats changed — if so, invalidate cache and re-fetch selected file
        const fingerprint = files.files
          .map((f) => `${f.file}:${f.insertions}:${f.deletions}`)
          .join("|");
        if (fingerprint !== lastStatsRef.current) {
          lastStatsRef.current = fingerprint;
          diffCacheRef.current.clear();
          const curr = selectedFileRef.current;
          if (curr) {
            fetchFileDiff(curr);
          }
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!silent) {
          setRefreshing(false);
        }
        fetchingRef.current = false;
      }
    },
    [fetchFileDiff],
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
      diffCacheRef.current.clear();
      lastStatsRef.current = null;
      pollFiles(false);
    },
    [pollFiles],
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
          layout={layout}
          onLayoutChange={setLayout}
        />

        <div className="flex-1 overflow-hidden">
          <MainPanel
            filesData={filesData}
            deferredFileDiff={deferredFileDiff}
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
