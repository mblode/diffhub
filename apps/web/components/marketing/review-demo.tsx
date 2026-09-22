"use client";

import { ArrowRightIcon, PlusIcon } from "blode-icons-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { TrackedCta } from "@/components/tracked-cta";
import { captureConversion } from "@/lib/conversion-events";
import { formatReviewPrompt } from "@/lib/review-prompt";
import type { ReviewComment, ReviewSide, ReviewTag } from "@/lib/review-prompt";
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

const FILE = "apps/cli/lib/export-comments.ts";
const PR_PATH = "/mblode/diffhub/pull/52";

type LineKind = "add" | "context" | "del";

interface DiffLine {
  kind: LineKind;
  newNumber: number | null;
  oldNumber: number | null;
  text: string;
}

// Verbatim from `git show afe7d53 -- apps/cli/lib/export-comments.ts`. The
// hunk is set in the system monospace stack, not Glide Mono, because Glide
// Mono's backtick has zero advance width and eats the space beside it.
/* oxlint-disable no-template-curly-in-string -- these are lines of source code, not templates */
const HUNK: DiffLine[] = [
  { kind: "context", newNumber: 7, oldNumber: 7, text: "  const lines = comments.map((c) => {" },
  {
    kind: "context",
    newNumber: 8,
    oldNumber: 8,
    text: '    const tag = c.tag ? `${c.tag} ` : "";',
  },
  {
    kind: "context",
    newNumber: 9,
    oldNumber: 9,
    text: '    const loc = c.lineNumber > 0 ? `:${c.lineNumber}` : "";',
  },
  {
    kind: "del",
    newNumber: null,
    oldNumber: 10,
    text: "    return `- ${tag}**${c.file}${loc}**: ${c.body}`;",
  },
  {
    kind: "add",
    newNumber: 10,
    oldNumber: null,
    text: '    const side = c.lineNumber > 0 ? ` (${c.side === "left" ? "old" : "new"} side)` : "";',
  },
  {
    kind: "add",
    newNumber: 11,
    oldNumber: null,
    text: "    return `- ${tag}**${c.file}${loc}**${side}: ${c.body}`;",
  },
  { kind: "context", newNumber: 12, oldNumber: 11, text: "  });" },
  {
    kind: "context",
    newNumber: 13,
    oldNumber: 12,
    text: '  return `## Code Review Comments\\n\\nPlease address the following:\\n\\n${lines.join("\\n")}`;',
  },
  { kind: "context", newNumber: 14, oldNumber: 13, text: "};" },
];
/* oxlint-enable no-template-curly-in-string */

const MARKER: Record<LineKind, string> = { add: "+", context: "", del: "−" };

const TAGS: { label: string; value: ReviewTag }[] = [
  { label: "No label", value: "" },
  { label: "must-fix", value: "[must-fix]" },
  { label: "suggestion", value: "[suggestion]" },
  { label: "nit", value: "[nit]" },
  { label: "question", value: "[question]" },
];

