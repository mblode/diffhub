"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

import { captureConversion } from "@/lib/conversion-events";

type TrackedCtaProps = {
  children?: ReactNode;
  href: string;
  label: string;
  location?: string;
} & Omit<ComponentProps<"a">, "href">;

const isHttpHref = (href: string) => href.startsWith("http://") || href.startsWith("https://");

/**
 * Anchor that fires `cta_clicked` or `download_clicked` before navigating.
 * Root-relative hrefs use `next/link` (which applies this app's `/diffhub`
 * basePath). Absolute URLs stay plain anchors and open in a new tab, matching
 * the existing navbar/footer Docs, GitHub, and npm links.
 */
export const TrackedCta = ({
  children,
  href,
  label,
  location,
  onClick,
  ...rest
}: TrackedCtaProps) => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    captureConversion({ href, label, location });
    onClick?.(event);
  };

  if (href.startsWith("/")) {
    return (
      <Link href={href} onClick={handleClick} {...rest}>
        {children}
      </Link>
    );
  }

  const newTab = isHttpHref(href)
    ? ({ rel: "noopener noreferrer", target: "_blank" } as const)
    : undefined;

  return (
    <a href={href} onClick={handleClick} {...newTab} {...rest}>
      {children}
    </a>
  );
};
