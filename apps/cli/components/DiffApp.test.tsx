import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiffApp } from "./DiffApp";
import type { Comment } from "@/lib/comment-types";

interface MockAnnotation {
  lineNumber: number;
  metadata?: unknown;
  side: "deletions" | "additions";
}

const { MockDynamicPatch } = vi.hoisted(() => ({
  MockDynamicPatch: ({
    patch,
    lineAnnotations,
    renderAnnotation,
    renderGutterUtility,
  }: {
    patch: string;
    lineAnnotations?: MockAnnotation[];
    renderAnnotation?: (annotation: MockAnnotation) => React.ReactNode;
    renderGutterUtility?: (
      getHoveredLine: () => { lineNumber: number; side: "deletions" | "additions" } | undefined,
    ) => React.ReactNode;
  }) => (
    <div data-testid={`patch:${patch.slice(0, 12)}`}>
      <div>{patch}</div>
      {renderGutterUtility?.(() => ({ lineNumber: 12, side: "additions" }))}
      {lineAnnotations?.map((annotation) => {
        const metadataKey =
          typeof annotation.metadata === "object" && annotation.metadata !== null
            ? JSON.stringify(annotation.metadata)
            : String(annotation.metadata ?? "");

        return (
          <div key={`${annotation.lineNumber}:${annotation.side}:${metadataKey}`}>
            {renderAnnotation?.(annotation)}
          </div>
        );
      })}
    </div>
  ),
}));

vi.mock(import("@/lib/use-file-watch"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useFileWatch: () => "live" as const,
  };
});

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

vi.mock(import("next/dynamic"), async (importOriginal) => {
  const actual = await importOriginal();
  const dynamicMock = ((
    loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>,
  ) => {
    void loader;
    return MockDynamicPatch;
  }) as typeof actual.default;

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

const diffPayload = {
  baseBranch: "origin/main",
  branch: "feature/diff-review",
  generation: "generation-1",
  mergeBase: "abc123",
  patchesByFile: {
    "src/a.ts": "diff --git a/src/a.ts b/src/a.ts\n@@ -1 +1 @@\n-old\n+new\n",
    "src/b.ts": "diff --git a/src/b.ts b/src/b.ts\n@@ -1 +1 @@\n-old\n+newer\n",
  },
  reviewKeysByFile: {
    "src/a.ts": "review:a",
    "src/b.ts": "review:b",
  },
};

const jsonResponse = (value: unknown, init?: ResponseInit): Response => Response.json(value, init);
const getDiffSection = (file: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-filename="${file}"]`);

describe("DiffApp review flow", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
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
        return Promise.resolve(jsonResponse(diffPayload));
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

    const firstSection = getDiffSection("src/a.ts");
    expect(firstSection).not.toBeNull();
    if (!firstSection) {
      throw new Error("Missing first diff section");
    }

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

  it("keeps the inline draft open when comment creation fails", async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/files")) {
        return Promise.resolve(jsonResponse(filesPayload));
      }

      if (url.startsWith("/api/diff")) {
        return Promise.resolve(jsonResponse(diffPayload));
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
    const commentSection = getDiffSection("src/b.ts");
    expect(commentSection).not.toBeNull();
    if (!commentSection) {
      throw new Error("Missing second diff section");
    }

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
        return Promise.resolve(jsonResponse(diffPayload));
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
    const commentSection = getDiffSection("src/b.ts");
    expect(commentSection).not.toBeNull();
    if (!commentSection) {
      throw new Error("Missing second diff section");
    }

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
