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
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    description: siteConfig.description,
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
