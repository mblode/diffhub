import posthog from "posthog-js";

/**
 * Conversion events already used by Taste Training and the homepage
 * first-viewport experiment. Satellite product pages must reuse these
 * names, not invent new ones.
 */
export const CTA_CLICKED_EVENT = "cta_clicked";
export const DOWNLOAD_CLICKED_EVENT = "download_clicked";

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
} => {
  const resolvedLocation = conversionLocation(location);
  return {
    href,
    label,
    location: resolvedLocation,
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
