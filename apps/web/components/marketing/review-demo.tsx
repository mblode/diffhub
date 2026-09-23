"use client";

import {
  ArrowRightIcon,
  ChevronDownIcon,
  CircleDotsCenter1Icon,
  PlusIcon,
  TrashCanIcon,
} from "blode-icons-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { TrackedCta } from "@/components/tracked-cta";
import { captureConversion } from "@/lib/conversion-events";
import { formatReviewPrompt } from "@/lib/review-prompt";
import type { ReviewComment, ReviewSide } from "@/lib/review-prompt";
import { cn } from "@/lib/utils";

/**
 * The landing page's signature moment: a real hunk from mblode/diffhub #52,
 * the commit that added the diff side to review prompts. Comment on a line and
 * the prompt underneath is rebuilt by `formatReviewPrompt`, which a test holds
 * to the CLI's own `exportCommentsAsPrompt`, so what you copy here is what the
 * product copies.
 *
 * Server-rendered with one example comment so the prompt is never empty on
 * first paint, and nothing animates on mount.
 */

const FILE_DIR = "apps/cli/lib/";
const FILE_NAME = "export-comments.ts";
const FILE = `${FILE_DIR}${FILE_NAME}`;
const BRANCH = "fix/review-comment-side";
const PR_PATH = "/mblode/diffhub/pull/52";

type LineKind = "add" | "context" | "del";

/** A run of source text and its Linear Dark colour; no colour is the theme's foreground. */
type Token = readonly [text: string, color?: string];

interface DiffLine {
  kind: LineKind;
  newNumber: number | null;
  oldNumber: number | null;
  tokens: Token[];
}

// Verbatim from `git show afe7d53 -- apps/cli/lib/export-comments.ts`, split
// into the tokens Shiki produces with packages/diff-core/src/themes/linear-dark.json,
// the theme the viewer itself renders with. Set in the system monospace stack,
// not Glide Mono, because Glide Mono's backtick has zero advance width and eats
// the space beside it.
const PINK = "#fa9ce3";
const PURPLE = "#cc9dff";
const BLUE = "#8fa7ff";
const ORANGE = "#fac08a";
const TEAL = "#7fdede";
const YELLOW = "#ffe09e";

