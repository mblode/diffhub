import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border border-transparent bg-clip-padding font-medium text-sm outline-none transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 ease-out focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 aria-pressed:bg-primary/95",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground active:bg-muted/80 aria-expanded:bg-muted aria-pressed:bg-muted/80 dark:border-input dark:bg-input/30 dark:aria-pressed:bg-input/60 dark:active:bg-input/60 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/85 active:bg-secondary/75 aria-expanded:bg-secondary aria-pressed:bg-secondary/75",
        ghost:
          "hover:bg-muted hover:text-foreground active:bg-muted/80 aria-expanded:bg-muted aria-pressed:bg-muted/80 dark:aria-pressed:bg-muted/60 dark:active:bg-muted/60 dark:hover:bg-muted/50",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 focus-visible:border-red-600 focus-visible:ring-red-500/30 active:bg-red-800 aria-pressed:bg-red-800 dark:bg-red-500 dark:aria-pressed:bg-red-300 dark:active:bg-red-300 dark:hover:bg-red-400",
        destructiveSecondary:
          "border-red-200 text-red-700 hover:bg-red-50 active:bg-red-100 aria-pressed:bg-red-100 dark:border-red-800 dark:text-red-300 dark:aria-pressed:bg-red-950 dark:active:bg-red-950 dark:hover:bg-red-950/60",
        success:
          "bg-green-600 text-white hover:bg-green-700 focus-visible:border-green-600 focus-visible:ring-green-500/30 active:bg-green-800 aria-pressed:bg-green-800 dark:bg-green-500 dark:aria-pressed:bg-green-300 dark:active:bg-green-300 dark:hover:bg-green-400",
        successSecondary:
          "border-green-200 text-green-700 hover:bg-green-50 active:bg-green-100 aria-pressed:bg-green-100 dark:border-green-800 dark:text-green-300 dark:aria-pressed:bg-green-950 dark:active:bg-green-950 dark:hover:bg-green-950/60",
        warning:
          "bg-yellow-600 text-white hover:bg-yellow-700 focus-visible:border-yellow-600 focus-visible:ring-yellow-500/30 active:bg-yellow-800 aria-pressed:bg-yellow-800 dark:bg-yellow-500 dark:text-yellow-950 dark:aria-pressed:bg-yellow-300 dark:active:bg-yellow-300 dark:hover:bg-yellow-400",
        warningSecondary:
          "border-yellow-200 text-yellow-700 hover:bg-yellow-50 active:bg-yellow-100 aria-pressed:bg-yellow-100 dark:border-yellow-800 dark:text-yellow-300 dark:aria-pressed:bg-yellow-950 dark:active:bg-yellow-950 dark:hover:bg-yellow-950/60",
        link: "text-primary underline-offset-4 hover:underline active:opacity-80 aria-pressed:underline aria-pressed:opacity-80",
        input:
          "border-input bg-card font-normal font-sans text-base text-foreground leading-snug shadow-input hover:border-input-hover focus-visible:ring-2 focus-visible:ring-ring/15 focus-visible:ring-offset-1 focus-visible:ring-offset-background active:border-input-hover/80 aria-pressed:border-input-hover aria-invalid:border-destructive-foreground data-[placeholder]:text-placeholder-foreground",
      },
      size: {
        default:
          "h-10 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-8 gap-1 in-data-[slot=button-group]:rounded-lg rounded-[min(var(--radius-md),10px)] px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 in-data-[slot=button-group]:rounded-lg rounded-[min(var(--radius-md),12px)] px-3 text-[0.8rem] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        icon: "size-10",
        "icon-xs":
          "size-8 in-data-[slot=button-group]:rounded-lg rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-9 in-data-[slot=button-group]:rounded-lg rounded-[min(var(--radius-md),12px)]",
        "icon-lg": "size-11",
        input:
          "h-[var(--field-height)] gap-2 rounded-[var(--field-radius)] px-[var(--field-padding-x)] py-[var(--field-padding-y)]",
        "input-sm":
          "h-[var(--field-height-sm)] gap-2 rounded-[var(--field-radius)] px-[var(--field-padding-x)] py-[var(--field-padding-y)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(buttonVariants({ variant, size, className })),
      },
      asChild ? props : { ...props, children }
    ),
    render: asChild ? (children as React.ReactElement) : undefined,
    state: {
      slot: "button",
      size,
      variant,
    },
  });
}

export { Button, buttonVariants };
