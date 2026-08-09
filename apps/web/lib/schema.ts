import { siteConfig } from "@/lib/config";

/**
 * Stable `@id` anchors. Each entity is defined once in the site graph below and
 * referenced by `@id` everywhere else, so per-page JSON-LD (breadcrumbs, the
 * guide's TechArticle) can point at the Organization without restating it.
 *
 * The Person, Organization and WebSite ids belong to blode.co and are only ever
 * referenced, never redefined here. blode.co/diffhub is a path on blode.co
 * behind a rewrite, not a site of its own: a `blode.co/diffhub/#organization`
 * would publish a second organization and a second website on one domain, which
 * splits the entity. Contract:
 * blode-co/apps/web/.claude/knowledge/zone-conventions.md
 */
const host = "https://blode.co";

export const schemaId = {
  breadcrumb: `${siteConfig.url}/#breadcrumb`,
  organization: `${host}/#organization`,
  person: `${host}/#person`,
  software: `${siteConfig.url}/#software`,
  webPage: `${siteConfig.url}/#webpage`,
  website: `${host}/#website`,
} as const;

/**
 * Matthew Blode -> Projects -> this zone, then any deeper page within it.
 *
 * The root crumb is named for the person, not "Home", and
 * `components/shared/zone-breadcrumb.tsx` renders the same three names
 * visibly. Google treats a mismatch between the two as a markup error, so
 * they change together.
 */
export const breadcrumbGraph = (trail: { name: string; url: string }[] = []) => ({
  "@id": schemaId.breadcrumb,
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", item: `${host}/`, name: "Matthew Blode", position: 1 },
    {
      "@type": "ListItem",
      item: `${host}/projects`,
      name: "Projects",
      position: 2,
    },
    {
      "@type": "ListItem",
      item: siteConfig.url,
      name: siteConfig.name,
      position: 3,
    },
    ...trail.map((item, index) => ({
      "@type": "ListItem",
      item: item.url,
      name: item.name,
      position: index + 4,
    })),
  ],
});

export const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@id": schemaId.webPage,
      "@type": "WebPage",
      about: { "@id": schemaId.software },
      breadcrumb: { "@id": schemaId.breadcrumb },
      description: siteConfig.description,
      inLanguage: "en-US",
      isPartOf: { "@id": schemaId.website },
      name: siteConfig.name,
      url: siteConfig.url,
    },
    {
      "@id": schemaId.software,
      "@type": "SoftwareApplication",
      applicationCategory: "DeveloperApplication",
      author: { "@id": schemaId.person },
      description: siteConfig.description,
      downloadUrl: siteConfig.links.npm,
      // No aggregateRating: there are no ratings to report, and inventing them
      // is exactly the mismatch Google treats as spam. This costs the rich
      // result and keeps the entity data honest.
      isAccessibleForFree: true,
      isPartOf: { "@id": schemaId.website },
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
    breadcrumbGraph(),
  ],
};