/* oxlint-disable no-template-curly-in-string -- these are lines of source code, not templates */
const HUNK: DiffLine[] = [
  {
    kind: "context",
    newNumber: 7,
    oldNumber: 7,
    tokens: [
      ["  "],
      ["const ", PINK],
      ["lines", BLUE],
      [" = "],
      ["comments", ORANGE],
      ["."],
      ["map", TEAL],
      ["(("],
      ["c", ORANGE],
      [") "],
      ["=>", PINK],
      [" {"],
    ],
  },
  {
    kind: "context",
    newNumber: 8,
    oldNumber: 8,
    tokens: [
      ["    "],
      ["const ", PINK],
      ["tag", BLUE],
      [" = "],
      ["c", ORANGE],
      ["."],
      ["tag", ORANGE],
      [" ? "],
      ["`", YELLOW],
      ["${", PINK],
      ["c", ORANGE],
      ["."],
      ["tag", ORANGE],
      ["}", PINK],
      [" `", YELLOW],
      [" : "],
      ['""', YELLOW],
      [";"],
    ],
  },
  {
    kind: "context",
    newNumber: 9,
    oldNumber: 9,
    tokens: [
      ["    "],
      ["const ", PINK],
      ["loc", BLUE],
      [" = "],
      ["c", ORANGE],
      ["."],
      ["lineNumber", ORANGE],
      [" > "],
      ["0", TEAL],
      [" ? "],
      ["`:", YELLOW],
      ["${", PINK],
      ["c", ORANGE],
      ["."],
      ["lineNumber", ORANGE],
      ["}", PINK],
      ["`", YELLOW],
      [" : "],
      ['""', YELLOW],
      [";"],
    ],
  },
  {
    kind: "del",
    newNumber: null,
    oldNumber: 10,
    tokens: [
      ["    "],
      ["return ", PURPLE],
      ["`- ", YELLOW],
      ["${", PINK],
      ["tag", ORANGE],
      ["}", PINK],
      ["**", YELLOW],
      ["${", PINK],
      ["c", ORANGE],
      ["."],
      ["file", ORANGE],
      ["}${", PINK],
      ["loc", ORANGE],
      ["}", PINK],
      ["**: ", YELLOW],
      ["${", PINK],
      ["c", ORANGE],
      ["."],
      ["body", ORANGE],
      ["}", PINK],
      ["`", YELLOW],
      [";"],
    ],
  },
  {
    kind: "add",
    newNumber: 10,
    oldNumber: null,
    tokens: [
      ["    "],
      ["const ", PINK],
      ["side", BLUE],
      [" = "],
      ["c", ORANGE],
      ["."],
      ["lineNumber", ORANGE],
      [" > "],
      ["0", TEAL],
      [" ? "],
      ["` (", YELLOW],
      ["${", PINK],
      ["c", ORANGE],
      ["."],
      ["side", ORANGE],
      [" === "],
      ['"left"', YELLOW],
      [" ? "],
      ['"old"', YELLOW],
      [" : "],
      ['"new"', YELLOW],
      ["}", PINK],
      [" side)`", YELLOW],
      [" : "],
      ['""', YELLOW],
      [";"],
    ],
  },
  {
    kind: "add",
    newNumber: 11,
    oldNumber: null,
    tokens: [
      ["    "],
      ["return ", PURPLE],
      ["`- ", YELLOW],
      ["${", PINK],
      ["tag", ORANGE],
      ["}", PINK],
      ["**", YELLOW],
      ["${", PINK],
      ["c", ORANGE],
      ["."],
      ["file", ORANGE],
      ["}${", PINK],
      ["loc", ORANGE],
      ["}", PINK],
      ["**", YELLOW],
      ["${", PINK],
      ["side", ORANGE],
      ["}", PINK],
      [": ", YELLOW],
      ["${", PINK],
      ["c", ORANGE],
      ["."],
      ["body", ORANGE],
      ["}", PINK],
      ["`", YELLOW],
      [";"],
    ],
  },
  { kind: "context", newNumber: 12, oldNumber: 11, tokens: [["  });"]] },
  {
    kind: "context",
    newNumber: 13,
    oldNumber: 12,
    tokens: [
      ["  "],
      ["return ", PURPLE],
      ["`## Code Review Comments", YELLOW],
      ["\\n\\n", ORANGE],
      ["Please address the following:", YELLOW],
      ["\\n\\n", ORANGE],
      ["${", PINK],
      ["lines", ORANGE],
      ["."],
      ["join", TEAL],
      ["("],
      ['"', YELLOW],
      ["\\n", ORANGE],
      ['"', YELLOW],
      [")"],
      ["}", PINK],
      ["`", YELLOW],
      [";"],
    ],
  },
  { kind: "context", newNumber: 14, oldNumber: 13, tokens: [["};"]] },
];
/* oxlint-enable no-template-curly-in-string */

const MONO = "[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]";

/** Row and gutter tints read from the viewer's rendered Linear Dark diff. */
const ROW: Record<LineKind, { code: string; gutter: string; label: string }> = {
  add: {
    code: "bg-[#293932]",
    gutter: "bg-[#25312e] text-[#5ecc71] shadow-[inset_2px_0_0_#5ecc71]",
    label: "Added",
  },
  context: { code: "", gutter: "text-[#9697a1]", label: "" },
  del: {
    code: "bg-[#432a2f]",
    gutter: "bg-[#39262c] text-[#ff6762] shadow-[inset_2px_0_0_#ff6762]",
    label: "Removed",
  },
};

interface DemoComment extends ReviewComment {
  id: string;
}

