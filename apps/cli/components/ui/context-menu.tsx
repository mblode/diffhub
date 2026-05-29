"use client";

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "blode-icons-react";

import { cn } from "@/lib/utils";

const ContextMenu = ({ ...props }: ContextMenuPrimitive.Root.Props) => (
  <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
);

const ContextMenuTrigger = ({ ...props }: ContextMenuPrimitive.Trigger.Props) => (
  <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
);

const ContextMenuGroup = ({ ...props }: ContextMenuPrimitive.Group.Props) => (
  <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
);

const ContextMenuContent = ({
  className,
  children,
  ...props
}: ContextMenuPrimitive.Popup.Props) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Positioner className="isolate z-50">
      <ContextMenuPrimitive.Popup
        data-slot="context-menu-content"
        className={cn(
          "z-50 max-h-(--available-height) min-w-[8rem] origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none dark:shadow-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
      </ContextMenuPrimitive.Popup>
    </ContextMenuPrimitive.Positioner>
  </ContextMenuPrimitive.Portal>
);

const ContextMenuItem = ({
  className,
  variant = "default",
  ...props
}: ContextMenuPrimitive.Item.Props & { variant?: "default" | "destructive" }) => (
  <ContextMenuPrimitive.Item
    data-slot="context-menu-item"
    data-variant={variant}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors data-highlighted:bg-secondary data-disabled:pointer-events-none data-disabled:opacity-50 data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      className,
    )}
    {...props}
  />
);

const ContextMenuCheckboxItem = ({
  className,
  children,
  ...props
}: ContextMenuPrimitive.CheckboxItem.Props) => (
  <ContextMenuPrimitive.CheckboxItem
    data-slot="context-menu-checkbox-item"
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-md py-1.5 pr-2 pl-8 text-sm outline-none transition-colors data-highlighted:bg-secondary data-disabled:pointer-events-none data-disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <ContextMenuPrimitive.CheckboxItemIndicator>
        <CheckIcon className="size-4" />
      </ContextMenuPrimitive.CheckboxItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
);

const ContextMenuRadioGroup = ({ ...props }: ContextMenuPrimitive.RadioGroup.Props) => (
  <ContextMenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props} />
);

const ContextMenuRadioItem = ({
  className,
  children,
  ...props
}: ContextMenuPrimitive.RadioItem.Props) => (
  <ContextMenuPrimitive.RadioItem
    data-slot="context-menu-radio-item"
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-md py-1.5 pr-2 pl-8 text-sm outline-none transition-colors data-highlighted:bg-secondary data-disabled:pointer-events-none data-disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <ContextMenuPrimitive.RadioItemIndicator>
        <CircleIcon className="size-2 fill-current" />
      </ContextMenuPrimitive.RadioItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
);

const ContextMenuLabel = ({ className, ...props }: ContextMenuPrimitive.GroupLabel.Props) => (
  <ContextMenuPrimitive.GroupLabel
    data-slot="context-menu-label"
    className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}
    {...props}
  />
);

const ContextMenuSeparator = ({ className, ...props }: ContextMenuPrimitive.Separator.Props) => (
  <ContextMenuPrimitive.Separator
    data-slot="context-menu-separator"
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
);

const ContextMenuSub = ({ ...props }: ContextMenuPrimitive.SubmenuRoot.Props) => (
  <ContextMenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...props} />
);

const ContextMenuSubTrigger = ({
  className,
  children,
  ...props
}: ContextMenuPrimitive.SubmenuTrigger.Props) => (
  <ContextMenuPrimitive.SubmenuTrigger
    data-slot="context-menu-sub-trigger"
    className={cn(
      "flex cursor-default select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors data-highlighted:bg-secondary data-popup-open:bg-secondary",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRightIcon className="ml-auto size-4" />
  </ContextMenuPrimitive.SubmenuTrigger>
);

const ContextMenuSubContent = ({
  className,
  children,
  ...props
}: ContextMenuPrimitive.Popup.Props) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Positioner className="isolate z-50">
      <ContextMenuPrimitive.Popup
        data-slot="context-menu-sub-content"
        className={cn(
          "z-50 max-h-(--available-height) min-w-[8rem] origin-(--transform-origin) overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none dark:shadow-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
      </ContextMenuPrimitive.Popup>
    </ContextMenuPrimitive.Positioner>
  </ContextMenuPrimitive.Portal>
);

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuGroup,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
};
