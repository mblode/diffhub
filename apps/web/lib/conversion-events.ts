import { posthog } from "posthog-js";

/**
 * Conversion events already used by Taste Training and the homepage
 * first-viewport experiment. Satellite product pages must reuse these
 * names, not invent new ones.
 */
export const CTA_CLICKED_EVENT = "cta_clicked";
export const DOWNLOAD_CLICKED_EVENT = "download_clicked";

/**
 * The shared landing-page contract, added alongside the two above without
 * renaming either. Every event carries `site` so one PostHog project can split
 * the seven product pages apart.
 */
export const INSTALL_COMMAND_COPIED_EVENT = "install_command_copied";
export const DEMO_OPENED_EVENT = "demo_opened";
export const SECTION_VIEWED_EVENT = "section_viewed";

export const SITE = "diffhub";

export interface ConversionClick {
  href: string;
  label: string;
  /** Pathname or product slug. Defaults to `window.location.pathname`. */
  location?: string;
}

const DOWNLOAD_HREF = /\.(?:zip|dmg)(?:[?#]|$)/iu;

/**
 * Binary downloads (Glide zip, Convene/Commandment dmg) use `download_clicked`.
 * Install, GitHub, sign-in, and create flows stay on `cta_clicked`.
 */
export const isDownloadHref = (href: string): boolean => DOWNLOAD_HREF.test(href);

export const conversionEventForHref = (
  href: string,
): typeof CTA_CLICKED_EVENT | typeof DOWNLOAD_CLICKED_EVENT =>
  isDownloadHref(href) ? DOWNLOAD_CLICKED_EVENT : CTA_CLICKED_EVENT;

export const conversionLocation = (explicit?: string): string => {
  if (explicit) {
    return explicit;
  }
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.pathname;
};

/**
 * `$pathname` / `$current_url` so a funnel can join this click to `$pageview`.
 * Origin is always `https://blode.co` when `window` is missing. This app's
 * `basePath` is `/diffhub`, so `window.location.pathname` already includes it.
 */
const conversionPageLocation = (
  location: string,
): { $current_url: string; $pathname: string } | Record<string, never> => {
  if (typeof window !== "undefined") {
    return {
      $current_url: `${window.location.origin}${window.location.pathname}`,
      $pathname: window.location.pathname,
    };
  }
  if (location.startsWith("/")) {
    const pathname = location.replace(/[?#].*$/u, "");
    return {
      $current_url: `https://blode.co${pathname}`,
      $pathname: pathname,
    };
  }
  return {};
};

export const conversionProperties = ({
  href,
  label,
  location,
}: ConversionClick): {
  $current_url?: string;
  $pathname?: string;
  href: string;
  label: string;
  location: string;
  site: typeof SITE;
} => {
  const resolvedLocation = conversionLocation(location);
  return {
    href,
    label,
    location: resolvedLocation,
    site: SITE,
    ...conversionPageLocation(resolvedLocation),
  };
};

/**
 * Same event names and properties Taste Training already sends
 * (`href`, `label`, `location`), plus `$pathname` / `$current_url` so
 * funnels can join `$pageview`. Never throws: a click must still navigate.
 */
export const captureConversion = (click: ConversionClick): void => {
  try {
    posthog.capture(conversionEventForHref(click.href), conversionProperties(click));
  } catch {
    // Analytics must not be able to fail a click.
  }
};

const capture = (event: string, properties: Record<string, string>): void => {
  try {
    posthog.capture(event, { site: SITE, ...properties });
  } catch {
    // Analytics must not be able to fail a copy or a navigation.
  }
};

/** `variant` names the command that was copied, e.g. "cmux" or "Browser". */
export const captureInstallCommandCopied = (variant: string): void =>
  capture(INSTALL_COMMAND_COPIED_EVENT, { variant });

/** A live PR demo was opened, from any entry point on the page. */
export const captureDemoOpened = (): void => capture(DEMO_OPENED_EVENT, {});

/** `section` is the section's stable `data-section` id, e.g. "faq". */
export const captureSectionViewed = (section: string): void =>
  capture(SECTION_VIEWED_EVENT, { section });

/**
 * Landing sections carry `data-section="<id>"`. The value is the `section`
 * property on `section_viewed`, so rename one only on purpose.
 */
export const SECTION_ATTRIBUTE = "data-section";

/** Share of the section, or of the viewport for a tall one, that counts. */
const SECTION_VISIBLE_SHARE = 0.5;
const SECTION_THRESHOLDS = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

const noop = (): void => {
  // Nothing to clean up.
};

/**
 * Sends `section_viewed {site, section}` once per section per page view, the
 * first time half of it (or half the viewport, for a section taller than two
 * viewports) is on screen. Skips the hero and anything already in view when
 * this runs, so the count is sections a reader scrolled to. Returns a cleanup.
 * Does nothing without IntersectionObserver and never throws.
 */
export const trackSectionViews = (
  sections: Iterable<Element>,
  send: (section: string) => void = captureSectionViewed,
): (() => void) => {
  try {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      return noop;
    }
    const seen = new Set<string>();
    const observer = new window.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          try {
            const id = entry.target.getAttribute(SECTION_ATTRIBUTE);
            const viewport = entry.rootBounds?.height ?? window.innerHeight;
            const visible =
              entry.intersectionRatio >= SECTION_VISIBLE_SHARE ||
              entry.intersectionRect.height >= viewport * SECTION_VISIBLE_SHARE;
            if (!(id && entry.isIntersecting && visible) || seen.has(id)) {
              continue;
            }
            seen.add(id);
            observer.unobserve(entry.target);
            send(id);
          } catch {
            // One bad entry must not stop the others.
          }
        }
      },
      { threshold: SECTION_THRESHOLDS },
    );
    for (const section of sections) {
      const id = section.getAttribute(SECTION_ATTRIBUTE);
      const rect = section.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (id && id !== "hero" && !inView) {
        observer.observe(section);
      }
    }
    return () => {
      try {
        observer.disconnect();
      } catch {
        // Already gone.
      }
    };
  } catch {
    return noop;
  }
};
