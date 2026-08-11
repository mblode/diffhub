import { asset, siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * A named person, and when the page last moved, on one line under the h1.
 *
 * Deliberately one component rather than a byline and a separate last-updated
 * stamp. They are always adjacent and never independently placed, so splitting
 * them buys nothing and guarantees someone eventually renders a page with an
 * author and no date, or a date and no author.
 *
 * Must stay a plain component: no `"use client"`, no `async`, no `node:*` or
 * `server-only` imports. `app/(marketing)/page.tsx` is a client component and
 * pulls this into the client bundle, so any of those breaks the build.
 */

interface AuthorBylineProps {
  /** Placement only. The prose pages leave it left; the centred hero passes justify-center. */
  className?: string;
  /**
   * Off by default. "Author of DiffHub" is a disclosure on the two guide pages,
   * which weigh DiffHub against other people's tools. On diffhub.co it restates
   * the domain, so the landing page omits it.
   */
  credential?: boolean;
  /** ISO date-only. Rendered as the visible stamp and the `datetime` attribute. */
  updated: string;
}

export const AuthorByline = ({
  className,
  credential = false,
  updated,
}: AuthorBylineProps): React.JSX.Element => (
  <div
    className={cn(
      "mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm",
      className,
    )}
  >
    <a
      className="flex items-center gap-2 transition-colors hover:text-foreground"
      href={siteConfig.links.author}
      rel="author"
    >
      {/*
        Decorative, so alt="". The link's own text reads "Matthew Blode"; an alt
        here would make the accessible name "Matthew Blode Matthew Blode".
        zone-conventions.md Rule 1.
      */}
      {/* oxlint-disable-next-line nextjs/no-img-element -- self-hosted 24px avatar, plain img avoids next/image overhead */}
      <img alt="" className="rounded-full" height={24} src={asset("/avatar-sm.png")} width={24} />
      <span className="font-medium text-foreground">Matthew Blode</span>
    </a>
    {credential ? (
      <>
        <span aria-hidden="true" className="text-muted-foreground/30">
          ·
        </span>
        {/* Kept to what is checkable: he wrote the thing. */}
        <span>Author of DiffHub</span>
      </>
    ) : null}
    <span aria-hidden="true" className="text-muted-foreground/30">
      ·
    </span>
    <span>
      Last updated <time dateTime={updated}>{updated}</time>
    </span>
  </div>
);
