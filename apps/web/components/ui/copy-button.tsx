"use client";

import { Checkmark1Icon as CheckIcon, CopySimpleIcon as CopyIcon } from "blode-icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";

import { captureConversion } from "@/lib/conversion-events";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  content: string;
  /** When set, fire `cta_clicked` with this label. Does not change the button. */
  label?: string;
}

/**
 * `failed` is a real state, not a defensive branch. `navigator.clipboard` is
 * undefined on an insecure origin and can be blocked by permissions policy, and
 * this button is the single primary action on the landing page, so a silent
 * no-op there leaves the reader with nothing to do. On failure the label points
 * at the fallback that always works: the command sits in a `<code>` element, so
 * it can be selected by hand.
 */
type CopyStatus = "copied" | "failed" | "idle";

const MESSAGE: Record<CopyStatus, string> = {
  copied: "Copied to clipboard",
  failed: "Couldn’t copy. Select the command and copy it manually.",
  idle: "",
};

export const CopyButton = ({ content, label }: CopyButtonProps) => {
  const [status, setStatus] = useState<CopyStatus>("idle");

  const handleCopy = useCallback(async () => {
    if (label !== undefined) {
      captureConversion({ href: content, label });
    }
    try {
      await navigator.clipboard.writeText(content);
      setStatus("copied");
    } catch (error) {
      console.error("Failed to copy", error);
      setStatus("failed");
    }
    setTimeout(() => setStatus("idle"), 3000);
  }, [content, label]);

  const Icon = status === "copied" ? CheckIcon : CopyIcon;

  return (
    <>
      {/*
        The outcome is announced here rather than by swapping the button's own
        aria-label: assistive tech does not reliably re-read the accessible name
        of a control that is already focused, which is exactly the case after a
        click. A polite live region does.
      */}
      <output aria-live="polite" className="sr-only">
        {MESSAGE[status]}
      </output>
      <button
        aria-label="Copy to clipboard"
        // `after` widens the tap target to 44px without changing the 28px box
        // the inline command pill is laid out around.
        className={cn(
          "relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors after:absolute after:-inset-2 after:content-[''] hover:bg-accent hover:text-accent-foreground [&_svg]:size-3.5",
          status === "failed" ? "text-destructive" : "text-muted-foreground",
        )}
        onClick={handleCopy}
        type="button"
      >
        <AnimatePresence mode="popLayout">
          <motion.span
            animate={{ filter: "blur(0px)", opacity: 1, scale: 1 }}
            exit={{ filter: "blur(4px)", opacity: 0.4, scale: 0 }}
            initial={false}
            key={status}
            transition={{ duration: 0.25 }}
          >
            <Icon />
          </motion.span>
        </AnimatePresence>
      </button>
    </>
  );
};
