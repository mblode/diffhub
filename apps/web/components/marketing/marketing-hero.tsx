import type { ReactNode } from "react";

/**
 * Local mirror of `@blode/marketing-hero`, same props, so it can be swapped
 * for the registry block without touching the page.
 *
 * A Server Component with nothing animating on mount: the header, H1 and
 * primary action paint in their final state. Centred stack: H1,
 * description, then the action. `children` is the signature moment slot, laid
 * out full width underneath so the viewer has room for its sidebar.
 */
interface MarketingHeroProps {
  action: ReactNode;
  children?: ReactNode;
  description: string;
  title: string;
}

export const MarketingHero = ({
  action,
  children,
  description,
  title,
}: MarketingHeroProps): React.JSX.Element => (
  <div className="py-12 sm:py-16 lg:py-20">
    <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
      <h1 className="max-w-[16ch] text-balance font-medium text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
        {title}
      </h1>
      <p className="mt-6 max-w-[52ch] text-pretty text-lg text-muted-foreground">{description}</p>
      <div className="mt-8 max-w-full">{action}</div>
    </div>
    {children ? <div className="mt-14 min-w-0 lg:mt-16">{children}</div> : null}
  </div>
);
