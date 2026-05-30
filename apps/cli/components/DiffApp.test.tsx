import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiffApp } from "./DiffApp";
import type { Comment } from "@/lib/comment-types";
import { WATCH_STREAM_EVENTS } from "@/lib/watch-stream";

interface MockAnnotation {
  lineNumber: number;
  metadata?: unknown;
  side: "deletions" | "additions";
}

interface MockItem {
  id: string;
  type: "diff";
  collapsed?: boolean;
  version?: number;
  annotations?: MockAnnotation[];
  fileDiff: unknown;
}

interface MockHandle {
  getItem(id: string): MockItem | undefined;
  updateItem(item: MockItem): boolean;
  addItems(items: MockItem[]): void;
  addItem(item: MockItem): void;
  updateItemId(): boolean;
  scrollTo(): void;
  setSelectedLines(): void;
  getSelectedLines(): null;
  clearSelectedLines(): void;
  getInstance(): unknown;
}

interface MockCodeViewProps {
  initialItems?: MockItem[];
  renderCustomHeader?: (item: MockItem) => React.ReactNode;
  renderAnnotation?: (annotation: MockAnnotation, item: MockItem) => React.ReactNode;
  renderGutterUtility?: (
    getHoveredLine: () => { lineNumber: number; side: "deletions" | "additions" } | undefined,
    item: MockItem,
  ) => React.ReactNode;
}

vi.mock(import("next-themes"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useTheme: () => ({
      forcedTheme: undefined,
      resolvedTheme: "light",
      setTheme: (_value: React.SetStateAction<string>) => {},
      systemTheme: "light" as const,
      theme: "light",
      themes: ["light", "dark"],
    }),
  };
});

// No worker pool provider in the test tree — the hook returns undefined, which
// DiffViewer + the readiness hook treat as "ready".
vi.mock(import("@pierre/diffs/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    // oxlint-disable-next-line unicorn/no-useless-undefined -- hook returns the pool or undefined
    useWorkerPool: () => undefined,
  };
});

