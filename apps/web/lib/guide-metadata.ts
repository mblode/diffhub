import type { Metadata } from "next";

import { siteConfig } from "@/lib/config";
import type { Guide } from "@/lib/guides";

/**
 * Next metadata for one guide.
 *
 * Declaring `openGraph` or `twitter` replaces the root layout's block rather
 * than merging into it, so everything the card needs is restated: the image,
 * the siteName and `creator`. Each of those has gone missing on a page here
 * before (zone-conventions.md Rule 9). One builder means a new guide cannot
 * forget one of them.
 *
 * The card image path has no `/diffhub`: it is the generated
 * `app/opengraph-image.tsx` route, which Next does not prefix with `basePath`,
 * so `metadataBase` supplies the zone exactly once.
 */
const cardImage = "/opengraph-image";

export const guideUrl = (entry: Pick<Guide, "path">): string => `${siteConfig.url}${entry.path}`;

export const guideMetadata = (entry: Guide): Metadata => {
  const url = guideUrl(entry);
  const socialTitle = `${entry.title} | ${siteConfig.name}`;

  return {
    alternates: { canonical: url },
    description: entry.description,
    openGraph: {
      description: entry.description,
      images: [{ alt: entry.title, height: 630, url: cardImage, width: 1200 }],
      siteName: "Matthew Blode",
      title: socialTitle,
      type: "article",
      url,
    },
    // Bare: the root layout's `title.template` appends " | DiffHub".
    title: entry.title,
    twitter: {
      card: "summary_large_image",
      creator: "@mattblode",
      description: entry.description,
      images: [cardImage],
      title: socialTitle,
    },
  };
};
