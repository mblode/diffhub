import type { Metadata } from "next";

import { siteConfig } from "@/lib/config";

const defaultOgImage = `${siteConfig.url}/opengraph-image.png`;

interface PublicMetadataOptions {
  description: string;
  path: string;
  title: string;
}

interface BreadcrumbItem {
  name: string;
  path: string;
}

export const createPublicMetadata = ({
  description,
  path,
  title,
}: PublicMetadataOptions): Metadata => {
  const url = new URL(path, siteConfig.url).toString();

  return {
    alternates: {
      canonical: path,
    },
    description,
    openGraph: {
      description,
      images: [
        {
          alt: `${siteConfig.name} preview`,
          height: 630,
          url: defaultOgImage,
          width: 1200,
        },
      ],
      siteName: siteConfig.name,
      title,
      type: "website",
      url,
    },
    title,
    twitter: {
      card: "summary_large_image",
      description,
      images: [defaultOgImage],
      title,
    },
  };
};

export const buildBreadcrumbSchema = (items: BreadcrumbItem[]): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    item: new URL(item.path, siteConfig.url).toString(),
    name: item.name,
    position: index + 1,
  })),
});
