"use client";

import { DEFAULT_DIFF_THEMES, DEFAULT_DISPLAY_SETTINGS } from "@diffhub/diff-core";
import type { DiffThemeSelection, DisplaySettings } from "@diffhub/diff-core";
import { FileDiffHeader, StatusBar } from "@diffhub/diff-core/react";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashCanIcon,
} from "blode-icons-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import {
  BASE_BRANCH,
  BRANCH,
  FILE,
  HUNK,
  PR_NUMBER,
  PR_PATH,
  PR_TITLE,
  TREE_FILES,
} from "@/components/marketing/review-demo-hunk";
import type { DiffLine, LineKind } from "@/components/marketing/review-demo-hunk";
import { TrackedCta } from "@/components/tracked-cta";
import { captureConversion } from "@/lib/conversion-events";
import { formatReviewPrompt } from "@/lib/review-prompt";
import type { ReviewComment, ReviewSide } from "@/lib/review-prompt";
import { cn } from "@/lib/utils";

/**
 * The landing page's signature moment: the DiffHub viewer, on a real hunk from
 * mblode/diffhub #52. The toolbar and file header are the shared chrome from
 * `@diffhub/diff-core`, the same components `apps/cli` renders, styled by the
 * `.diffhub-app` palette. The tree and the diff body are static markup because
 * the real ones (`@pierre/trees`, CodeView) only mount on the client; the
 * prompt is built by `formatReviewPrompt`, which a test holds to the CLI's own
 * `exportCommentsAsPrompt`.
 *
 * Server-rendered with one example comment, so the toolbar, tree, diff and
 * prompt are all in the first paint. Nothing animates on mount.
 */

const MONO = "[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]";

interface RowStyle {
  bar: string;
  code: string;
  glyph: string;
  gutter: string;
  label: string;
}

/** Row and gutter tints read from the viewer's rendered Linear Dark diff. */
const ROW: Record<LineKind, RowStyle> = {
  add: {
    bar: "shadow-[inset_2px_0_0_#5ecc71]",
    code: "bg-[#293932]",
    glyph: "+",
    gutter: "bg-[#25312e] text-[#5ecc71]",
    label: "Added",
  },
  context: { bar: "", code: "", glyph: " ", gutter: "text-[#9697a1]", label: "" },
  del: {
    bar: "shadow-[inset_2px_0_0_#ff6762]",
    code: "bg-[#432a2f]",
    glyph: "-",
    gutter: "bg-[#39262c] text-[#ff6762]",
    label: "Removed",
  },
};

interface DemoComment extends ReviewComment {
  id: string;
}

interface Anchor {
  lineNumber: number;
  side: ReviewSide;
}

/** A deleted line is commented on the old side, everything else on the new. */
const anchorFor = (line: DiffLine): Anchor =>
  line.kind === "del"
    ? { lineNumber: line.oldNumber ?? 0, side: "left" }
    : { lineNumber: line.newNumber ?? 0, side: "right" };

const keyFor = ({ lineNumber, side }: Anchor) => `${side}:${lineNumber}`;

const describe = ({ lineNumber, side }: Anchor) =>
  `${side === "left" ? "old" : "new"} line ${lineNumber}`;

/** One row of the split view: an old-side cell and a new-side cell. */
interface SplitRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

/** Pair each run of removed lines with the added lines that follow it. */
const toSplitRows = (lines: readonly DiffLine[]): SplitRow[] => {
  const rows: SplitRow[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.kind === "context") {
      rows.push({ left: line, right: line });
      index += 1;
      continue;
    }
    const removed: DiffLine[] = [];
    const added: DiffLine[] = [];
    while (index < lines.length && lines[index].kind === "del") {
      removed.push(lines[index]);
      index += 1;
    }
    while (index < lines.length && lines[index].kind === "add") {
      added.push(lines[index]);
      index += 1;
    }
    const count = Math.max(removed.length, added.length);
    for (let row = 0; row < count; row += 1) {
      rows.push({ left: removed[row] ?? null, right: added[row] ?? null });
    }
  }
  return rows;
};

const SPLIT_ROWS = toSplitRows(HUNK);

const sumOf = (values: number[]): number => {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
};

const TOTALS = {
  deletions: sumOf(TREE_FILES.map((file) => file.deletions)),
  insertions: sumOf(TREE_FILES.map((file) => file.insertions)),
};

const SEED: DemoComment[] = [
  {
    body: "Should file-level comments name a side too?",
    file: FILE,
    id: "seed",
    lineNumber: 10,
    side: "right",
    tag: "",
  },
];

