import type { ReactNode } from "react";

/**
 * Local mirror of `@blode/marketing-hero`, same props, so it can be swapped
 * for the registry block without touching the page.
 *
 * A Server Component with nothing animating on mount: the header, H1 and
 * primary action paint in their final state. `children` is the signature
 * moment slot, laid out full width under the copy, so the H1 and the action always
 * come first and the viewer has room for its sidebar.
 */
interface MarketingHeroProps {
  action: ReactNode;
  children?: ReactNode;
  description: string;
  eyebrow?: ReactNode;
  secondary?: ReactNode;
  title: string;
}

export const MarketingHero = ({
  action,
  children,
  description,
  eyebrow,
  secondary,
  title,
}: MarketingHeroProps): React.JSX.Element => (
  <div className="py-10 sm:py-14 lg:py-16">
    <div className="grid gap-8 lg:grid-cols-[7fr_5fr] lg:items-end lg:gap-14">
      <div className="min-w-0">
        {eyebrow ? <p className="font-mono text-sm text-white/55">{eyebrow}</p> : null}
        <h1 className="mt-4 max-w-[14ch] text-balance text-5xl leading-[1.02] tracking-tight sm:text-6xl xl:text-7xl">
          {title}
        </h1>
      </div>
      <div className="min-w-0">
        <p className="max-w-[42ch] text-pretty text-lg text-white/70">{description}</p>
        <div className="mt-6 flex flex-col items-start gap-5">
          {action}
          {secondary}
        </div>
      </div>
    </div>
    {children ? <div className="mt-12 min-w-0 lg:mt-14">{children}</div> : null}
  </div>
);
