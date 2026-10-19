import type { ReactNode } from "react";

/**
 * Local mirror of `@blode/cta-close`, same props: the last thing on the page,
 * one action and the command that goes with it.
 */
interface CtaCloseProps {
  action: ReactNode;
  command?: ReactNode;
  description?: string;
  title: string;
}

export const CtaClose = ({
  action,
  command,
  description,
  title,
}: CtaCloseProps): React.JSX.Element => (
  <div className="grid gap-10 lg:grid-cols-[7fr_5fr] lg:items-end lg:gap-16">
    <div>
      <h2 className="max-w-[17ch] text-balance font-medium text-3xl tracking-tight sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-5 max-w-[48ch] text-pretty text-muted-foreground">{description}</p>
      ) : null}
    </div>
    <div className="flex flex-col items-start gap-5 lg:items-end">
      {command}
      {action}
    </div>
  </div>
);
