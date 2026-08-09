/**
 * The trail back to the hub, rendered at the top of a zone's ROOT page.
 *
 * Copied verbatim from blode-co's `components/zone-breadcrumb.tsx` (these are
 * separate Next apps and cannot import from each other), so keep it
 * dependency-free: no `next/link`, no icon package, no local `cn()`.
 *
 * Three constraints, all of them load-bearing:
 *
 * 1. **Absolute `https://blode.co` hrefs.** A bare `href="/"` is not
 *    `basePath`-prefixed, so in a zone it resolves against the child's own
 *    origin and breaks on preview deployments.
 * 2. **Plain `<a>`, never `next/link`.** `next/link` would prefetch an RSC
 *    payload for a route this app does not own. These are also same-origin
 *    (a zone is blode.co behind a rewrite), so: same tab, and no
 *    `rel="noopener noreferrer"`, which only means something cross-origin.
 * 3. **The visible trail must match `BreadcrumbList` exactly.** Google treats a
 *    mismatch as a markup error. Both start at "Matthew Blode", not "Home":
 *    the root crumb is the one piece of chrome every zone shows above the fold,
 *    so it may as well say who made the thing.
 *
 * Root page only. Inner pages have their own navigation and a second trail
 * would just be noise.
 */

const HOME = "https://blode.co";
const PROJECTS = `${HOME}/projects`;

const Separator = () => (
  // Decorative: the <ol> already conveys the structure to assistive tech.
  <span aria-hidden className="select-none opacity-40">
    ›
  </span>
);

export const ZoneBreadcrumb = ({ product }: { product: string }) => (
  <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
    <ol className="flex flex-wrap items-center gap-1.5">
      <li className="flex items-center gap-1.5">
        {/*
          `rel="author"` marks this as the identity edge, matching the footer
          credit. Only this crumb carries it; /projects is a collection.
        */}
        <a
          className="underline decoration-current/25 underline-offset-2 transition-colors hover:text-foreground hover:decoration-current"
          href={HOME}
          rel="author"
        >
          Matthew Blode
        </a>
        <Separator />
      </li>
      <li className="flex items-center gap-1.5">
        <a
          className="underline decoration-current/25 underline-offset-2 transition-colors hover:text-foreground hover:decoration-current"
          href={PROJECTS}
        >
          Projects
        </a>
        <Separator />
      </li>
      {/* The current page is not a link, and says so. */}
      <li aria-current="page" className="text-foreground">
        {product}
      </li>
    </ol>
  </nav>
);
