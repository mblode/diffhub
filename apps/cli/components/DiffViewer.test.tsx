import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiffViewer, getCommentElementId } from "./DiffViewer";
import type { Comment } from "@/lib/comment-types";
const { MockPatchDiff } = vi.hoisted(() => ({
  MockPatchDiff: ({
    lineAnnotations,
    patch,
    renderAnnotation,
  }: {
    lineAnnotations?: { lineNumber: number; metadata?: unknown; side: string }[];
    patch: string;
    renderAnnotation?: (annotation: {
      lineNumber: number;
      metadata?: unknown;
      side: string;
    }) => React.ReactNode;
  }) => (
    <div data-testid="patch-viewer">
      {patch}
      {lineAnnotations?.map((annotation) => {
        const metadata =
          typeof annotation.metadata === "object" && annotation.metadata !== null
            ? JSON.stringify(annotation.metadata)
            : String(annotation.metadata ?? "");
        return (
          <div key={`${annotation.side}:${annotation.lineNumber}:${metadata}`}>
            {renderAnnotation?.(annotation)}
          </div>
        );
      })}
    </div>
  ),
}));

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
    return MockPatchDiff;
  }) as typeof actual.default;

  return {
    ...actual,
    default: dynamicMock,
    dynamic: dynamicMock,
  };
});

const makeProps = (fileCount: number) => {
  const files = Array.from({ length: fileCount }, (_, index) => `src/file-${index}.ts`);
  return {
    activeCommentId: null,
    activeFileId: files[0],
    collapsedFiles: new Set<string>(),
    comments: [] as Comment[],
    fileStats: files.map((file) => ({
      binary: false,
      changes: 1,
      deletions: 0,
      file,
      insertions: 1,
    })),
    forceRenderFiles: new Set([files[0]]),
    layout: "stacked" as const,
    onActiveFileChange: vi.fn<(file: string) => void>(),
    onAddComment: vi
      .fn<
        (
          file: string,
          lineNumber: number,
          side: string,
          body: string,
          tag: string,
        ) => Promise<boolean>
      >()
      .mockResolvedValue(true),
    onDeleteComment: vi.fn<(id: string) => Promise<boolean>>().mockResolvedValue(true),
    onNavigateComment: vi.fn<(id: string) => void>(),
    onReplyToComment: vi
      .fn<(id: string, body: string) => Promise<boolean>>()
      .mockResolvedValue(true),
    onResolveComment: vi
      .fn<(id: string, resolved: boolean) => Promise<boolean>>()
      .mockResolvedValue(true),
    onToggleCollapse: vi.fn<(file: string) => void>(),
    patchesByFile: Object.fromEntries(
      files.map((file, index) => [
        file,
        `diff --git a/${file} b/${file}\n@@ -1 +1 @@\n-old ${index}\n+new ${index}\n`,
      ]),
    ),
    prerenderedHTMLByFile: undefined,
    repoPath: "/tmp/repo",
  };
};

const makeComment = (overrides: Partial<Comment> = {}): Comment => ({
  anchor: {
    afterContext: [],
    beforeContext: [],
    fileSha: "",
    lineContent: "",
  },
  body: "comment body",
  createdAt: "2026-05-14T00:00:00.000Z",
  file: "src/file-0.ts",
  id: "comment-1",
  lineNumber: 1,
  replies: [],
  resolved: false,
  side: "right",
  staleness: "fresh",
  tag: "",
  ...overrides,
});

describe("diff viewer rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps passive active-file changes from rendering deferred patches", () => {
    const props = makeProps(25);
    const { rerender } = render(<DiffViewer {...props} />);

    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(1);
    expect(screen.getAllByTestId("deferred-diff-placeholder").length).toBeGreaterThan(0);

    rerender(<DiffViewer {...props} activeFileId="src/file-1.ts" />);

    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(1);
  });

  it("renders deferred patches when explicit navigation forces them", () => {
    const props = makeProps(25);
    const { rerender } = render(<DiffViewer {...props} />);

    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(1);

    rerender(
      <DiffViewer
        {...props}
        activeFileId="src/file-1.ts"
        forceRenderFiles={new Set(["src/file-0.ts", "src/file-1.ts"])}
      />,
    );

    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(2);
  });

  it("renders all patches immediately below the large-diff fallback threshold", () => {
    render(<DiffViewer {...makeProps(5)} />);

    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(5);
    expect(screen.queryByTestId("deferred-diff-placeholder")).toBeNull();
  });

  it("defers a single large file behind a Load diff button in a small PR", () => {
    const props = makeProps(3);
    const largeFile = "src/file-1.ts";
    props.fileStats = props.fileStats.map((stat) =>
      stat.file === largeFile
        ? { binary: false, changes: 800, deletions: 300, file: stat.file, insertions: 500 }
        : stat,
    );
    props.activeFileId = "src/file-0.ts";

    render(<DiffViewer {...props} />);

    const placeholders = screen.getAllByTestId("deferred-diff-placeholder");
    expect(placeholders).toHaveLength(1);
    const placeholder = placeholders[0] as HTMLElement;
    expect(placeholder.dataset.variant).toBe("large");
    expect(placeholder.textContent).toContain("Large diffs are not rendered by default");
    expect(placeholder.textContent).toContain("800 changed lines");
    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /load diff/i }));

    expect(screen.queryByTestId("deferred-diff-placeholder")).toBeNull();
    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(3);
    const rendered = screen
      .getAllByTestId("patch-viewer")
      .some((el) => el.textContent?.includes(largeFile));
    expect(rendered).toBeTruthy();
  });

  it("renders a large file when navigation forces it", () => {
    const props = makeProps(3);
    const largeFile = "src/file-1.ts";
    props.fileStats = props.fileStats.map((stat) =>
      stat.file === largeFile
        ? { binary: false, changes: 800, deletions: 300, file: stat.file, insertions: 500 }
        : stat,
    );
    props.activeFileId = "src/file-0.ts";

    const { rerender } = render(<DiffViewer {...props} />);
    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(2);

    rerender(
      <DiffViewer {...props} activeFileId={largeFile} forceRenderFiles={new Set([largeFile])} />,
    );

    expect(screen.queryByTestId("deferred-diff-placeholder")).toBeNull();
    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(3);
  });

  it("renders comments in a stable file-level comments block", () => {
    const props = makeProps(1);
    props.comments = [
      makeComment({
        body: "resolved outside patch",
        id: "comment-outside",
        lineNumber: 99,
        resolved: true,
        resolvedAt: "2026-05-14T01:00:00.000Z",
        resolvedBy: "Reviewer",
      }),
    ];

    render(<DiffViewer {...props} />);

    expect(screen.getByText("Comments")).toBeTruthy();
    expect(screen.getByText(/resolved outside patch/)).toBeTruthy();
    expect(document.querySelector(`#${getCommentElementId("comment-outside")}`)).not.toBeNull();
  });
});
