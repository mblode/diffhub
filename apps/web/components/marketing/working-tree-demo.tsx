"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";

/** The lines each simulated edit adds, in order. */
const EDITS = ["preserveReviewPosition();", "markRefreshAvailable(watcher);"] as const;

const status = {
  changed: { dot: "bg-[#ffd479]", label: "Updates available" },
  steady: { dot: "bg-[#8be9a8]", label: "Up to date" },
};

/**
 * `edits` counts what the "agent" has written; `shown` counts what the
 * reader has refreshed in. Keeping them apart is the point of the demo: an
 * edit never changes the lines on screen until Refresh.
 */
export const WorkingTreeDemo = (): React.JSX.Element => {
  const [edits, setEdits] = useState(0);
  const [shown, setShown] = useState(0);

  const pending = edits > shown;
  const simulateEdit = useCallback(() => setEdits((count) => count + 1), []);
  const refresh = useCallback(() => setShown(edits), [edits]);
  const current = pending ? status.changed : status.steady;

  return (
    <div className="mt-8 overflow-hidden rounded-2xl bg-[#151611] text-[#f7f7f4] shadow-soft outline-1 -outline-offset-1 outline-white/10">
      <div className="flex flex-col gap-3 border-white/10 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="font-medium">Working tree review</p>
          <p className="mt-1 font-mono text-sm text-white/50">packages/diff-core/src/git.ts</p>
        </div>
        <div aria-live="polite" className="flex items-center gap-2 font-mono text-sm">
          <span aria-hidden="true" className={`size-2 rounded-full ${current.dot}`} />
          {current.label}
        </div>
      </div>

      {/* Focusable so the diff can be scrolled sideways from the keyboard on narrow screens. */}
      <section
        aria-label="Example diff"
        className="overflow-x-auto py-4 [mask-image:linear-gradient(to_right,black_85%,transparent)] sm:[mask-image:none] font-mono text-sm leading-7 focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        <div className="min-w-[34rem] px-4 sm:px-5">
          <div className="grid grid-cols-[2rem_2rem_1fr] text-white/45">
            <span>42</span>
            <span>42</span>
            <span>const base = await detectBaseBranch(repo);</span>
          </div>
          <div className="grid grid-cols-[2rem_2rem_1fr] bg-[#183923] text-[#b9f6ca]">
            <span className="text-white/35">+</span>
            <span>43</span>
            <span>return diffFromMergeBase(repo, base);</span>
          </div>
          <AnimatePresence initial={false}>
            {EDITS.slice(0, shown).map((line, index) => (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-[2rem_2rem_1fr] bg-[#183923] text-[#b9f6ca]"
                initial={{ opacity: 0, y: -6 }}
                key={line}
                transition={{ duration: 0.24 }}
              >
                <span className="text-white/35">+</span>
                <span>{44 + index}</span>
                <span>{line}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      <div className="flex flex-col gap-3 border-white/10 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="max-w-md text-pretty text-sm text-white/55">
          DiffHub watches the repository, signals a change, and lets you refresh when you are ready.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            className="min-h-11 rounded-full border border-white/15 px-4 font-medium text-sm transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-45"
            disabled={pending || edits === EDITS.length}
            onClick={simulateEdit}
            type="button"
          >
            Simulate an edit
          </button>
          <button
            className="min-h-11 rounded-full bg-[#f54e00] px-4 font-medium text-[#151611] text-sm transition-colors hover:bg-[#ff6a1f] focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-45"
            disabled={!pending}
            onClick={refresh}
            type="button"
          >
            Refresh diff
          </button>
        </div>
      </div>
    </div>
  );
};
