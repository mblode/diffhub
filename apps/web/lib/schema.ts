import type { Faq } from "@/lib/faq";
import { plainAnswer } from "@/lib/faq";
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
 *
 * `webPage` and `breadcrumb` are the *zone root's* ids, not zone-wide ones.
 * Inner pages derive their own from their own URL via `pageIds` below. They
 * used to share these constants, which meant /cmux-git-diff published a WebPage
 * under the landing page's `@id` claiming `url: https://blode.co/diffhub`, in
 * other words asserting it was the landing page. Keep the `${url}/#webpage`
 * shape: it is what makes the root's two ids come out byte-identical to what
 * they have always been, so nothing Google has already resolved is orphaned.
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

/** Who a given page says it is. Defaults to the zone root. */
interface PageIdentity {
  description: string;
  name: string;
  url: string;
}

const rootIdentity: PageIdentity = {
  description: siteConfig.description,
  name: siteConfig.name,
  url: siteConfig.url,
};

const pageIds = (identity: PageIdentity) => ({
  breadcrumb: `${identity.url}/#breadcrumb`,
  webPage: `${identity.url}/#webpage`,
});

/**
 * Matthew Blode -> Projects -> this zone, then any deeper page within it.
 *
 * The root crumb is named for the person, not "Home", and
 * `components/shared/zone-breadcrumb.tsx` renders the same three names
 * visibly. Google treats a mismatch between the two as a markup error, so
 * they change together.
 *
 * `id` has to move in lockstep with the WebPage node's `breadcrumb: {"@id"}`
 * reference. Change one and the graph points at a node that is not in it,
 * which is a worse defect than the shared-id collision this replaced.
 */
export const breadcrumbGraph = (
  trail: { name: string; url: string }[] = [],
  id: string = schemaId.breadcrumb,
) => ({
  "@id": id,
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
 * One software entity for the whole zone, referenced from every page. This one
 * genuinely is zone-wide, unlike the WebPage: there is a single DiffHub.
 */
const softwareNode = {
  "@id": schemaId.software,
  "@type": "SoftwareApplication",
  applicationCategory: "DeveloperApplication",
  author: { "@id": schemaId.person },
  description: siteConfig.description,
  downloadUrl: siteConfig.links.npm,
  // No aggregateRating: there are no ratings to report, and inventing them
  // is exactly the mismatch Google treats as spam. This costs the rich
  // result and keeps the entity data honest.
  //
  // No "Product" in the type array either, for the same reason one step on:
  // Product without review/aggregateRating earns a permanent "missing field
  // review" in Search Console, and the only way to clear it is to invent the
  // ratings this node just refused.
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
};

/**
 * FAQPage is a subtype of WebPage, so the questions belong on the page node
 * rather than in one of their own. A second page-typed node for a single URL
 * is the duplicate-entity error the comment on `zoneGraph` describes, just
 * wearing a different `@type`.
 *
 * Google restricted FAQ rich results to government and health sites in August
 * 2023, so Search Console will likely mark these items ineligible. Ineligible
 * is not invalid and carries no penalty, and the answer engines this markup is
 * actually for read it regardless. Kept for them, not for the rich result.
 */
const webPageNode = (
  identity: PageIdentity,
  { faqs, updatedAt }: { faqs: readonly Faq[]; updatedAt?: string },
) => {
  const ids = pageIds(identity);

  return {
    "@id": ids.webPage,
    "@type": faqs.length > 0 ? ["WebPage", "FAQPage"] : "WebPage",
    about: { "@id": schemaId.software },
    breadcrumb: { "@id": ids.breadcrumb },
    ...(updatedAt ? { dateModified: updatedAt } : {}),
    description: identity.description,
    inLanguage: "en-US",
    isPartOf: { "@id": schemaId.website },
    ...(faqs.length > 0
      ? {
          mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            acceptedAnswer: { "@type": "Answer", text: plainAnswer(faq.answer) },
            name: faq.question,
          })),
        }
      : {}),
    name: identity.name,
    url: identity.url,
  };
};

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
 *
 * `faqs` takes the same array the page hands `<FaqSection>`. Passing a second,
 * separately-worded array would produce `acceptedAnswer` text that is not on
 * the page, which is the one FAQ markup error Google does act on.
 */
export const zoneGraph = ({
  faqs = [],
  nodes = [],
  page,
  trail = [],
  updatedAt,
}: {
  faqs?: readonly Faq[];
  nodes?: unknown[];
  /** Omit on the zone root, which is the identity this defaults to. */
  page?: PageIdentity;
  trail?: { name: string; url: string }[];
  /** ISO date. Surfaces as `dateModified` on the page node. */
  updatedAt?: string;
} = {}) => {
  const identity = page ?? rootIdentity;

  return {
    "@context": "https://schema.org",
    "@graph": [
      webPageNode(identity, { faqs, updatedAt }),
      softwareNode,
      breadcrumbGraph(trail, pageIds(identity).breadcrumb),
      ...nodes,
    ],
  };
};
