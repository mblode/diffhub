import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { ChevronRight, MoreHorizontal } from "blode-icons-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const Breadcrumb = ({ ...props }: React.ComponentProps<"nav">) => (
  <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />
);

const BreadcrumbList = ({ className, ...props }: React.ComponentProps<"ol">) => (
  <ol
    className={cn(
      "flex flex-wrap items-center gap-1.5 break-words text-muted-foreground text-sm sm:gap-2.5",
      className,
    )}
    data-slot="breadcrumb-list"
    {...props}
  />
);

const BreadcrumbItem = ({ className, ...props }: React.ComponentProps<"li">) => (
  <li
    className={cn("inline-flex items-center gap-1.5", className)}
    data-slot="breadcrumb-item"
    {...props}
  />
);

const BreadcrumbLink = ({
  asChild,
  className,
  children,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean;
}) =>
  useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn("transition-colors hover:text-foreground", className),
      },
      asChild ? props : { ...props, children },
    ),
    render: asChild ? (children as React.ReactElement) : undefined,
    state: {
      slot: "breadcrumb-link",
    },
  });

const BreadcrumbPage = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span
    aria-current="page"
    aria-disabled="true"
    className={cn("font-normal text-foreground", className)}
    data-slot="breadcrumb-page"
    {...props}
  />
);

const BreadcrumbSeparator = ({ children, className, ...props }: React.ComponentProps<"li">) => (
  <li
    aria-hidden="true"
    className={cn("[&>svg]:size-3.5", className)}
    data-slot="breadcrumb-separator"
    role="presentation"
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
);

const BreadcrumbEllipsis = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span
    aria-hidden="true"
    className={cn("flex size-9 items-center justify-center", className)}
    data-slot="breadcrumb-ellipsis"
    role="presentation"
    {...props}
  >
    <MoreHorizontal className="size-4" />
    <span className="sr-only">More</span>
  </span>
);

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
