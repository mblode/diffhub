"use client";

import { useEffect } from "react";

interface ScrollAnchorOptions {
  /** CSS selector that matches every observed section. */
  selector: string;
  /** Container whose descendants to observe (defaults to document.body). */
  rootRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Safari-safe scroll anchor.
 *
 * WebKit ships no native `overflow-anchor` ([WebKit #171099][1]), so any
 * height change above the viewport during scroll silently pushes the user.
 * This hook observes every section matching `selector`. When a section
 * resizes:
 *
 * - If the section is **entirely above** the viewport, we adjust the page's
 *   scroll position by the size delta so the user's visible content does not
 *   shift.
 * - If the section is in or below the viewport, we leave scrollY alone — the
 *   user expects to see growth happening within their view.
 *
 * Compensations are batched per animation frame so multiple sections growing
 * in the same tick produce a single `scrollBy` call.
 *
 * [1]: https://bugs.webkit.org/show_bug.cgi?id=171099
 */
export const useScrollAnchor = ({ selector, rootRef }: ScrollAnchorOptions) => {
  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || typeof MutationObserver === "undefined") {
      return;
    }

    const observedHeights = new WeakMap<Element, number>();
    let pendingDelta = 0;
    let rafId = 0;

    const flush = () => {
      rafId = 0;
      if (pendingDelta === 0) {
        return;
      }
      const delta = pendingDelta;
      pendingDelta = 0;
      window.scrollBy({ behavior: "instant", left: 0, top: delta });
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = entry.contentRect.height;
        const last = observedHeights.get(entry.target);
        observedHeights.set(entry.target, next);
        if (last === undefined || last === next) {
          continue;
        }
        const rect = entry.target.getBoundingClientRect();
        // Only compensate for changes that happened entirely above the
        // viewport's top edge. Partial overlap is rare and self-correcting
        // (the user sees the growth happening in their view).
        if (rect.bottom <= 0) {
          pendingDelta += next - last;
        }
      }
      if (pendingDelta !== 0 && rafId === 0) {
        rafId = requestAnimationFrame(flush);
      }
    });

    const seenSections = new WeakSet<Element>();
    const refresh = () => {
      const root = rootRef?.current ?? document.body;
      const sections = root.querySelectorAll(selector);
      for (const section of sections) {
        if (seenSections.has(section)) {
          continue;
        }
        seenSections.add(section);
        observer.observe(section);
      }
    };

    refresh();
    const mutation = new MutationObserver(refresh);
    const root = rootRef?.current ?? document.body;
    mutation.observe(root, { childList: true, subtree: true });

    return () => {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
      }
      observer.disconnect();
      mutation.disconnect();
    };
  }, [selector, rootRef]);
};
