"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";

import { asset } from "@/lib/config";
import { cn } from "@/lib/utils";

const features = [
  {
    description:
      "Compare the whole branch with its base. Use the file tree to jump between changed files.",
    title: "See every changed file",
    visual: "branch",
  },
  {
    description:
      "Run DiffHub beside your agent. Refresh after an edit and carry on where you left off.",
    title: "Keep the diff open",
    visual: "refresh",
  },
  {
    description: "Comment on any line, add a label, then copy all your notes as one prompt.",
    title: "Send comments back to the agent",
    visual: "notes",
  },
] as const;

type FeatureVisual = (typeof features)[number]["visual"];

const ProductVisual = ({ visual }: { visual: FeatureVisual }): React.JSX.Element => {
  if (visual === "notes") {
    return (
      <div className="flex h-full flex-col bg-[#151611] p-5 text-[#f7f7f4] sm:p-8">
        <div className="flex items-center justify-between border-white/10 border-b pb-4 font-mono text-sm">
          <p>Review notes</p>
          <p className="text-white/45">3 findings</p>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-3 py-8">
          <div className="grid gap-3 border-white/10 border-b py-4 sm:grid-cols-[7rem_1fr]">
            <p className="font-mono text-[#ff8b5c] text-sm">must-fix</p>
            <div className="min-w-0">
              <p className="font-medium">Preserve the draft when this request fails.</p>
              <p className="mt-1 truncate font-mono text-sm text-white/45">
                apps/web/app/api/review/route.ts:42
              </p>
            </div>
          </div>
          <div className="grid gap-3 border-white/10 border-b py-4 sm:grid-cols-[7rem_1fr]">
            <p className="font-mono text-[#ffd479] text-sm">question</p>
            <div className="min-w-0">
              <p className="font-medium">Should this use the detected base branch?</p>
              <p className="mt-1 truncate font-mono text-sm text-white/45">
                packages/diff-core/src/git.ts:118
              </p>
            </div>
          </div>
          <div className="grid gap-3 py-4 sm:grid-cols-[7rem_1fr]">
            <p className="font-mono text-[#8be9a8] text-sm">suggestion</p>
            <div className="min-w-0">
              <p className="font-medium">Reuse the existing path formatter here.</p>
              <p className="mt-1 truncate font-mono text-sm text-white/45">
                packages/diff-core/src/tree.tsx:76
              </p>
            </div>
          </div>
        </div>
        <p className="border-white/10 border-t pt-4 font-mono text-sm text-white/45">
          Copy 3 notes as a prompt
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden bg-[#eceae5]">
      <Image
        alt=""
        className={cn(
          "h-full max-w-none object-cover",
          visual === "branch" ? "w-[145%] object-left-top" : "w-full object-center",
        )}
        height={1411}
        loading="lazy"
        sizes="(max-width: 1024px) 100vw, 55vw"
        src={asset("/screenshot.png")}
        width={2111}
      />
      {visual === "refresh" ? (
        <div className="absolute right-4 bottom-4 flex items-center gap-2 rounded-full bg-[#151611] px-3 py-2 font-mono text-[#f7f7f4] text-sm shadow-lg sm:right-6 sm:bottom-6">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[#8be9a8]" />
          Watching working tree
        </div>
      ) : null}
    </div>
  );
};

/**
 * Adapted from react-components' FeaturesWithPanel. The source pattern hid the
 * inactive descriptions, so this version keeps every product outcome visible
 * and uses buttons only to swap the supporting product visual.
 */
export const FeatureShowcase = (): React.JSX.Element => {
  const [active, setActive] = useState(0);

  return (
    <div className="@container">
      <div className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:gap-16">
        <ul className="divide-y divide-foreground/10">
          {features.map((feature, index) => {
            const isActive = active === index;

            return (
              <li className="relative" key={feature.title}>
                <button
                  aria-controls="feature-visual"
                  aria-pressed={isActive}
                  className="group flex w-full gap-5 py-6 text-left text-base outline-none focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-4"
                  onClick={() => setActive(index)}
                  type="button"
                >
                  <span className={cn("font-mono text-muted-foreground", isActive && "text-link")}>
                    0{index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">{feature.title}</span>
                    <span className="mt-2 block text-pretty text-muted-foreground">
                      {feature.description}
                    </span>
                  </span>
                </button>
                <div className="pb-6 lg:hidden">
                  {isActive ? (
                    <div className="aspect-[4/3] overflow-hidden rounded-[min(3vw,var(--radius-2xl))] outline-1 -outline-offset-1 outline-foreground/10">
                      <ProductVisual visual={feature.visual} />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        <div
          aria-live="polite"
          className="sticky top-24 hidden aspect-[4/3] overflow-hidden rounded-[min(1vw,var(--radius-2xl))] shadow-soft outline-1 -outline-offset-1 outline-foreground/10 lg:block"
          id="feature-visual"
        >
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ filter: "blur(0px)", opacity: 1, scale: 1 }}
              className="absolute inset-0"
              exit={{ filter: "blur(4px)", opacity: 0, scale: 0.985 }}
              initial={{ filter: "blur(4px)", opacity: 0, scale: 0.985 }}
              key={features[active].visual}
              transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
            >
              <ProductVisual visual={features[active].visual} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
