"use client";

import { Checkmark1Icon as CheckIcon, CopySimpleIcon as CopyIcon } from "blode-icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";

interface CopyButtonProps {
  content: string;
}

export const CopyButton = ({ content }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error("Failed to copy", error);
    }
  }, [content]);

  const Icon = copied ? CheckIcon : CopyIcon;

  return (
    <button
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 [&_svg]:size-3.5"
      onClick={handleCopy}
      type="button"
    >
      <AnimatePresence mode="popLayout">
        <motion.span
          animate={{ filter: "blur(0px)", opacity: 1, scale: 1 }}
          exit={{ filter: "blur(4px)", opacity: 0.4, scale: 0 }}
          initial={false}
          key={copied ? "check" : "copy"}
          transition={{ duration: 0.25 }}
        >
          <Icon />
        </motion.span>
      </AnimatePresence>
    </button>
  );
};
