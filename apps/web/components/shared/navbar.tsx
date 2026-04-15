"use client";

import { GithubIcon, StarIcon } from "blode-icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 50);
          ticking = false;
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header>
      <nav
        className={cn(
          "fixed z-20 w-full bg-background/80 backdrop-blur-lg transition-[border-color,background-color,backdrop-filter] duration-300",
          isScrolled && "border-border/40 border-b",
        )}
      >
        <div className="mx-auto max-w-4xl px-6">
          <div className="relative flex items-center justify-between py-4">
            <Link className="flex items-center gap-2 font-semibold tracking-[-0.02em]" href="/">
              DiffHub
            </Link>

            <div className="flex items-center gap-4">
              <a
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                href={siteConfig.links.docs}
                rel="noopener noreferrer"
                target="_blank"
              >
                Docs
              </a>
              <Button
                render={
                  <a href={siteConfig.links.github} rel="noopener noreferrer" target="_blank" />
                }
                size="sm"
                variant="outline"
              >
                <GithubIcon data-icon="inline-start" />
                Star on GitHub
                <StarIcon data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};
