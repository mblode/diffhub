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

// The worker pool is provider-driven; without a provider useWorkerPool is
// undefined, which DiffViewer + the readiness hook already treat as "ready".
vi.mock(import("@pierre/diffs/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    // oxlint-disable-next-line unicorn/no-useless-undefined -- the hook returns the pool or undefined
    useWorkerPool: () => undefined,
  };
});

// Mock CodeView reproduces the per-item DOM surface the suite asserts against
// and a minimal imperative handle so DiffViewer's uncontrolled updates
// (updateItem/addItems for comments + collapse) re-render. Defined inside the
// factory (which runs after imports) so React is initialized. CodeView itself
// owns virtualization; here we render every item eagerly for determinism.
vi.mock(import("next/dynamic"), async (importOriginal) => {
  const actual = await importOriginal();

  const MockCodeView = React.forwardRef<MockHandle, MockCodeViewProps>(function MockCodeViewImpl(
    { initialItems, renderCustomHeader, renderAnnotation, renderGutterUtility },
    ref,
  ) {
    const itemsRef = React.useRef<MockItem[]>(initialItems ?? []);
    const [, force] = React.useReducer((value: number) => value + 1, 0);

    React.useEffect(() => {
      itemsRef.current = [...(initialItems ?? [])];
      force();
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

    return (
      <div data-testid="code-view">
        {itemsRef.current.map((item) => (
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
    );
  });

  const dynamicMock = (() => MockCodeView) as typeof actual.default;

  return {
    ...actual,
    default: dynamicMock,
    dynamic: dynamicMock,
  };
});

const buildPatch = (files: string[]): string =>
  files
    .map(
      (file, index) =>
        `diff --git a/${file} b/${file}\n@@ -1 +1 @@\n-old ${index}\n+new ${index}\n`,
    )
    .join("");

// The streaming loader falls back to a whole-patch parse when the response has
// no body, which keeps the test transport synchronous and deterministic.
const stubDiffFetch = (patch: string): void => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        body: null,
        ok: true,
        status: 200,
        text: () => Promise.resolve(patch),
      }),
    ),
  );
};

const makeProps = (fileCount: number) => {
  const files = Array.from({ length: fileCount }, (_, index) => `src/file-${index}.ts`);
  stubDiffFetch(buildPatch(files));
  return {
    activeFileId: files[0],
    collapsedFiles: new Set<string>(),
    comments: [],
    diffMode: "all" as const,
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
    reloadKey: "test-reload",
    repoPath: "/tmp/repo",
  };
};

describe("diff viewer rendering", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders one CodeView item per streamed file", async () => {
    render(<DiffViewer {...makeProps(5)} />);

    await expect(screen.findAllByTestId("patch-viewer")).resolves.toHaveLength(5);
    expect(screen.getByTestId("code-view")).toBeTruthy();
  });

  it("keeps rendering every file regardless of the active file", async () => {
    const props = makeProps(25);
    const { rerender } = render(<DiffViewer {...props} />);

    await expect(screen.findAllByTestId("patch-viewer")).resolves.toHaveLength(25);

    rerender(<DiffViewer {...props} activeFileId="src/file-1.ts" />);

    expect(screen.getAllByTestId("patch-viewer")).toHaveLength(25);
  });

  it("marks collapsed files' panels as hidden via item.collapsed", async () => {
    const props = makeProps(3);
    render(<DiffViewer {...props} collapsedFiles={new Set(["src/file-1.ts"])} />);

    await screen.findAllByTestId("patch-viewer");

    const section = document.querySelector<HTMLElement>('[data-filename="src/file-1.ts"]');
    expect(section).not.toBeNull();
    if (!section) {
      throw new Error("Missing collapsed section");
    }
    const panel = within(section).getByRole("region", { hidden: true });
    expect(panel.hidden).toBeTruthy();
  });

  it("forwards gutter clicks into the inline comment input", async () => {
    const props = makeProps(2);
    render(<DiffViewer {...props} />);

    await screen.findAllByTestId("patch-viewer");

    const section = document.querySelector<HTMLElement>('[data-filename="src/file-1.ts"]');
    expect(section).not.toBeNull();
    if (!section) {
      throw new Error("Missing section");
    }

    fireEvent.click(within(section).getByTitle("Add comment for AI"));
    await expect(
      within(section).findByPlaceholderText("Add a comment for the AI"),
    ).resolves.toBeTruthy();
  });

  it("renders existing comments as annotations", async () => {
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

    await expect(screen.findByText("Look here")).resolves.toBeTruthy();
  });
});
