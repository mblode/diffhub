import { asset, siteConfig } from "@/lib/config";

/**
 * The published CLI's version, not this workspace's. `next.config.js` reads it
 * out of `apps/cli/package.json` into `DIFFHUB_VERSION`, which is also what the
 * `softwareVersion` in `lib/schema.ts` reports. Empty in a standalone deploy
 * where the CLI package is not on disk, and the footer then omits it rather
 * than printing a bare "v".
 */
const version = process.env.DIFFHUB_VERSION;

export const Footer = (): React.JSX.Element => (
  <footer className="flex flex-col items-center justify-center gap-2 px-6 pt-16 pb-8 text-muted-foreground text-sm">
    {/*
      blode.co and blode.co/projects are this same origin behind a rewrite, so
      both are internal links: same tab, and no rel="noopener noreferrer", which
      only means something cross-origin. The projects link is the edge back to
      the hub, without which this zone is a dead end for crawlers and readers.
      See blode-co/apps/web/.claude/knowledge/zone-conventions.md.
    */}
    <div className="flex max-w-full flex-wrap items-center justify-center gap-1">
      Crafted by
      <a
        className="flex items-center gap-2 rounded-full py-1.5 pr-2.5 pl-1.5 transition-colors hover:text-foreground"
        href={siteConfig.links.author}
        rel="author"
      >
        {/* oxlint-disable-next-line nextjs/no-img-element -- self-hosted 20px avatar, plain img avoids next/image overhead */}
        <img
          alt="Matthew Blode"
          className="rounded-full"
          height={20}
          loading="lazy"
          src={asset("/avatar-sm.png")}
          width={20}
        />
        Matthew Blode
      </a>
    </div>
    <div className="flex max-w-full flex-wrap items-center justify-center gap-2 text-muted-foreground/30">
      {/* No version, no separator: the middot only exists to divide two things. */}
      {version ? (
        <>
          <span className="text-muted-foreground">v{version}</span>
          <span aria-hidden="true">·</span>
        </>
      ) : null}
      <a
        className="text-muted-foreground transition-colors hover:text-foreground"
        href="https://blode.co/projects"
      >
        All projects
      </a>
      <span aria-hidden="true">·</span>
      <a
        className="text-muted-foreground transition-colors hover:text-foreground"
        href={siteConfig.links.github}
        rel="noopener noreferrer"
        target="_blank"
      >
        GitHub
      </a>
      <span aria-hidden="true">·</span>
      <a
        className="text-muted-foreground transition-colors hover:text-foreground"
        href={siteConfig.links.npm}
        rel="noopener noreferrer"
        target="_blank"
      >
        npm
      </a>
    </div>
  </footer>
);
