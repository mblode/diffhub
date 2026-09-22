"use client";

import { MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * The page's one scroll moment: a short rise and fade the first time the
 * element enters the viewport, never replayed. Only used below the fold, so
 * nothing in the first viewport animates on mount.
 *
 * `reducedMotion="user"` drops the translate for readers who ask for less
 * motion and leaves a plain opacity change.
 */
export const Reveal = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.JSX.Element => (
  <MotionConfig reducedMotion="user">
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ margin: "0px 0px -15% 0px", once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  </MotionConfig>
);
