import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiffViewer } from "./DiffViewer";

const { MockPatchDiff } = vi.hoisted(() => ({
  MockPatchDiff: ({ patch }: { patch: string }) => <div data-testid="patch-viewer">{patch}</div>,
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
    activeFileId: files[0],
    collapsedFiles: new Set<string>(),
    comments: [],
    fileStats: files.map((file) => ({
      binary: false,
      changes: 1,
      deletions: 0,
      file,
      insertions: 1,
    })),
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

describe("diff viewer rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("defers patch rendering for large diffs without prerendered HTML", () => {
    const props = makeProps(25);
    const { rerender } = render(<DiffViewer {...props} />);

    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(1);
    expect(screen.getAllByTestId("deferred-diff-placeholder").length).toBeGreaterThan(0);

    rerender(<DiffViewer {...props} activeFileId="src/file-1.ts" />);

    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(2);
  });

  it("renders all patches immediately below the large-diff fallback threshold", () => {
    render(<DiffViewer {...makeProps(5)} />);

    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(5);
    expect(screen.queryByTestId("deferred-diff-placeholder")).toBeNull();
  });
});