const TAG_COLOUR: Record<ReviewTag, { border: string; text: string }> = {
  "": { border: "border-white/30", text: "text-white/60" },
  "[must-fix]": { border: "border-[#ff8b5c]", text: "text-[#ff8b5c]" },
  "[nit]": { border: "border-white/40", text: "text-white/70" },
  "[question]": { border: "border-[#ffd479]", text: "text-[#ffd479]" },
  "[suggestion]": { border: "border-[#8be9a8]", text: "text-[#8be9a8]" },
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
    tag: "[question]",
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
  const [tag, setTag] = useState<ReviewTag>("");
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
      setTag("");
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
      setTag("");
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
        { ...anchor, body: text, file: FILE, id: `c${nextId.current}`, tag },
      ]);
      setCopy("idle");
      close(keyFor(anchor.side, anchor.lineNumber));
    },
    [body, close, tag],
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
      className="overflow-hidden rounded-2xl bg-[#1b1b19] text-[#f7f7f4] shadow-[0_32px_100px_rgba(0,0,0,0.45)] outline-1 -outline-offset-1 outline-white/12"
      id="review-demo"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-white/10 border-b px-4 py-3 font-mono text-sm">
        <p className="min-w-0 truncate">{FILE}</p>
        <p className="shrink-0 text-white/50">
          <span className="text-[#8be9a8]">+2</span> <span className="text-[#ff8b5c]">−1</span>
        </p>
      </div>

      <section
        aria-label={`Diff of ${FILE}`}
        className="py-2 [font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace] text-[13px] leading-6"
      >
        <p className="px-4 pb-1 text-white/40">
          @@ -7,7 +7,8 @@ export const exportCommentsAsPrompt
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
              <div
                className={cn(
                  "grid grid-cols-[2.25rem_1.75rem_1.75rem_1rem_minmax(0,1fr)] items-start",
                  line.kind === "add" && "bg-[#183923] text-[#b9f6ca]",
                  line.kind === "del" && "bg-[#3d1f1a] text-[#ffc9bd]",
                  line.kind === "context" && "text-white/75",
                )}
              >
                <button
                  aria-expanded={isOpen}
                  aria-label={`Comment on ${where}`}
                  className={cn(
                    "mx-1 my-0.5 inline-flex size-5 items-center justify-center rounded-md bg-white/8 text-white/55 transition-colors hover:bg-[#f54e00] hover:text-[#151611] focus-visible:bg-[#f54e00] focus-visible:text-[#151611] focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-1",
                    "relative after:absolute after:-inset-x-2 after:-inset-y-1 after:content-['']",
                    isOpen && "bg-[#f54e00] text-[#151611]",
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
                <span aria-hidden="true" className="select-none text-right text-white/35">
                  {line.oldNumber ?? ""}
                </span>
                <span aria-hidden="true" className="select-none text-right text-white/35">
                  {line.newNumber ?? ""}
                </span>
                <span aria-hidden="true" className="select-none text-center text-white/45">
                  {MARKER[line.kind]}
                </span>
                <code className="whitespace-pre-wrap pr-4 [font-family:inherit] [overflow-wrap:anywhere]">
                  {line.text}
                </code>
              </div>

              {lineComments.map((comment) => (
                <div
                  className={cn(
                    "mx-3 my-2 flex items-start justify-between gap-3 rounded-lg border-l-2 bg-white/6 py-2 pr-2 pl-3 font-sans text-sm leading-5",
                    TAG_COLOUR[comment.tag].border,
                  )}
                  key={comment.id}
                >
                  <p className="min-w-0 text-pretty">
                    {comment.tag ? (
                      <span className={cn("mr-2 font-mono", TAG_COLOUR[comment.tag].text)}>
                        {comment.tag.slice(1, -1)}
                      </span>
                    ) : null}
                    {comment.body}
                  </p>
                  <button
                    aria-label={`Remove comment on ${where}`}
                    className="shrink-0 rounded-md px-2 py-0.5 text-white/50 text-xs transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                    onClick={() => remove(comment)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}

              {isOpen ? (
                <form
                  aria-label={`Comment on ${where}`}
                  className="mx-3 my-2 rounded-lg bg-white/6 p-3 font-sans text-sm"
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    submit(anchor);
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-white/60" htmlFor={`${formId}-tag`}>
                      Label
                    </label>
                    <select
                      className="min-h-9 rounded-md bg-[#151611] px-2 font-mono text-sm outline-1 -outline-offset-1 outline-white/15 focus-visible:outline-2 focus-visible:outline-[#f54e00]"
                      id={`${formId}-tag`}
                      onChange={(event) => setTag(event.target.value as ReviewTag)}
                      value={tag}
                    >
                      {TAGS.map((option) => (
                        <option key={option.label} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="sr-only" htmlFor={`${formId}-body`}>
                    Comment on {where}
                  </label>
                  <textarea
                    aria-describedby={error ? `${formId}-error` : undefined}
                    aria-invalid={error}
                    className="mt-2 block w-full resize-y rounded-md bg-[#151611] px-3 py-2 text-base outline-1 -outline-offset-1 outline-white/15 placeholder:text-white/35 focus-visible:outline-2 focus-visible:outline-[#f54e00] sm:text-sm"
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
                    placeholder="What should the agent change?"
                    ref={textarea}
                    rows={2}
                    value={body}
                  />
                  {error ? (
                    <p className="mt-2 text-[#ff8b5c]" id={`${formId}-error`}>
                      Write a comment first.
                    </p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      className="min-h-9 rounded-full bg-[#f54e00] px-4 font-medium text-[#151611] transition-colors hover:bg-[#ff6a1f] focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                      type="submit"
                    >
                      Add comment
                    </button>
                    <button
                      className="min-h-9 rounded-full px-4 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                      onClick={() => close(key)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          );
        })}
      </section>

      <div className="border-white/10 border-t bg-[#151611]">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <p className="font-mono text-sm">
            Agent prompt{" "}
            <span className="text-white/45">
              · {comments.length} {comments.length === 1 ? "comment" : "comments"}
            </span>
          </p>
          <output aria-live="polite" className="sr-only">
            {COPY_MESSAGE[copy]}
          </output>
          <button
            className={cn(
              "min-h-9 min-w-[7.5rem] shrink-0 rounded-full px-4 font-medium text-sm transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
              copy === "failed"
                ? "bg-[#3d1f1a] text-[#ffc9bd]"
                : "bg-[#f7f7f4] text-[#151611] hover:bg-white",
            )}
            disabled={comments.length === 0}
            onClick={copyPrompt}
            type="button"
          >
            {COPY_LABEL[copy]}
          </button>
        </div>
        {comments.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-white/55">
            Press + on any line to leave a comment. Each one becomes a line of the prompt.
          </p>
        ) : (
          <pre
            aria-label="Agent prompt"
            // Focusable so the prompt can be scrolled from the keyboard once it
            // outgrows its max height.
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            className="max-h-56 overflow-y-auto whitespace-pre-wrap px-4 pb-4 [font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace] text-[13px] text-white/80 leading-6 [overflow-wrap:anywhere]"
          >
            {prompt}
          </pre>
        )}
        <div className="border-white/10 border-t px-4 py-3">
          <TrackedCta
            className="inline-flex items-center gap-1.5 text-sm text-white/60 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
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
