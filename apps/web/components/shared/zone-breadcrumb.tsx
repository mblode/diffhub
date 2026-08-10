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
 * Inner pages too, via `page`. This used to say "root page only. Inner pages
 * have their own navigation", and that sentence was the bug: inner pages
 * hand-rolled a "DiffHub / this page" nav while `zoneGraph` declared Matthew
 * Blode and Projects above it. `check-schema` reads every crumb name out of the
 * JSON-LD and looks for it in the rendered text, so "Projects" was reported as
 * a crumb not in the DOM on every inner route. Pass `page` and constraint 3
 * holds by construction.
 *
 * `page` must be the same string the page puts in `zoneGraph`'s `trail`.
 */

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { siteConfig } from "@/lib/config";

const HOME = "https://blode.co";
const PROJECTS = `${HOME}/projects`;

export const ZoneBreadcrumb = ({ page, product }: { page?: string; product: string }) => (
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
        {page ? (
          <BreadcrumbLink href={siteConfig.url}>{product}</BreadcrumbLink>
        ) : (
          <BreadcrumbPage>{product}</BreadcrumbPage>
        )}
      </BreadcrumbItem>
      {page ? (
        <>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{page}</BreadcrumbPage>
          </BreadcrumbItem>
        </>
      ) : null}
    </BreadcrumbList>
  </Breadcrumb>
);
