import type * as React from "react";
import { cn } from "../lib/utils";

export const Spinner = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span
    role="status"
    aria-label="Loading"
    className={cn(
      "inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
      className,
    )}
    {...props}
  />
);
