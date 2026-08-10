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

/**
 * The zone's own nodes, without the breadcrumb. Composed by `zoneGraph` below
 * rather than emitted directly, because the breadcrumb has to know the page.
 */
const zoneNodes = [
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
    image: `${siteConfig.url}/opengraph-image`,
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      // Numeric 0 matches Google's SoftwareApplication example. String "0"
      // is schema.org-legal but Semrush Site Audit flags it as invalid markup.
      price: 0,
      priceCurrency: "USD",
    },
    operatingSystem: "macOS, Linux, Windows",
    publisher: { "@id": schemaId.organization },
    ...(process.env.DIFFHUB_VERSION ? { softwareVersion: process.env.DIFFHUB_VERSION } : {}),
    url: siteConfig.url,
  },
];

/**
 * The single `@graph` for one page. Emitted by the page, never by a layout.
 *
 * It used to be a `siteGraph` constant rendered from `app/layout.tsx`, which
 * ran on every route and carried a three-item breadcrumb at
 * `schemaId.breadcrumb`. Inner pages then rendered a second script whose
 * four-item trail claimed the same `@id`. That is two `BreadcrumbList` nodes
 * per inner page with one identifier and conflicting contents, which is a data
 * error rather than a second trail, and it broke Rule 3 ("one `@graph`, not N
 * scripts") on every route except the zone root.
 *
 * A layout cannot know the page's trail, so the emission has to live where the
 * trail is known. Pages pass their own nodes in `nodes` and their leaf crumb in
 * `trail`.
 *
 * The visible trail has to carry every name this declares. `check-schema`
 * compares them, and the phantom "Projects" crumb was exactly this: inner pages
 * rendered a short "DiffHub / page" nav while the markup declared Matthew
 * Blode, Projects and DiffHub above it. Use `ZoneBreadcrumb` with its `page`
 * prop and the two cannot drift.
 */
export const zoneGraph = ({
  nodes = [],
  trail = [],
}: {
  nodes?: unknown[];
  trail?: { name: string; url: string }[];
} = {}) => ({
  "@context": "https://schema.org",
  "@graph": [...zoneNodes, breadcrumbGraph(trail), ...nodes],
});
