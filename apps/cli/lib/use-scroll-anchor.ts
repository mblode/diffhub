"use client";

import { useEffect } from "react";
import { COMMENT_POSITION_SETTLE_MS } from "./comment-scroll-timing";

interface ScrollAnchorOptions {
  /** Prefer this visible element over the section under the toolbar. */
  preferredSelector?: string | null;
  /** CSS selector that matches every observed section. */
  selector: string;
  /** Container whose descendants to observe (defaults to document.body). */
  rootRef?: React.RefObject<HTMLElement | null>;
  /** Sticky header offset to preserve below (defaults to 52px status bar). */
  topOffset?: number;
}

const USER_SCROLL_CAPTURE_SUPPRESSION_MS = 80;

/**
 * Safari-safe scroll anchor.
 *
 * WebKit ships no native `overflow-anchor` ([WebKit #171099][1]), so any
 * height change above the viewport silently pushes the user. Tracking only
 * "resized sections above the viewport" misses first-render and near-top
 * mutations, so this hook continuously records the section under the sticky
 * toolbar and restores that section's screen position after resize/mutation
 * batches.
 *
 * [1]: https://bugs.webkit.org/show_bug.cgi?id=171099
 */
export const useScrollAnchor = ({
  preferredSelector,
  selector,
  rootRef,
  topOffset = 52,
}: ScrollAnchorOptions) => {
  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || typeof MutationObserver === "undefined") {
      return;
    }

    interface Anchor {
      element: Element;
      top: number;
    }

    let anchor: Anchor | null = null;
    let restoreRafId = 0;
    let captureRafId = 0;
    let suppressCaptureUntil = 0;
    let suppressRestoreUntil = 0;

    const getRoot = (): HTMLElement => rootRef?.current ?? document.body;

    const isVisibleAnchor = (element: Element): boolean => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > topOffset && rect.top < window.innerHeight;
    };

    const captureAnchor = () => {
      const root = getRoot();
      const preferred = preferredSelector ? root.querySelector(preferredSelector) : null;
      if (preferred && isVisibleAnchor(preferred)) {
        anchor = {
          element: preferred,
          top: preferred.getBoundingClientRect().top,
        };
        return;
      }

      const sections = [...root.querySelectorAll(selector)];
      if (sections.length === 0) {
        anchor = null;
        return;
      }

      let selected = sections[0] ?? null;
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.bottom <= topOffset) {
          selected = section;
          continue;
        }
        selected = section;
        break;
      }

      if (!selected) {
        anchor = null;
        return;
      }

      anchor = {
        element: selected,
        top: selected.getBoundingClientRect().top,
      };
    };

    const scheduleCapture = () => {
      if (captureRafId !== 0 || Date.now() < suppressCaptureUntil) {
        return;
      }
      captureRafId = requestAnimationFrame(() => {
        captureRafId = 0;
        captureAnchor();
      });
    };

    const scheduleRestore = () => {
      if (restoreRafId !== 0) {
        return;
      }
      restoreRafId = requestAnimationFrame(() => {
        restoreRafId = 0;

        if (Date.now() < suppressRestoreUntil) {
          captureAnchor();
          return;
        }

        if (!anchor || !anchor.element.isConnected) {
          captureAnchor();
          return;
        }

        const nextTop = anchor.element.getBoundingClientRect().top;
        const delta = nextTop - anchor.top;
        if (Math.abs(delta) > 0.5) {
          suppressCaptureUntil = Date.now() + USER_SCROLL_CAPTURE_SUPPRESSION_MS;
          window.scrollBy({ behavior: "instant", left: 0, top: delta });
        }

        anchor = {
          element: anchor.element,
          top: anchor.element.getBoundingClientRect().top,
        };
      });
    };

    const handleProgrammaticScroll = () => {
      suppressRestoreUntil = Date.now() + COMMENT_POSITION_SETTLE_MS;
      suppressCaptureUntil = Date.now() + USER_SCROLL_CAPTURE_SUPPRESSION_MS;
    };

    const observer = new ResizeObserver(scheduleRestore);

    const seenSections = new WeakSet<Element>();
    const refresh = () => {
      const sections = getRoot().querySelectorAll(selector);
      for (const section of sections) {
        if (seenSections.has(section)) {
          continue;
        }
        seenSections.add(section);
        observer.observe(section);
      }
    };

    refresh();
    captureAnchor();
    const mutation = new MutationObserver(() => {
      refresh();
      scheduleRestore();
    });
    const root = getRoot();
    mutation.observe(root, { childList: true, subtree: true });
    window.addEventListener("diffhub:programmatic-scroll", handleProgrammaticScroll);
    window.addEventListener("scroll", scheduleCapture, { passive: true });
    window.addEventListener("resize", scheduleRestore);

    return () => {
      if (restoreRafId !== 0) {
        cancelAnimationFrame(restoreRafId);
      }
      if (captureRafId !== 0) {
        cancelAnimationFrame(captureRafId);
      }
      observer.disconnect();
      mutation.disconnect();
      window.removeEventListener("diffhub:programmatic-scroll", handleProgrammaticScroll);
      window.removeEventListener("scroll", scheduleCapture);
      window.removeEventListener("resize", scheduleRestore);
    };
  }, [preferredSelector, selector, rootRef, topOffset]);
};
