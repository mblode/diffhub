import type * as React from "react";
import { cn } from "@/lib/utils";

export const Kbd = ({ className, children, ...props }: React.ComponentProps<"kbd">) => (
  <kbd
    className={cn(
      "inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </kbd>
);
