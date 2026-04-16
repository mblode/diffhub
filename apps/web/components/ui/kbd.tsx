import type { ComponentProps, ReactNode } from "react";
import {
  ArrowCornerDownLeftIcon,
  ArrowDownIcon,
  ArrowLeftXIcon,
  ArrowUpIcon,
  ArrowWall2RightIcon,
  CmdIcon,
  ControlIcon,
  OptIcon,
  ShiftIcon,
} from "blode-icons-react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

type KbdIcon =
  | "mod"
  | "shift"
  | "enter"
  | "command"
  | "ctrl"
  | "alt"
  | "tab"
  | "backspace"
  | "up"
  | "down";

const kbdVariants = cva(
  "pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm px-1.5 font-medium font-sans text-xs ring-1 ring-inset [&_svg:not([class*='size-'])]:size-3",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default:
          "bg-muted text-muted-foreground ring-border [[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background [[data-slot=tooltip-content]_&]:ring-background/20 dark:[[data-slot=tooltip-content]_&]:bg-background/10 dark:[[data-slot=tooltip-content]_&]:ring-background/10",
        tooltip:
          "bg-background/20 text-background ring-background/20 dark:bg-background/10 dark:ring-background/10",
      },
    },
  }
);

interface KbdProps
  extends ComponentProps<"kbd">,
    VariantProps<typeof kbdVariants> {
  icon?: KbdIcon;
}

const iconMap: Record<KbdIcon, ReactNode> = {
  alt: <OptIcon className="size-3" />,
  backspace: <ArrowLeftXIcon className="size-3" />,
  command: <CmdIcon className="size-3" />,
  ctrl: <ControlIcon className="size-3" />,
  down: <ArrowDownIcon className="size-3" />,
  enter: <ArrowCornerDownLeftIcon className="size-3" />,
  mod: <CmdIcon className="size-3" />,
  shift: <ShiftIcon className="size-3" />,
  tab: <ArrowWall2RightIcon className="size-3" />,
  up: <ArrowUpIcon className="size-3" />,
};

const Kbd = ({ className, variant, children, icon, ref, ...props }: KbdProps) => {
  const content = icon ? iconMap[icon] : children;

  return (
    <kbd
      className={cn(kbdVariants({ variant }), className)}
      data-slot="kbd"
      ref={ref}
      {...props}
    >
      {content}
    </kbd>
  );
};

const KbdGroup = ({ className, ref, ...props }: ComponentProps<"kbd">) => (
  <kbd
    className={cn("inline-flex items-center gap-1", className)}
    data-slot="kbd-group"
    ref={ref}
    {...props}
  />
);

export { Kbd, KbdGroup };
