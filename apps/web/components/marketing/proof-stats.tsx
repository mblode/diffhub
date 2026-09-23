import { cn } from "@/lib/utils";

/**
 * Local mirror of `@blode/proof-stats`, same props. Null values are left out,
 * and when every value is null the block renders nothing at all: no heading,
 * no zeroes, no dashes.
 */
interface ProofStatsProps {
  className?: string;
  stats: { href?: string; label: string; value: number | null }[];
}

const format = new Intl.NumberFormat("en-AU");

export const ProofStats = ({ className, stats }: ProofStatsProps): React.JSX.Element | null => {
  const shown = stats.filter(
    (stat): stat is { href?: string; label: string; value: number } => stat.value !== null,
  );
  if (shown.length === 0) {
    return null;
  }

  return (
    <dl className={cn("flex flex-wrap gap-x-12 gap-y-6", className)}>
      {shown.map((stat) => (
        <div className="flex flex-col-reverse" key={stat.label}>
          <dt className="mt-2 text-muted-foreground text-sm">
            {stat.href ? (
              <a
                className="relative underline decoration-foreground/20 after:absolute after:-inset-x-1 after:-inset-y-[13px] after:content-[''] underline-offset-4 hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
                href={stat.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                {stat.label}
              </a>
            ) : (
              stat.label
            )}
          </dt>
          <dd className="text-4xl tabular-nums tracking-tight sm:text-5xl">
            {format.format(stat.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
};
