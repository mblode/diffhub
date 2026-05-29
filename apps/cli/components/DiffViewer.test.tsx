import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiffViewer } from "./DiffViewer";

interface MockAnnotation {
  lineNumber: number;
  metadata?: unknown;
  side: "deletions" | "additions";
}

interface MockItem {
  id: string;
  type: "diff";
  collapsed?: boolean;
  annotations?: MockAnnotation[];
  fileDiff: unknown;
}

interface MockCodeViewProps {
  items: MockItem[];
  renderCustomHeader?: (item: MockItem) => React.ReactNode;
  renderAnnotation?: (annotation: MockAnnotation, item: MockItem) => React.ReactNode;
  renderGutterUtility?: (
    getHoveredLine: () => { lineNumber: number; side: "deletions" | "additions" } | undefined,
    item: MockItem,
  ) => React.ReactNode;
}

// Mock CodeView reproduces the per-item DOM surface the suite asserts against:
// a `[data-filename]` wrapper, the custom header, a hideable region panel, the
// gutter utility, and annotation slots. CodeView itself owns virtualization;
// here we render every item eagerly so assertions are deterministic.
const { MockCodeView } = vi.hoisted(() => ({
  MockCodeView: ({
    items,
    renderCustomHeader,
    renderAnnotation,
    renderGutterUtility,
  }: MockCodeViewProps) => (
    <div data-testid="code-view">
      {items.map((item) => (
        <div data-filename={item.id} key={item.id}>
          {renderCustomHeader?.(item)}
          <div role="region" hidden={item.collapsed ?? false}>
            <div data-testid="patch-viewer">{item.id}</div>
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
    return MockCodeView;
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
    repoPath: "/tmp/repo",
  };
};

describe("diff viewer rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders one CodeView item per file", () => {
    render(<DiffViewer {...makeProps(5)} />);

    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(5);
    expect(screen.getByTestId("code-view")).toBeTruthy();
  });

  it("keeps rendering every file regardless of the active file", () => {
    const props = makeProps(25);
    const { rerender } = render(<DiffViewer {...props} />);

    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(25);

    rerender(<DiffViewer {...props} activeFileId="src/file-1.ts" />);

    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(25);
  });

  it("marks collapsed files' panels as hidden via item.collapsed", () => {
    const props = makeProps(3);
    render(<DiffViewer {...props} collapsedFiles={new Set(["src/file-1.ts"])} />);

    const section = document.querySelector<HTMLElement>('[data-filename="src/file-1.ts"]');
    expect(section).not.toBeNull();
    if (!section) {
      throw new Error("Missing collapsed section");
    }
    const panel = within(section).getByRole("region", { hidden: true });
    expect(panel.hidden).toBeTruthy();
  });

  it("forwards gutter clicks into the inline comment input", () => {
    const props = makeProps(2);
    render(<DiffViewer {...props} />);

    const section = document.querySelector<HTMLElement>('[data-filename="src/file-1.ts"]');
    expect(section).not.toBeNull();
    if (!section) {
      throw new Error("Missing section");
    }

    fireEvent.click(within(section).getByTitle("Add comment for AI"));
    expect(within(section).getByPlaceholderText("Add a comment for the AI")).toBeTruthy();
  });

  it("renders existing comments as annotations", () => {
    const props = makeProps(2);
    render(
      <DiffViewer
        {...props}
        comments={[
          {
            body: "Look here",
            createdAt: "2026-04-15T00:00:00.000Z",
            file: "src/file-0.ts",
            id: "comment-1",
            lineNumber: 1,
            side: "right",
            tag: "",
          },
        ]}
      />,
    );

    expect(screen.getByText("Look here")).toBeTruthy();
  });
});
