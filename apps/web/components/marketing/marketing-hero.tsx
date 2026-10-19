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
  secondary?: ReactNode;
  title: string;
}

export const MarketingHero = ({
  action,
  children,
  description,
  secondary,
  title,
}: MarketingHeroProps): React.JSX.Element => (
  <div className="py-10 sm:py-14 lg:py-16">
    <div className="grid gap-8 lg:grid-cols-[7fr_5fr] lg:items-end lg:gap-14">
      <div className="min-w-0">
        <h1 className="max-w-[14ch] text-balance font-medium text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          {title}
        </h1>
      </div>
      <div className="min-w-0">
        <p className="max-w-[42ch] text-pretty text-lg text-muted-foreground">{description}</p>
        <div className="mt-6 flex flex-col items-start gap-5">
          {action}
          {secondary}
        </div>
      </div>
    </div>
    {children ? <div className="mt-12 min-w-0 lg:mt-14">{children}</div> : null}
  </div>
);
