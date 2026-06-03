"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

// The blank-first-paint compositing skip this hook works around is a Chrome
// (Blink) quirk. In WebKit (Safari) the same `opacity` flick is actively
// harmful: dropping opacity below 1 promotes the scroll subtree to its own
// compositing layer and restoring it demotes it, so every tick forces a full
// re-rasterization of the diff grid — a constant visible flicker. Safari paints
// the grid correctly on its own, so the nudge is skipped there entirely.
const isWebKit =
  typeof navigator !== "undefined" &&
  /AppleWebKit/.test(navigator.userAgent) &&
  !/Chrome|Chromium|Edg/.test(navigator.userAgent);

/**
 * Force CodeView's first window to composite/paint.
 *
 * CodeView renders its virtualized grid into a pooled, sticky-positioned Shadow
 * DOM. On first mount Chrome can skip *compositing* that grid until something
 * forces a repaint, so a freshly-rendered diff can look blank (only line
 * backgrounds, no text) until the user scrolls — even though the rows are already
 * in the DOM and tokenized. Flicking the scroll container's opacity to 0.999 and
 * back forces a repaint of the subtree (including the Shadow DOM) with no layout
 * shift and no visible change (0.999 is indistinguishable from 1). The skip clears
 * at different moments depending on when the highlighter drains, so we nudge on a
 * slow cadence across the settling window; once painted, it stays painted.
 *
 * `root` should contain the CodeView scroll element (matched by `.overflow-y-auto`).
 * `active` gates the nudge on the viewer being mounted with content (worker ready
 * + at least one item). `resetKey` re-arms the nudge after a fresh stream.
 */
export const useCodeViewPaintNudge = (
  root: RefObject<HTMLElement | null>,
  active: boolean,
  resetKey: unknown = 0,
): void => {
  useEffect(() => {
    if (!active || isWebKit) {
      return;
    }
    const container = root.current;
    if (!container) {
      return;
    }
    const restoreTimers = new Set<ReturnType<typeof globalThis.setTimeout>>();
    const nudge = () => {
      const scroller = container.querySelector<HTMLElement>(".overflow-y-auto");
      if (!scroller || scroller.style.opacity) {
        return;
      }
      scroller.style.opacity = "0.999";
      const timer = globalThis.setTimeout(() => {
        scroller.style.opacity = "";
        restoreTimers.delete(timer);
      }, 100);
      restoreTimers.add(timer);
    };
    let ticks = 0;
    const interval = globalThis.setInterval(() => {
      ticks += 1;
      nudge();
      if (ticks >= 50) {
        globalThis.clearInterval(interval);
      }
    }, 300);
    return () => {
      globalThis.clearInterval(interval);
      for (const timer of restoreTimers) {
        globalThis.clearTimeout(timer);
      }
      const scroller = container.querySelector<HTMLElement>(".overflow-y-auto");
      if (scroller) {
        scroller.style.opacity = "";
      }
    };
    // oxlint-disable-next-line exhaustive-deps -- root is a stable ref object
  }, [active, resetKey]);
};
