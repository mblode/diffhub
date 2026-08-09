import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { JsonLd } from "@/components/shared/json-ld";
import { siteConfig } from "@/lib/config";
import { siteGraph } from "@/lib/schema";

import "./globals.css";

const glide = localFont({
  display: "swap",
  src: [
    { path: "./fonts/glide-variable.woff2", style: "normal" },
    { path: "./fonts/glide-variable-italic.woff2", style: "italic" },
  ],
  variable: "--font-glide",
  weight: "100 950",
});

const glideMono = localFont({
  display: "swap",
  src: "./fonts/glide-mono.woff2",
  variable: "--font-glide-mono",
  weight: "400",
});

// `Product: what it does`, under 60 characters so the SERP does not truncate
// it. Colon, never a pipe or an em dash.
const siteTitle = `${siteConfig.name}: cmux git diff viewer`;

export const viewport: Viewport = {
  width: "device-width",
};

export const metadata: Metadata = {
  alternates: {
    canonical: siteConfig.url,
  },
  appleWebApp: {
    title: "DiffHub",
  },
  authors: [{ name: "Matthew Blode", url: "https://blode.co" }],
  creator: "Matthew Blode",
  description: siteConfig.description,
  keywords: ["cmux git diff", "cmux diff viewer", "git diff viewer", "cmux", "DiffHub"],
  // The zone URL, basePath included: Next resolves a relative og:image against
  // this, so a bare origin would point the card at blode.co/opengraph-image.png.
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    description: siteConfig.description,
    /**
     * Load-bearing, and the card 404s without it. Do not delete as redundant.
     *
     * The card images live in `public/`, not `app/`. As `app/opengraph-image.png`
     * they were a file-convention route, and that convention is the one form
     * Next basePath-prefixes itself: the loader builds `/diffhub/opengraph-image.png`,
     * then `resolveUrl` joins `metadataBase.pathname` onto it again and emits
     * `/diffhub/diffhub/opengraph-image.png`, which 404s. Verified by building
     * with this block removed. That is how glide's share card broke in production.
     *
     * Note the asymmetry: `opengraph-image.tsx` (allmd, commandment, rubber-duck)
     * emits an unprefixed path and resolves correctly. Only the static-file form
     * doubles. Rule 11 in zone-conventions.md describes the `.tsx` behaviour.
     *
     * A `public/` asset is served under the basePath and is not a metadata route,
     * so this explicit URL is resolved once and lands on a real file.
     */
    images: [
      {
        alt: siteTitle,
        height: 630,
        url: "/opengraph-image.png",
        width: 1200,
      },
    ],
    // Every zone is a path on blode.co, so the site is the person. The product
    // name already has the og:title slot; repeating it here would spend the one
    // field in the card that could say who made the thing.
    siteName: "Matthew Blode",
    title: siteTitle,
    type: "website",
    url: siteConfig.url,
  },
  title: {
    default: siteTitle,
    template: `%s | ${siteConfig.name}`,
  },
  twitter: {
    card: "summary_large_image",
    creator: "@mattblode",
    description: siteConfig.description,
    images: ["/opengraph-image.png"],
    title: siteTitle,
  },
  verification: {
    google: "mFwyBIbXTaKK4uF_NA0MzVWFyY40hPgBjFObg3rje04",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${glide.variable} ${glideMono.variable} min-h-screen font-sans antialiased`}
      lang="en"
    >
      <head>
        <link href={process.env.NEXT_PUBLIC_POSTHOG_HOST} rel="preconnect" />
      </head>
      <body className="flex min-h-screen flex-col">
        <JsonLd data={siteGraph} />
        {children}
      </body>
    </html>
  );
}
