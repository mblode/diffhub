export const ELEMENT_WAIT_TIMEOUT_MS = 2000;

export const hasRenderableBox = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && element.getClientRects().length > 0;
};

/**
 * Returns a cancel handle only when an observer is pending. A null return
 * means the element was handled synchronously.
 */
export const waitForElement = (
  selector: string,
  onReady: (element: HTMLElement) => void,
  timeoutMs = ELEMENT_WAIT_TIMEOUT_MS,
): VoidFunction | null => {
  const initial = document.querySelector<HTMLElement>(selector);
  if (initial && hasRenderableBox(initial)) {
    onReady(initial);
    return null;
  }

  const container = document.querySelector("#diff-container") ?? document.body ?? document.documentElement;

  let done = false;
  let rafId = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const observer = new MutationObserver(() => {
    if (rafId !== 0) {
      return;
    }
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      const element = document.querySelector<HTMLElement>(selector);
      if (!element || !hasRenderableBox(element) || done) {
        return;
      }
      done = true;
      observer.disconnect();
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      onReady(element);
    });
  });

  observer.observe(container, {
    attributeFilter: ["class", "hidden", "style"],
    attributes: true,
    childList: true,
    subtree: true,
  });

  timeoutId = setTimeout(() => {
    done = true;
    observer.disconnect();
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
    }
  }, timeoutMs);

  return () => {
    done = true;
    observer.disconnect();
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
};
