import { GeistMono } from "geist/font/mono";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { JsonLd } from "@/components/shared/json-ld";
import { siteConfig } from "@/lib/config";
import { siteGraph } from "@/lib/schema";

import "./globals.css";

const glide = localFont({
  display: "swap",
  src: [{ path: "../public/glide-variable.woff2" }],
  variable: "--font-glide",
  weight: "400 900",
});

const siteTitle = `${siteConfig.name} | cmux git diff viewer`;

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
