import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center rounded-lg border border-transparent outline-none transition-[color,background-color,border-color,box-shadow,opacity] duration-150 ease-out focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "icon-xs",
      variant: "ghost",
    },
    variants: {
      size: {
        "icon-sm": "size-9 rounded-[min(var(--radius-md),12px)]",
        "icon-xs":
          "size-8 rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3",
      },
      variant: {
        ghost:
          "hover:bg-muted hover:text-foreground data-[pressed]:bg-muted data-[pressed]:text-foreground",
      },
    },
  },
);

export const Toggle = ({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof BaseToggle> & VariantProps<typeof toggleVariants>) => (
  <BaseToggle className={cn(toggleVariants({ className, size, variant }))} {...props} />
);