const FILE_STAT = {
  deletions: HUNK.filter((line) => line.kind === "del").length,
  insertions: HUNK.filter((line) => line.kind === "add").length,
};

type CopyStatus = "copied" | "failed" | "idle";

const COPY_MESSAGE: Record<CopyStatus, string> = {
  copied: "Prompt copied to clipboard",
  failed: "Couldn’t copy. Select the prompt text and copy it manually.",
  idle: "",
};

const splitPath = (path: string) => {
  const slash = path.lastIndexOf("/");
  return slash === -1
    ? { dir: "", name: path }
    : { dir: path.slice(0, slash), name: path.slice(slash + 1) };
};

/** The sidebar's file tree, grouped by folder, with the shared sidebar tokens. */
const FileTree = ({ query }: { query: string }): React.JSX.Element => {
  const needle = query.trim().toLowerCase();
  const visible = TREE_FILES.filter((file) => file.path.toLowerCase().includes(needle));
  const groups = new Map<string, typeof TREE_FILES>();
  for (const file of visible) {
    const { dir } = splitPath(file.path);
    groups.set(dir, [...(groups.get(dir) ?? []), file]);
  }

  if (visible.length === 0) {
    return <p className="px-4 py-8 text-center text-sidebar-foreground/50 text-xs">No matches</p>;
  }

  return (
    <ul className="py-1 text-[12px]">
      {[...groups].map(([dir, files]) => (
        <li key={dir}>
          {dir ? (
            <p className="flex h-7 items-center gap-1.5 px-2 text-sidebar-foreground/55">
              <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{dir}</span>
            </p>
          ) : null}
          <ul>
            {files.map((file) => {
              const { name } = splitPath(file.path);
              const selected = file.path === FILE;
              const added = file.deletions === 0;
              const row = cn(
                "flex h-7 w-full items-center gap-2 pr-3 text-left",
                dir ? "pl-7" : "pl-3",
                selected
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50",
              );
              const content = (
                <>
                  <span className={cn("min-w-0 flex-1 truncate", added && "text-diff-green")}>
                    {name}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "font-mono text-[10px]",
                      added ? "text-diff-green" : "opacity-60",
                    )}
                  >
                    {added ? "A" : "M"}
                  </span>
                </>
              );
              return (
                <li key={file.path}>
                  {selected ? (
                    <span aria-current="true" className={row}>
                      {content}
                    </span>
                  ) : (
                    <TrackedCta
                      className={row}
                      href={PR_PATH}
                      label={`Open ${file.path} in the demo PR`}
                      opensDemo
                    >
                      {content}
                    </TrackedCta>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
};

const Sidebar = (): React.JSX.Element => {
  const [query, setQuery] = useState("");
  const filterId = useId();
  return (
    <aside
      aria-label="Changed files"
      className="hidden w-60 shrink-0 flex-col border-sidebar-border border-r bg-sidebar text-sidebar-foreground md:flex"
    >
      <div className="flex h-[52px] items-center border-sidebar-border border-b px-2">
        <div className="relative flex w-full items-center">
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 size-3 text-sidebar-foreground/40"
          />
          <label className="sr-only" htmlFor={filterId}>
            Filter files
          </label>
          <input
            className="w-full rounded-md border border-sidebar-border bg-sidebar-accent py-1.5 pr-7 pl-7 text-sidebar-foreground text-xs transition-colors placeholder:text-sidebar-foreground/40 focus:border-sidebar-ring/50 focus:outline-none"
            id={filterId}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter files…"
            type="text"
            value={query}
          />
        </div>
      </div>
      <nav aria-label="Files in this pull request" className="min-h-0 flex-1 overflow-y-auto">
        <FileTree query={query} />
      </nav>
      <div className="border-sidebar-border border-t">
        <p className="flex h-9 items-center gap-2 px-3 font-medium text-[12px] text-sidebar-foreground/80">
          Diff stats
        </p>
        <dl className="pb-1 text-[12px]">
          {[
            ["Files", String(TREE_FILES.length), ""],
            ["Additions", `+${TOTALS.insertions}`, "text-diff-green"],
            ["Deletions", `−${TOTALS.deletions}`, "text-destructive"],
            ["Lines", String(TOTALS.insertions + TOTALS.deletions), ""],
          ].map(([label, value, tone]) => (
            <div className="flex items-center justify-between px-3 py-1" key={label}>
              <dt className="text-sidebar-foreground/60">{label}</dt>
              <dd className={cn("font-mono tabular-nums", tone)}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
};

export const ReviewDemo = (): React.JSX.Element => {
  const [comments, setComments] = useState<DemoComment[]>(SEED);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState(false);
  const [copy, setCopy] = useState<CopyStatus>("idle");
  const [layout, setLayout] = useState<"split" | "stacked">("stacked");
  const [collapsed, setCollapsed] = useState(false);
  const [display, setDisplay] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
  // Held so the picker works, but the static hunk is always Linear Dark.
  const [themes, setThemes] = useState<DiffThemeSelection>(DEFAULT_DIFF_THEMES);
  const nextId = useRef(0);
  const lineButtons = useRef(new Map<string, HTMLButtonElement>());
  const textarea = useRef<HTMLTextAreaElement>(null);
  const formId = useId();

  const prompt = formatReviewPrompt(comments);
  const split = layout === "split";

  useEffect(() => {
    if (openKey !== null) {
      textarea.current?.focus();
    }
  }, [openKey]);

  const focusLine = useCallback((key: string) => {
    requestAnimationFrame(() => lineButtons.current.get(key)?.focus());
  }, []);

  const close = useCallback(
    (key: string) => {
      setOpenKey(null);
      setBody("");
      setError(false);
      focusLine(key);
    },
    [focusLine],
  );

  const toggleComposer = useCallback(
    (key: string) => {
      if (openKey === key) {
        close(key);
        return;
      }
      setOpenKey(key);
      setBody("");
      setError(false);
    },
    [close, openKey],
  );

  const submit = useCallback(
    (anchor: Anchor) => {
      const text = body.trim();
      if (text === "") {
        setError(true);
        textarea.current?.focus();
        return;
      }
      nextId.current += 1;
      setComments((current) => [
        ...current,
        { ...anchor, body: text, file: FILE, id: `c${nextId.current}`, tag: "" },
      ]);
      setCopiedPrompt(null);
      setCopy("idle");
      close(keyFor(anchor));
    },
    [body, close],
  );

  const remove = useCallback(
    (comment: DemoComment) => {
      setComments((current) => current.filter((item) => item.id !== comment.id));
      setCopy("idle");
      focusLine(keyFor(comment));
    },
    [focusLine],
  );

  // Like the real toolbar button: copy the prompt, then clear the list.
  const copyAndClear = useCallback(async () => {
    captureConversion({ href: "#review-demo", label: "Copy demo prompt" });
    try {
      await navigator.clipboard.writeText(prompt);
      setCopy("copied");
      setCopiedPrompt(prompt);
      setComments([]);
    } catch {
      setCopy("failed");
    }
  }, [prompt]);

  const expandAll = useCallback(() => setCollapsed(false), []);
  const collapseAll = useCallback(() => setCollapsed(true), []);
  const toggleCollapsed = useCallback(() => setCollapsed((current) => !current), []);

  const renderCell = (line: DiffLine | null, anchored: boolean, side: "both" | ReviewSide) => {
    if (line === null) {
      return <div aria-hidden="true" className={cn("grid grid-cols-[3.5rem_minmax(0,1fr)]")} />;
    }
    const anchor = anchorFor(line);
    const key = keyFor(anchor);
    const isOpen = openKey === key;
    const style = ROW[line.kind];
    const number = side === "left" ? line.oldNumber : (line.newNumber ?? line.oldNumber);
    const tints = display.showBackgrounds;
    const bars = display.diffIndicators === "bars";
    return (
      <div
        className={cn(
          "group/line grid min-w-0",
          display.showLineNumbers
            ? "grid-cols-[3.5rem_minmax(0,1fr)]"
            : "grid-cols-[1.75rem_minmax(0,1fr)]",
        )}
      >
        <div
          className={cn(
            "relative select-none pr-3 text-right",
            tints ? style.gutter : "text-[#9697a1]",
            bars && style.bar,
          )}
        >
          {anchored ? (
            <button
              aria-expanded={isOpen}
              aria-label={`Comment on ${describe(anchor)}`}
              className={cn(
                "absolute top-0 left-1 inline-flex size-5 items-center justify-center rounded-[4px] bg-[#7e7fff] text-white opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-1 group-hover/line:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100",
                "after:absolute after:-inset-x-1 after:-inset-y-1 after:content-['']",
                isOpen && "opacity-100",
              )}
              onClick={() => toggleComposer(key)}
              ref={(node) => {
                if (node) {
                  lineButtons.current.set(key, node);
                } else {
                  lineButtons.current.delete(key);
                }
              }}
              type="button"
            >
              <PlusIcon aria-hidden="true" className="size-3.5" />
            </button>
          ) : null}
          {display.showLineNumbers ? <span aria-hidden="true">{number}</span> : null}
        </div>
        <code
          className={cn(
            "pr-4 pl-3 [font-family:inherit]",
            display.wordWrap ? "whitespace-pre-wrap [overflow-wrap:anywhere]" : "whitespace-pre",
            tints && style.code,
          )}
        >
          {style.label ? <span className="sr-only">{style.label}: </span> : null}
          {display.diffIndicators === "classic" ? (
            <span aria-hidden="true" className="select-none opacity-70">
              {style.glyph}
            </span>
          ) : null}
          {line.tokens.map(([text, color], index) => (
            // Static tokens that never reorder, so the position is the identity.
            // oxlint-disable-next-line react/no-array-index-key
            <span key={index} style={color ? { color } : undefined}>
              {text}
            </span>
          ))}
        </code>
      </div>
    );
  };

  const renderAnnotations = (anchor: Anchor) => {
    const key = keyFor(anchor);
    const lineComments = comments.filter((comment) => keyFor(comment) === key);
    const where = describe(anchor);
    return (
      <>
        {lineComments.map((comment) => (
          <div
            className="group/comment mx-4 my-1 overflow-hidden rounded-md border border-white/10 border-l-2 border-l-[#737373]/60 bg-[#171717] font-sans"
            key={comment.id}
          >
            <div className="flex items-start gap-2 px-3 py-2.5">
              <p className="min-w-0 flex-1 text-pretty text-sm leading-relaxed">{comment.body}</p>
              <button
                aria-label={`Remove comment on ${where}`}
                className="relative shrink-0 rounded p-1 text-[#a1a1a1] opacity-0 transition-[opacity,color,background-color] after:absolute after:-inset-1.5 after:content-[''] hover:bg-[#ff6762]/10 hover:text-[#ff6762] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white group-hover/comment:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
                onClick={() => remove(comment)}
                type="button"
              >
                <TrashCanIcon aria-hidden="true" className="size-3.5" />
              </button>
            </div>
            <p className="border-white/5 border-t px-3 py-1 text-[#a1a1a1] text-[10px]">
              L{comment.lineNumber} · {comment.side === "left" ? "old" : "new"} side
            </p>
          </div>
        ))}

        {openKey === key ? (
          <form
            aria-label={`Comment on ${where}`}
            className="mx-4 my-1 rounded-md border border-white/10 bg-[#0a0a0a] p-3 font-sans text-sm focus-within:border-white/25"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              submit(anchor);
            }}
          >
            <label className="sr-only" htmlFor={`${formId}-body`}>
              Comment on {where}
            </label>
            <textarea
              aria-describedby={error ? `${formId}-error` : undefined}
              aria-invalid={error}
              className="block w-full resize-none bg-transparent text-base placeholder:text-[#a1a1a1] focus-visible:outline-none sm:text-sm"
              id={`${formId}-body`}
              onChange={(event) => {
                setBody(event.target.value);
                setError(false);
              }}
              onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  close(key);
                } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  submit(anchor);
                }
              }}
              placeholder="Add a comment for the AI"
              ref={textarea}
              rows={3}
              value={body}
            />
            {error ? (
              <p className="mt-2 text-[#ff6762] text-xs" id={`${formId}-error`}>
                Write a comment first.
              </p>
            ) : null}
            <div className="mt-2 flex justify-end gap-2">
              <button
                className="min-h-9 rounded-md px-3 text-[#a1a1a1] transition-colors hover:bg-white/10 hover:text-[#fafafa] focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none"
                onClick={() => close(key)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="min-h-9 rounded-md bg-[#fafafa] px-3 font-medium text-[#171717] transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 motion-reduce:transition-none"
                type="submit"
              >
                Comment
              </button>
            </div>
          </form>
        ) : null}
      </>
    );
  };

  const shownPrompt = comments.length > 0 ? prompt : copiedPrompt;

  return (
    <div
      className="diffhub-app overflow-hidden rounded-xl text-foreground shadow-[0_32px_100px_rgba(0,0,0,0.45)] outline-1 -outline-offset-1 outline-white/10"
      id="review-demo"
    >
      <header className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-border border-b bg-card px-4 py-2 text-sm">
        <h2 className="min-w-0 font-medium text-sm">
          {PR_TITLE} <span className="font-normal text-muted-foreground">#{PR_NUMBER}</span>
        </h2>
        <span className="rounded-full bg-diff-green/15 px-2 py-0.5 font-medium text-[11px] text-diff-green">
          Open
        </span>
        <p className="flex min-w-0 items-center gap-1.5 font-mono text-muted-foreground text-xs">
          <span className="rounded-md border border-border px-1.5 py-0.5">{BASE_BRANCH}</span>
          <ArrowRightIcon aria-hidden="true" className="size-3 shrink-0 opacity-60" />
          <span className="min-w-0 truncate rounded-md border border-border px-1.5 py-0.5 text-foreground">
            {BRANCH}
          </span>
        </p>
      </header>

      <div className="flex bg-background">
        <Sidebar />

        <div className="min-w-0 flex-1">
          {/* Scrolls sideways on the narrowest screens rather than clipping a control. */}
          <div className="overflow-x-auto">
            <StatusBar
              allCollapsed={collapsed}
              commentCount={comments.length}
              diffThemes={themes}
              displaySettings={display}
              layout={layout}
              onCollapseAll={collapseAll}
              onCopyComments={copyAndClear}
              onDiffThemesChange={setThemes}
              onDisplaySettingsChange={setDisplay}
              onExpandAll={expandAll}
              onLayoutChange={setLayout}
              showSidebarTrigger={false}
            />
          </div>

          <FileDiffHeader
            collapsed={collapsed}
            deletions={FILE_STAT.deletions}
            file={FILE}
            insertions={FILE_STAT.insertions}
            commentCount={comments.length}
            onToggleCollapse={toggleCollapsed}
          />

          {collapsed ? null : (
            <section
              aria-label={`Diff of ${FILE}`}
              className={cn(
                "bg-[#191a23] pb-2 text-[#e5e6ef] text-[13px] leading-5",
                display.wordWrap ? "" : "overflow-x-auto",
                MONO,
              )}
            >
              <p className="m-1.5 rounded-sm bg-[#36373f] px-2 py-1 font-sans text-[#c4c5cc] text-xs">
                6 unmodified lines
              </p>
              {split
                ? SPLIT_ROWS.map(({ left, right }) => {
                    const key = [left, right]
                      .map((line) => (line ? keyFor(anchorFor(line)) : "-"))
                      .join("|");
                    const anchors = [left, right].flatMap((line, index) =>
                      line && (line.kind !== "context" || index === 1) ? [anchorFor(line)] : [],
                    );
                    return (
                      <div key={key}>
                        <div className="grid grid-cols-2 divide-x divide-white/10">
                          {renderCell(left, left?.kind === "del", "left")}
                          {renderCell(right, right !== null, "right")}
                        </div>
                        {anchors.map((anchor) => (
                          <div key={keyFor(anchor)}>{renderAnnotations(anchor)}</div>
                        ))}
                      </div>
                    );
                  })
                : HUNK.map((line) => {
                    const anchor = anchorFor(line);
                    return (
                      <div key={keyFor(anchor)}>
                        {renderCell(line, true, "both")}
                        {renderAnnotations(anchor)}
                      </div>
                    );
                  })}
            </section>
          )}

          <div className="border-border border-t bg-card">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <p className="text-sm">
                Agent prompt{" "}
                <span className="text-muted-foreground">
                  · {comments.length} {comments.length === 1 ? "comment" : "comments"}
                </span>
              </p>
              <output aria-live="polite" className="text-muted-foreground text-xs">
                {COPY_MESSAGE[copy]}
              </output>
            </div>
            {shownPrompt === null ? (
              <p className="px-4 pb-4 text-muted-foreground text-sm">
                Press + beside any line number to leave a comment. Copy them from the toolbar and
                each one becomes a line of the prompt.
              </p>
            ) : (
              <section
                aria-label="Agent prompt"
                className="max-h-56 overflow-y-auto px-4 pb-4 focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2"
                // A named region, focusable so the prompt can be scrolled from the
                // keyboard once it outgrows its max height.
                // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
              >
                <pre
                  className={cn(
                    "whitespace-pre-wrap text-[#e5e6ef]/80 text-[13px] leading-6 [overflow-wrap:anywhere]",
                    MONO,
                  )}
                >
                  {shownPrompt}
                </pre>
              </section>
            )}
            <div className="border-border border-t px-4 py-3">
              <TrackedCta
                className="inline-flex items-center gap-1.5 text-muted-foreground text-sm underline decoration-white/25 underline-offset-4 hover:text-foreground hover:decoration-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                href={PR_PATH}
                label="Open demo PR"
                opensDemo
              >
                See the whole pull request in DiffHub
                <ArrowRightIcon aria-hidden="true" className="size-3.5 shrink-0" />
              </TrackedCta>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
