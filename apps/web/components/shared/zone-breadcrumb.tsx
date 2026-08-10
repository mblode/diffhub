/**
 * Hub trail for Blode UI zones. Composes `@blode/breadcrumb`.
 *
 * Non-Blode zones keep the dependency-free copy from
 * `blode-co/apps/web/components/zone-breadcrumb.tsx`.
 *
 * Constraints still apply:
 * 1. Absolute `https://blode.co` hrefs (preview deploys + basePath).
 * 2. Plain `<a>` via `BreadcrumbLink`, never `next/link`.
 * 3. Visible trail matches `BreadcrumbList`: Matthew Blode → Projects → product.
 *
 * Root page only. Inner pages have their own navigation.
 */

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const HOME = "https://blode.co";
const PROJECTS = `${HOME}/projects`;

export const ZoneBreadcrumb = ({ product }: { product: string }) => (
  <Breadcrumb aria-label="Breadcrumb">
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink href={HOME} rel="author">
          Matthew Blode
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbLink href={PROJECTS}>Projects</BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbPage>{product}</BreadcrumbPage>
      </BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>
);
