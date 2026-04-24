import { GeistMono } from "geist/font/mono";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { JsonLd } from "@/components/shared/json-ld";
import { siteConfig } from "@/lib/config";

import "./globals.css";

const glide = localFont({
  display: "swap",
  src: [{ path: "../public/glide-variable.woff2" }],
  variable: "--font-glide",
  weight: "400 900",
});

const siteTitle = `${siteConfig.name} | Local diff viewer for cmux`;

export const viewport: Viewport = {
  width: "device-width",
};

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    title: "DiffHub",
  },
  description: siteConfig.description,
  keywords: [
    "cmux",
    "conductor",
    "diff viewer",
    "git diff",
    "git files changed",
    "code review",
    "branch diff",
    "local code review",
    "split diff",
    "unified diff",
    "cli tool",
    "DiffHub",
  ],
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
    siteName: siteConfig.name,
    title: siteTitle,
    type: "website",
    url: siteConfig.url,
  },
  title: siteTitle,
  twitter: {
    card: "summary_large_image",
    description: siteConfig.description,
    images: ["/opengraph-image.png"],
    title: siteTitle,
  },
  verification: {
    google: "mFwyBIbXTaKK4uF_NA0MzVWFyY40hPgBjFObg3rje04",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  logo: `${siteConfig.url}/icon0.svg`,
  name: siteConfig.name,
  sameAs: [siteConfig.links.github],
  url: siteConfig.url,
};

const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  url: siteConfig.url,
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  applicationCategory: "DeveloperApplication",
  author: {
    "@type": "Person",
    name: "Matthew Blode",
    url: siteConfig.links.author,
  },
  description: siteConfig.description,
  downloadUrl: siteConfig.links.npm,
  license: "https://opensource.org/licenses/MIT",
  name: siteConfig.name,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  operatingSystem: "macOS, Windows, Linux",
  softwareVersion: process.env.DIFFHUB_VERSION,
  url: siteConfig.links.npm,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${glide.variable} ${GeistMono.variable} min-h-screen font-sans antialiased`}
      lang="en"
    >
      <body className="flex min-h-screen flex-col">
        <JsonLd data={organizationJsonLd} />
        <JsonLd data={webSiteJsonLd} />
        <JsonLd data={softwareJsonLd} />
        {children}
      </body>
    </html>
  );
}
