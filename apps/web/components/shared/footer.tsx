import { asset, siteConfig } from "@/lib/config";

export const Footer = (): React.JSX.Element => (
  <footer className="flex flex-col items-center justify-center gap-2 pt-16 pb-8 text-muted-foreground text-sm">
    {/*
      blode.co and blode.co/projects are this same origin behind a rewrite, so
      both are internal links: same tab, and no rel="noopener noreferrer", which
      only means something cross-origin. The projects link is the edge back to
      the hub, without which this zone is a dead end for crawlers and readers.
      See blode-co/apps/web/.claude/knowledge/zone-conventions.md.
    */}
    <div className="flex items-center gap-1">
      Crafted by
      <a
        className="flex items-center gap-2 rounded-full py-1.5 pr-2.5 pl-1.5 transition-colors hover:text-foreground"
        href={siteConfig.links.author}
        rel="author"
      >
        {/* oxlint-disable-next-line nextjs/no-img-element -- self-hosted 20px avatar, plain img avoids next/image overhead */}
        <img
          alt="Avatar of Matthew Blode"
          className="rounded-full"
          height={20}
          src={asset("/avatar-sm.png")}
          width={20}
        />
        Matthew Blode
      </a>
    </div>
    <div className="flex items-center gap-3 text-muted-foreground/30">
      <a
        className="text-muted-foreground transition-colors hover:text-foreground"
        href="https://blode.co/projects"
      >
        All projects
      </a>
      <span>&middot;</span>
      <a
        className="text-muted-foreground transition-colors hover:text-foreground"
        href={siteConfig.links.github}
        rel="noopener noreferrer"
        target="_blank"
      >
        GitHub
      </a>
      <span>&middot;</span>
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
