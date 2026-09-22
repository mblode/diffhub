import type { ReactNode } from "react";

/**
 * Local mirror of `@blode/feature-rows`, same props. Text beside real product
 * media, alternating sides on wide screens, no cards. A Server Component: the
 * titles and descriptions are in the initial HTML, and only `media` may be a
 * client island.
 */
interface FeatureRowsProps {
  items: { description: string; media: ReactNode; title: string }[];
}

export const FeatureRows = ({ items }: FeatureRowsProps): React.JSX.Element => (
  <div className="divide-y divide-foreground/10 border-foreground/10 border-y">
    {items.map((item, index) => (
      <div
        className="grid gap-8 py-12 sm:py-16 lg:grid-cols-[5fr_7fr] lg:items-center lg:gap-16"
        key={item.title}
      >
        <div className={index % 2 === 1 ? "lg:order-2" : undefined}>
          <p className="font-mono text-link text-sm">0{index + 1}</p>
          <h3 className="mt-3 max-w-[20ch] text-balance text-2xl tracking-tight sm:text-3xl">
            {item.title}
          </h3>
          <p className="mt-4 max-w-[46ch] text-pretty text-muted-foreground">{item.description}</p>
        </div>
        <div className="min-w-0">{item.media}</div>
      </div>
    ))}
  </div>
);
