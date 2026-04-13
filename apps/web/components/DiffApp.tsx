"use client";

import { useCallback, useEffect, useDeferredValue, useRef, useState, startTransition } from "react";
import { StatusBar } from "./StatusBar";
import { FileList } from "./FileList";
import { DiffViewer } from "./DiffViewer";
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

const POLL_INTERVAL = 5000;

export function DiffApp({ repoPath }: { repoPath: string }) {
  const [filesData, setFilesData] = useState<FilesData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<FileDiff | null>(null);
  // Per-file patch cache: avoids re-fetching when switching back to a previously viewed file
  const diffCacheRef = useRef<Map<string, FileDiff>>(new Map());
  const [layout, setLayout] = useState<"split" | "stacked">("split");
  const [filterQuery, setFilterQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Fingerprint of last-seen file stats to detect real changes between polls
  const lastStatsRef = useRef<string | null>(null);
  // In-flight guard: don't start a new poll if previous is still running
  const fetchingRef = useRef(false);

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
      const res = await fetch(`/api/diff?file=${encodeURIComponent(file)}`);
      if (!res.ok) return;
      const data = (await res.json()) as FileDiff;
      diffCacheRef.current.set(file, data);
      setFileDiff(data);
    } catch {}
  }, []);

  // Poll /api/files for change detection (lightweight) + /api/comments
  const pollFiles = useCallback(async (silent = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (!silent) setRefreshing(true);
    setError(null);

    try {
      const [filesRes, commentsRes] = await Promise.all([
        fetch("/api/files"),
        fetch("/api/comments"),
      ]);

      if (!filesRes.ok) {
        const err = await filesRes.json().catch(() => ({ error: "Network error" }));
        setError(err.error ?? "Failed to load files");
        return;
      }

      const [files, commentsData] = await Promise.all([
        filesRes.json() as Promise<FilesData>,
        commentsRes.json() as Promise<Comment[]>,
      ]);

      setFilesData(files);
      setComments(commentsData);
      setLastUpdated(new Date());

      // Auto-select first file on initial load
      setSelectedFile((prev) => {
        if (!prev && files.files.length > 0) {
          const first = files.files[0].file;
          fetchFileDiff(first);
          return first;
        }
        return prev;
      });

      // Detect if file stats changed — if so, invalidate cache and re-fetch selected file
      const fingerprint = files.files.map((f) => `${f.file}:${f.insertions}:${f.deletions}`).join("|");
      if (fingerprint !== lastStatsRef.current) {
        lastStatsRef.current = fingerprint;
        diffCacheRef.current.clear();
        setSelectedFile((prev) => {
          if (prev) fetchFileDiff(prev);
          return prev;
        });
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, [fetchFileDiff]);

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
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      if (e.key === "r") pollFiles();
      if (e.key === "s" && !e.metaKey && !e.ctrlKey) {
        setLayout((l) => (l === "split" ? "stacked" : "split"));
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder="Filter files…"]')?.focus();
      }
      if (e.key === "j" || e.key === "k") {
        const files = filesData?.files ?? [];
        if (files.length === 0) return;
        const idx = files.findIndex((f) => f.file === selectedFile);
        const next = e.key === "j" ? files[idx + 1] : files[idx - 1];
        if (next) handleSelectFile(next.file);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [filesData, selectedFile]);

  const handleSelectFile = useCallback(
    (file: string) => {
      startTransition(() => setSelectedFile(file));
      fetchFileDiff(file);
    },
    [fetchFileDiff]
  );

  const handleAddComment = useCallback(
    async (file: string, lineNumber: number, side: string, body: string, tag: CommentTag) => {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file, lineNumber, side, body, tag }),
      });
      if (res.ok) {
        const comment = (await res.json()) as Comment;
        setComments((prev) => [...prev, comment]);
      }
    },
    []
  );

  const handleDeleteComment = useCallback(async (id: string) => {
    await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
    setComments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  if (error) {
    return (
      <div className="flex h-screen flex-col bg-[#0d1117] text-[#e6edf3]">
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="rounded-lg border border-[#f85149]/30 bg-[#f85149]/10 px-6 py-4 text-sm text-[#f85149] max-w-md text-center">
            <p className="font-semibold mb-1">Failed to load diff</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
          <button
            onClick={() => pollFiles()}
            className="rounded bg-[#21262d] px-4 py-2 text-sm text-[#e6edf3] hover:bg-[#30363d] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#0d1117] text-[#e6edf3] overflow-hidden">
      <StatusBar
        branch={filesData?.branch ?? "…"}
        baseBranch={filesData?.baseBranch ?? "main"}
        insertions={filesData?.insertions ?? 0}
        deletions={filesData?.deletions ?? 0}
        fileCount={filesData?.files.length ?? 0}
        layout={layout}
        onLayoutToggle={() => setLayout((l) => (l === "split" ? "stacked" : "split"))}
        onRefresh={() => pollFiles()}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        comments={comments}
      />

      <div className="flex flex-1 overflow-hidden">
        <FileList
          files={filesData?.files ?? []}
          selectedFile={selectedFile}
          onSelectFile={handleSelectFile}
          comments={comments}
          onAddComment={async (file, lineNumber, body, tag) =>
            handleAddComment(file, lineNumber, "right", body, tag)
          }
          onDeleteComment={handleDeleteComment}
          repoPath={repoPath}
          filterQuery={filterQuery}
          onFilterChange={setFilterQuery}
        />

        <main className="flex flex-1 flex-col overflow-hidden">
          {deferredFileDiff ? (
            <DiffViewer
              patch={deferredFileDiff.patch}
              layout={layout}
              comments={comments}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              selectedFileId={selectedFile}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-[#8b949e] text-sm animate-pulse">
                Loading diff…
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="border-t border-white/5 px-4 py-1 text-[10px] text-[#8b949e] flex gap-4">
        <span><kbd className="font-mono">j/k</kbd> navigate files</span>
        <span><kbd className="font-mono">s</kbd> toggle split</span>
        <span><kbd className="font-mono">/</kbd> filter</span>
        <span><kbd className="font-mono">r</kbd> refresh</span>
        <span><kbd className="font-mono">+</kbd> comment</span>
      </footer>
    </div>
  );
}
