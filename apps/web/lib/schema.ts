import { siteConfig } from "@/lib/config";

/**
 * Stable `@id` anchors. Each entity is defined once in the site graph below and
 * referenced by `@id` everywhere else, so per-page JSON-LD (breadcrumbs, the
 * guide's TechArticle) can point at the Organization without restating it.
 */
export const schemaId = {
  organization: `${siteConfig.url}/#organization`,
  software: `${siteConfig.url}/#software`,
  website: `${siteConfig.url}/#website`,
} as const;

export const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@id": schemaId.organization,
      "@type": "Organization",
      logo: `${siteConfig.url}/icon0.svg`,
      name: siteConfig.name,
      sameAs: [siteConfig.links.github],
      url: siteConfig.url,
    },
    {
      "@id": schemaId.website,
      "@type": "WebSite",
      name: siteConfig.name,
      publisher: { "@id": schemaId.organization },
      url: siteConfig.url,
    },
    {
      "@id": schemaId.software,
      "@type": "SoftwareApplication",
      applicationCategory: "DeveloperApplication",
      description: siteConfig.description,
      downloadUrl: siteConfig.links.npm,
      // No aggregateRating: there are no ratings to report, and inventing them
      // is exactly the mismatch Google treats as spam. This costs the rich
      // result and keeps the entity data honest.
      isAccessibleForFree: true,
      name: siteConfig.name,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      operatingSystem: "macOS, Linux, Windows",
      publisher: { "@id": schemaId.organization },
      softwareVersion: process.env.DIFFHUB_VERSION,
      url: siteConfig.url,
    },
  ],
};