/** A deleted line is commented on the old side, everything else on the new. */
const anchorFor = (line: DiffLine): { lineNumber: number; side: ReviewSide } =>
  line.kind === "del"
    ? { lineNumber: line.oldNumber ?? 0, side: "left" }
    : { lineNumber: line.newNumber ?? 0, side: "right" };

const keyFor = (side: ReviewSide, lineNumber: number) => `${side}:${lineNumber}`;

const describe = (side: ReviewSide, lineNumber: number) =>
  `${side === "left" ? "old" : "new"} line ${lineNumber}`;

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

type CopyStatus = "copied" | "failed" | "idle";

const COPY_LABEL: Record<CopyStatus, string> = {
  copied: "Copied",
  failed: "Couldn’t copy",
  idle: "Copy prompt",
};

const COPY_MESSAGE: Record<CopyStatus, string> = {
  copied: "Prompt copied to clipboard",
  failed: "Couldn’t copy. Select the prompt text and copy it manually.",
  idle: "",
};

export const ReviewDemo = (): React.JSX.Element => {
  const [comments, setComments] = useState<DemoComment[]>(SEED);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState(false);
  const [copy, setCopy] = useState<CopyStatus>("idle");
  const nextId = useRef(0);
  const lineButtons = useRef(new Map<string, HTMLButtonElement>());
  const textarea = useRef<HTMLTextAreaElement>(null);
  const formId = useId();

  const prompt = formatReviewPrompt(comments);

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
    (anchor: { lineNumber: number; side: ReviewSide }) => {
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
      setCopy("idle");
      close(keyFor(anchor.side, anchor.lineNumber));
    },
    [body, close],
  );

  const remove = useCallback(
    (comment: DemoComment) => {
      setComments((current) => current.filter((item) => item.id !== comment.id));
      setCopy("idle");
      focusLine(keyFor(comment.side, comment.lineNumber));
    },
    [focusLine],
  );

  const copyPrompt = useCallback(async () => {
    captureConversion({ href: "#review-demo", label: "Copy demo prompt" });
    try {
      await navigator.clipboard.writeText(prompt);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
    setTimeout(() => setCopy("idle"), 3000);
  }, [prompt]);

  return (
    <div
      className="overflow-hidden rounded-xl bg-[#0a0a0a] text-[#fafafa] shadow-[0_32px_100px_rgba(0,0,0,0.45)] outline-1 -outline-offset-1 outline-white/10"
      id="review-demo"
    >
      <div className="flex h-11 min-w-0 items-center gap-2 border-white/10 border-b px-3 font-mono text-xs">
        <span className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[#a1a1a1]">
          main
        </span>
        <ArrowRightIcon aria-hidden="true" className="size-3 shrink-0 text-[#a1a1a1]/60" />
        <span className="min-w-0 truncate rounded-md border border-white/10 bg-white/5 px-2 py-1">
          {BRANCH}
        </span>
      </div>

      <div className="flex h-11 min-w-0 items-center gap-2 border-white/10 border-b bg-[#171717] px-3 text-xs">
        <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0 text-[#a1a1a1]" />
        <CircleDotsCenter1Icon aria-hidden="true" className="size-3.5 shrink-0 text-[#a1a1a1]" />
        <p className="min-w-0 truncate font-mono">
          <span className="text-[#a1a1a1]">{FILE_DIR}</span>
          {FILE_NAME}
        </p>
        <p className="shrink-0 font-mono">
          <span className="text-[#ff6762]">−1</span> <span className="text-[#5ecc71]">+2</span>
        </p>
      </div>

      <section
        aria-label={`Diff of ${FILE}`}
        className={cn("bg-[#191a23] pb-2 text-[#e5e6ef] text-[13px] leading-5", MONO)}
      >
        <p className="m-1.5 rounded-sm bg-[#36373f] px-2 py-1 font-sans text-[#c4c5cc] text-xs">
          6 unmodified lines
        </p>
        {HUNK.map((line) => {
          const anchor = anchorFor(line);
          const key = keyFor(anchor.side, anchor.lineNumber);
          const lineComments = comments.filter(
            (comment) => keyFor(comment.side, comment.lineNumber) === key,
          );
          const isOpen = openKey === key;
          const where = describe(anchor.side, anchor.lineNumber);

          return (
            <div key={key}>
              <div className="group/line grid grid-cols-[3.5rem_minmax(0,1fr)]">
                <div className={cn("relative select-none pr-3 text-right", ROW[line.kind].gutter)}>
                  <button
                    aria-expanded={isOpen}
                    aria-label={`Comment on ${where}`}
                    className={cn(
                      "absolute top-0 left-1 inline-flex size-5 items-center justify-center rounded-[4px] bg-[#7e7fff] text-white opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-1 group-hover/line:opacity-100 [@media(hover:none)]:opacity-100",
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
                  <span aria-hidden="true">{anchor.lineNumber}</span>
                </div>
                <code
                  className={cn(
                    "whitespace-pre-wrap pr-4 pl-3 [font-family:inherit] [overflow-wrap:anywhere]",
                    ROW[line.kind].code,
                  )}
                >
                  {ROW[line.kind].label ? (
                    <span className="sr-only">{ROW[line.kind].label}: </span>
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

              {lineComments.map((comment) => (
                <div
                  className="group/comment mx-4 my-1 overflow-hidden rounded-md border border-white/10 border-l-2 border-l-[#737373]/60 bg-[#171717] font-sans"
                  key={comment.id}
                >
                  <div className="flex items-start gap-2 px-3 py-2.5">
                    <p className="min-w-0 flex-1 text-pretty text-sm leading-relaxed">
                      {comment.body}
                    </p>
                    <button
                      aria-label={`Remove comment on ${where}`}
                      className="relative shrink-0 rounded p-1 text-[#a1a1a1] opacity-0 transition-[opacity,color,background-color] after:absolute after:-inset-1.5 after:content-[''] hover:bg-[#ff6762]/10 hover:text-[#ff6762] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white group-hover/comment:opacity-100 [@media(hover:none)]:opacity-100"
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

              {isOpen ? (
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
                      className="min-h-9 rounded-md px-3 text-[#a1a1a1] transition-colors hover:bg-white/10 hover:text-[#fafafa] focus-visible:outline-2 focus-visible:outline-white"
                      onClick={() => close(key)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="min-h-9 rounded-md bg-[#fafafa] px-3 font-medium text-[#171717] transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                      type="submit"
                    >
                      Comment
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          );
        })}
      </section>

      <div className="border-white/10 border-t">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm">
            Agent prompt{" "}
            <span className="text-[#a1a1a1]">
              · {comments.length} {comments.length === 1 ? "comment" : "comments"}
            </span>
          </p>
          <output aria-live="polite" className="sr-only">
            {COPY_MESSAGE[copy]}
          </output>
          <button
            className={cn(
              "min-h-9 min-w-[7.5rem] shrink-0 rounded-md px-3 font-medium text-sm transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
              copy === "failed"
                ? "bg-[#39262c] text-[#ff6762]"
                : "bg-[#fafafa] text-[#171717] hover:bg-white/90",
            )}
            disabled={comments.length === 0}
            onClick={copyPrompt}
            type="button"
          >
            {COPY_LABEL[copy]}
          </button>
        </div>
        {comments.length === 0 ? (
          <p className="px-4 pb-4 text-[#a1a1a1] text-sm">
            Press + beside any line number to leave a comment. Each one becomes a line of the
            prompt.
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
              {prompt}
            </pre>
          </section>
        )}
        <div className="border-white/10 border-t px-4 py-3">
          <TrackedCta
            className="inline-flex items-center gap-1.5 text-[#a1a1a1] text-sm underline decoration-white/25 underline-offset-4 hover:text-[#fafafa] hover:decoration-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
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
  );
};
