import { siteConfig } from "@/lib/config";

export const Footer = (): React.JSX.Element => (
  <footer className="flex flex-col items-center justify-center gap-2 pt-16 pb-8 text-muted-foreground text-sm">
    <div className="flex items-center gap-1">
      Crafted by
      <a
        className="flex items-center gap-2 rounded-full py-1.5 pr-2.5 pl-1.5 transition-colors hover:text-foreground"
        href={siteConfig.links.author}
        rel="author"
        target="_blank"
      >
        {/* oxlint-disable-next-line nextjs/no-img-element -- canonical avatar is hosted on matthewblode.com, not optimized via next/image */}
        <img
          alt="Avatar of Matthew Blode"
          className="rounded-full"
          height={20}
          src="https://matthewblode.com/avatar-sm.png"
          width={20}
        />
        Matthew Blode
      </a>
    </div>
    <div className="flex items-center gap-3 text-muted-foreground/30">
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