// The blanket next/dynamic mock catches every dynamically-loaded component.
// CodeView passes `initialItems`; everything else (e.g. the sidebar's
// FileTreeBody) renders a lightweight stub. The CodeView surface keeps its
// streamed items in local state and exposes the imperative handle DiffViewer
// drives (updateItem/addItems) so comment + collapse mutations re-render.
vi.mock(import("next/dynamic"), async (importOriginal) => {
  const actual = await importOriginal();

  const MockDynamic = React.forwardRef<MockHandle, MockCodeViewProps>(function MockDynamicImpl(
    { initialItems, renderCustomHeader, renderAnnotation, renderGutterUtility },
    ref,
  ) {
    const itemsRef = React.useRef<MockItem[]>(initialItems ?? []);
    const [, force] = React.useReducer((value: number) => value + 1, 0);

    React.useEffect(() => {
      if (initialItems !== undefined) {
        itemsRef.current = [...initialItems];
        force();
      }
    }, [initialItems]);

    React.useImperativeHandle(ref, () => ({
      addItem(item: MockItem) {
        itemsRef.current.push(item);
        force();
      },
      addItems(items: MockItem[]) {
        itemsRef.current.push(...items);
        force();
      },
      clearSelectedLines() {},
      getInstance() {},
      getItem(id: string) {
        return itemsRef.current.find((item) => item.id === id);
      },
      getSelectedLines() {
        return null;
      },
      scrollTo() {},
      setSelectedLines() {},
      updateItem(item: MockItem) {
        const index = itemsRef.current.findIndex((candidate) => candidate.id === item.id);
        if (index !== -1) {
          itemsRef.current[index] = item;
        }
        force();
        return index !== -1;
      },
      updateItemId() {
        return true;
      },
    }));

    // Non-CodeView dynamic children (no items) render a harmless stub.
    if (initialItems === undefined) {
      return <div data-testid="file-tree-body" />;
    }

    return (
      <div data-testid="code-view">
        {itemsRef.current.map((item) => (
          <div data-filename={item.id} key={item.id}>
            {renderCustomHeader?.(item)}
            <div role="region" hidden={item.collapsed ?? false}>
              <div data-testid={`patch:${item.id}`}>
                {item.id}
                {(item.fileDiff as { additionLines?: string[] } | undefined)?.additionLines?.join(
                  "\n",
                )}
              </div>
              {renderGutterUtility?.(() => ({ lineNumber: 12, side: "additions" }), item)}
              {item.annotations?.map((annotation) => {
                const metadataKey =
                  typeof annotation.metadata === "object" && annotation.metadata !== null
                    ? JSON.stringify(annotation.metadata)
                    : String(annotation.metadata ?? "");

                return (
                  <div key={`${annotation.lineNumber}:${annotation.side}:${metadataKey}`}>
                    {renderAnnotation?.(annotation, item)}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  });

  const dynamicMock = (() => MockDynamic) as typeof actual.default;

  return {
    ...actual,
    default: dynamicMock,
    dynamic: dynamicMock,
  };
});

const filesPayload = {
  baseBranch: "origin/main",
  branch: "feature/diff-review",
  deletions: 0,
  files: [
    {
      binary: false,
      changes: 1,
      deletions: 0,
      file: "src/a.ts",
      insertions: 1,
    },
    {
      binary: false,
      changes: 1,
      deletions: 0,
      file: "src/b.ts",
      insertions: 1,
    },
  ],
  fingerprint: "fingerprint-1",
  generation: "generation-1",
  insertions: 2,
};

// /api/diff now streams a raw unified patch; the loader parses it client-side.
const diffPatchText = (bVariant = "newer"): string =>
  `diff --git a/src/a.ts b/src/a.ts\n@@ -1 +1 @@\n-old\n+new\n` +
  `diff --git a/src/b.ts b/src/b.ts\n@@ -1 +1 @@\n-old\n+${bVariant}\n`;

// A real Response exposes a readable body stream, so the loader exercises its
// actual streamGitPatchFiles path in the test.
const diffResponse = (bVariant?: string): Response =>
  new Response(diffPatchText(bVariant), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    status: 200,
  });

const jsonResponse = (value: unknown, init?: ResponseInit): Response => Response.json(value, init);
const countFetchCalls = (
  fetchMock: { mock: { calls: Parameters<typeof fetch>[] } },
  prefix: string,
): number =>
  fetchMock.mock.calls.filter(([input]) => {
    const url = typeof input === "string" ? input : input.toString();
    return url.startsWith(prefix);
  }).length;
const getDiffSection = (file: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-filename="${file}"]`);

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  listeners = new Map<string, Set<EventListener>>();
  url: string;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  close = vi.fn<() => void>();

  emit(type: string) {
    const event = new MessageEvent(type);
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  emitReady() {
    this.emit(WATCH_STREAM_EVENTS.READY);
  }

  emitChange() {
    this.emit(WATCH_STREAM_EVENTS.CHANGE);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }

  static reset() {
    FakeEventSource.instances = [];
  }
}

describe("DiffApp review flow", () => {
  beforeEach(() => {
    localStorage.clear();
    FakeEventSource.reset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads diffs, collapses files, and supports comment add/delete", async () => {
    const user = userEvent.setup();
    let comments: Comment[] = [];

    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/files")) {
        return Promise.resolve(jsonResponse(filesPayload));
      }

      if (url.startsWith("/api/diff")) {
        return Promise.resolve(diffResponse());
      }

      if (url === "/api/comments" && method === "GET") {
        return Promise.resolve(jsonResponse(comments));
      }

      if (url === "/api/comments" && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as Omit<Comment, "createdAt" | "id">;
        const createdComment: Comment = {
          ...body,
          createdAt: "2026-04-15T00:00:00.000Z",
          id: `comment-${comments.length + 1}`,
        };
        comments = [...comments, createdComment];
        return Promise.resolve(jsonResponse(createdComment));
      }

      if (url.startsWith("/api/comments?id=") && method === "DELETE") {
        const id = url.split("=").at(-1) ?? "";
        comments = comments.filter((comment) => comment.id !== id);
        return Promise.resolve(new Response(null, { status: 200 }));
      }

      return Promise.reject(new Error(`Unhandled fetch: ${method} ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DiffApp repoPath="/tmp/repo-under-test" />);

    await screen.findByText("feature/diff-review");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/diff"),
        expect.anything(),
      );
    });

    const firstSection = await waitFor(() => {
      const section = getDiffSection("src/a.ts");
      if (!section) {
        throw new Error("Missing first diff section");
      }
      return section;
    });

    const viewedToggle = within(firstSection).getByRole("button", {
      name: /collapse file section/i,
    });
    await user.click(viewedToggle);

    const firstPanel = within(firstSection).getByRole("region", { hidden: true });
    await waitFor(() => {
      expect(firstPanel.hidden).toBeTruthy();
    });

    const secondSection = getDiffSection("src/b.ts");
    expect(secondSection).not.toBeNull();
    if (!secondSection) {
      throw new Error("Missing second diff section");
    }

    const addCommentButton = within(secondSection).getByTitle("Add comment for AI");
    await user.click(addCommentButton);

    const commentInput = within(secondSection).getByPlaceholderText("Add a comment for the AI");
    await user.type(commentInput, "Investigate this diff");
    await user.click(within(secondSection).getByRole("button", { name: /^comment$/i }));

    await screen.findByText("Investigate this diff");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/comments",
      expect.objectContaining({ method: "POST" }),
    );
    const addCommentRequest = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/comments" && init?.method === "POST",
    );
    expect(addCommentRequest).toBeTruthy();
    expect(JSON.parse(String(addCommentRequest?.[1]?.body ?? "{}"))).toStrictEqual({
      body: "Investigate this diff",
      file: "src/b.ts",
      lineNumber: 12,
      side: "right",
      tag: "",
    });

    await user.click(within(secondSection).getByRole("button", { name: /delete comment/i }));

    await waitFor(() => {
      expect(screen.queryByText("Investigate this diff")).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/comments?id=comment-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("copies comments as a prompt and clears them after a successful copy", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    let comments: Comment[] = [
      {
        body: "Investigate this diff",
        createdAt: "2026-04-15T00:00:00.000Z",
        file: "src/b.ts",
        id: "comment-1",
        lineNumber: 12,
        side: "right",
        tag: "[must-fix]",
      },
    ];

    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/files")) {
        return Promise.resolve(jsonResponse(filesPayload));
      }

      if (url.startsWith("/api/diff")) {
        return Promise.resolve(diffResponse());
      }

      if (url === "/api/comments" && method === "GET") {
        return Promise.resolve(jsonResponse(comments));
      }

      if (url === "/api/comments?all=1" && method === "DELETE") {
        comments = [];
        return Promise.resolve(jsonResponse({ ok: true }));
      }

      return Promise.reject(new Error(`Unhandled fetch: ${method} ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DiffApp repoPath="/tmp/repo-under-test" />);

    const copyButton = await screen.findByRole("button", {
      name: /copy & clear 1 comment/i,
    });
    await user.click(copyButton);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("- [must-fix] **src/b.ts:12**: Investigate this diff"),
      );
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/comments?all=1",
      expect.objectContaining({ method: "DELETE" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /copy & clear/i })).toBeNull();
    });
  });

  it("refetches files and diff when the user clicks the force refresh button", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/files")) {
        return Promise.resolve(jsonResponse(filesPayload));
      }

      if (url.startsWith("/api/diff")) {
        return Promise.resolve(diffResponse());
      }

      if (url === "/api/comments" && method === "GET") {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.reject(new Error(`Unhandled fetch: ${method} ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DiffApp repoPath="/tmp/repo-under-test" />);

    await screen.findByText("feature/diff-review");
    await waitFor(() => {
      expect(countFetchCalls(fetchMock, "/api/diff")).toBe(1);
    });

    const initialFilesCalls = countFetchCalls(fetchMock, "/api/files");
    const initialCommentsCalls = countFetchCalls(fetchMock, "/api/comments");
    const initialDiffCalls = countFetchCalls(fetchMock, "/api/diff");

    await user.click(screen.getByRole("button", { name: /force refresh diff/i }));

    await waitFor(() => {
      expect(countFetchCalls(fetchMock, "/api/files")).toBe(initialFilesCalls + 1);
    });
    await waitFor(() => {
      expect(countFetchCalls(fetchMock, "/api/diff")).toBe(initialDiffCalls + 1);
    });
    expect(countFetchCalls(fetchMock, "/api/comments")).toBe(initialCommentsCalls + 1);
  });

  it("refetches via the R keyboard shortcut", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/files")) {
        return Promise.resolve(jsonResponse(filesPayload));
      }

      if (url.startsWith("/api/diff")) {
        return Promise.resolve(diffResponse());
      }

      if (url === "/api/comments" && method === "GET") {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.reject(new Error(`Unhandled fetch: ${method} ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DiffApp repoPath="/tmp/repo-under-test" />);

    await screen.findByText("feature/diff-review");
    await waitFor(() => {
      expect(countFetchCalls(fetchMock, "/api/diff")).toBe(1);
    });

    const initialFilesCalls = countFetchCalls(fetchMock, "/api/files");
    const initialDiffCalls = countFetchCalls(fetchMock, "/api/diff");

    await user.keyboard("r");

    await waitFor(() => {
      expect(countFetchCalls(fetchMock, "/api/files")).toBe(initialFilesCalls + 1);
    });
    await waitFor(() => {
      expect(countFetchCalls(fetchMock, "/api/diff")).toBe(initialDiffCalls + 1);
    });
  });

  it("refetches files and diff when the watch stream reports a change", async () => {
    let version = 1;
    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/files")) {
        return Promise.resolve(
          jsonResponse({
            ...filesPayload,
            files: filesPayload.files.map((file) =>
              file.file === "src/b.ts" && version === 2
                ? { ...file, changes: 2, insertions: 2 }
                : file,
            ),
            fingerprint: `fingerprint-${version}`,
            generation: `generation-${version}`,
            insertions: version === 2 ? 3 : 2,
          }),
        );
      }

      if (url.startsWith("/api/diff")) {
        return Promise.resolve(diffResponse(version === 2 ? "watched" : "newer"));
      }

      if (url === "/api/comments" && method === "GET") {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.reject(new Error(`Unhandled fetch: ${method} ${url}`));
    });

    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<DiffApp repoPath="/tmp/repo-under-test" />);

    await screen.findByText("feature/diff-review");
    await waitFor(() => {
      expect(FakeEventSource.instances).toHaveLength(1);
      expect(countFetchCalls(fetchMock, "/api/diff")).toBe(1);
    });
    FakeEventSource.instances[0]?.emitReady();
    await screen.findByRole("button", { name: /Live.*force refresh diff/i });

    version = 2;
    FakeEventSource.instances[0]?.emitChange();

    await screen.findByText(/watched/);
    await screen.findByRole("button", { name: /Updated just now.*force refresh diff/i });
    expect(countFetchCalls(fetchMock, "/api/files")).toBeGreaterThanOrEqual(2);
    expect(countFetchCalls(fetchMock, "/api/comments")).toBe(1);
    expect(countFetchCalls(fetchMock, "/api/diff")).toBeGreaterThanOrEqual(2);
    expect(FakeEventSource.instances[0]?.url).toBe("/api/watch");

    unmount();
    expect(FakeEventSource.instances[0]?.close).toHaveBeenCalledOnce();
  });

  it("supports a polling fallback without opening EventSource", async () => {
    let version = 1;
    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/files")) {
        return Promise.resolve(
          jsonResponse({
            ...filesPayload,
            files: filesPayload.files.map((file) =>
              file.file === "src/b.ts" && version === 2
                ? { ...file, changes: 2, insertions: 2 }
                : file,
            ),
            fingerprint: `fingerprint-${version}`,
            generation: `generation-${version}`,
            insertions: version === 2 ? 3 : 2,
          }),
        );
      }

      if (url.startsWith("/api/diff")) {
        return Promise.resolve(diffResponse(version === 2 ? "polled" : "newer"));
      }

      if (url === "/api/comments" && method === "GET") {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.reject(new Error(`Unhandled fetch: ${method} ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(
      <DiffApp repoPath="/tmp/repo-under-test" watchMode="poll" watchPollMs={25} />,
    );

    await screen.findByText("feature/diff-review");
    await waitFor(() => {
      expect(countFetchCalls(fetchMock, "/api/diff")).toBeGreaterThanOrEqual(1);
    });
    await screen.findByRole("button", { name: /Live.*force refresh diff/i });

    version = 2;

    await screen.findByText(/polled/);
    await screen.findByRole("button", { name: /Updated just now.*force refresh diff/i });
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).startsWith("/api/files?refresh=1")),
    ).toBeTruthy();
    expect(countFetchCalls(fetchMock, "/api/comments")).toBe(1);

    unmount();
  });

  it("keeps the inline draft open when comment creation fails", async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/files")) {
        return Promise.resolve(jsonResponse(filesPayload));
      }

      if (url.startsWith("/api/diff")) {
        return Promise.resolve(diffResponse());
      }

      if (url === "/api/comments" && method === "GET") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/comments" && method === "POST") {
        return Promise.resolve(jsonResponse({ error: "save failed" }, { status: 500 }));
      }

      return Promise.reject(new Error(`Unhandled fetch: ${method} ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DiffApp repoPath="/tmp/repo-under-test" />);

    await screen.findByText("feature/diff-review");
    const commentSection = await waitFor(() => {
      const section = getDiffSection("src/b.ts");
      if (!section) {
        throw new Error("Missing second diff section");
      }
      return section;
    });

    await user.click(within(commentSection).getByTitle("Add comment for AI"));

    const commentInput = within(commentSection).getByPlaceholderText("Add a comment for the AI");
    await user.type(commentInput, "Investigate this diff");
    await user.click(within(commentSection).getByRole("button", { name: /^comment$/i }));

    await screen.findByText("Failed to save comment.");
    expect((commentInput as HTMLTextAreaElement).value).toBe("Investigate this diff");
    expect(screen.queryByRole("button", { name: /delete comment/i })).toBeNull();
  });

  it("keeps the saved comment visible when deletion fails", async () => {
    const user = userEvent.setup();
    let comments: Comment[] = [];

    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/files")) {
        return Promise.resolve(jsonResponse(filesPayload));
      }

      if (url.startsWith("/api/diff")) {
        return Promise.resolve(diffResponse());
      }

      if (url === "/api/comments" && method === "GET") {
        return Promise.resolve(jsonResponse(comments));
      }

      if (url === "/api/comments" && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as Omit<Comment, "createdAt" | "id">;
        const createdComment: Comment = {
          ...body,
          createdAt: "2026-04-15T00:00:00.000Z",
          id: "comment-1",
        };
        comments = [createdComment];
        return Promise.resolve(jsonResponse(createdComment));
      }

      if (url === "/api/comments?id=comment-1" && method === "DELETE") {
        return Promise.resolve(jsonResponse({ error: "delete failed" }, { status: 500 }));
      }

      return Promise.reject(new Error(`Unhandled fetch: ${method} ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DiffApp repoPath="/tmp/repo-under-test" />);

    await screen.findByText("feature/diff-review");
    const commentSection = await waitFor(() => {
      const section = getDiffSection("src/b.ts");
      if (!section) {
        throw new Error("Missing second diff section");
      }
      return section;
    });

    await user.click(within(commentSection).getByTitle("Add comment for AI"));

    const commentInput = within(commentSection).getByPlaceholderText("Add a comment for the AI");
    await user.type(commentInput, "Investigate this diff");
    await user.click(within(commentSection).getByRole("button", { name: /^comment$/i }));

    await screen.findByText("Investigate this diff");

    await user.click(screen.getByRole("button", { name: /delete comment/i }));

    await screen.findByText("Failed to delete comment.");
    expect(screen.getByText("Investigate this diff")).toBeTruthy();
  });
});
