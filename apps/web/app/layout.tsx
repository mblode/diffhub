import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { siteConfig } from "@/lib/config";

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
const siteTitle = `${siteConfig.name}: cmux git diff viewer for agent code review`;

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
  // The zone URL, not the bare origin (Rule 11). Only correct because the card
  // is a generated `opengraph-image.tsx` route: Next does not prefix those with
  // `basePath`, so `metadataBase` supplies the prefix exactly once. Against the
  // static PNG this replaced, the two would have stacked into
  // `/diffhub/diffhub/…`.
  metadataBase: new URL(siteConfig.url),
  // No `images` here: `app/opengraph-image.tsx` is the card. Next reuses it for
  // `twitter:image` too when there is no `twitter-image` file.
  openGraph: {
    description: siteConfig.description,
    // Every zone is a path on blode.co, so the site is the person. The product
    // name already has the og:title slot; repeating it here would spend the one
    // field in the card that could say who made the thing.
    siteName: "Matthew Blode",
    title: siteTitle,
    type: "website",
    url: siteConfig.url,
  },
  // Without these, Google's defaults cap the text snippet and the image
  // preview. The cap is what AI surfaces read against when deciding how much of
  // a page they may quote, and Search Console shows those surfaces carrying 27%
  // of blode.co's impressions. blode.co sets the same three at its root; no
  // zone did.
  robots: {
    follow: true,
    googleBot: {
      follow: true,
      index: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    index: true,
  },
  title: {
    default: siteTitle,
    template: `%s | ${siteConfig.name}`,
  },
  twitter: {
    card: "summary_large_image",
    creator: "@mattblode",
    description: siteConfig.description,
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
      {/* No JSON-LD here. A layout runs on every route and cannot know the
          page's breadcrumb trail, so emitting the graph from here produced a
          second `BreadcrumbList` on every inner page, sharing one `@id` with
          the page's own and disagreeing with it. Pages emit `zoneGraph()`
          instead: one script, one graph, one trail. See lib/schema.ts. */}
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
