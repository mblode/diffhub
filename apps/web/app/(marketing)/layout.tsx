import type React from "react";

import { Footer } from "@/components/shared/footer";
import { Navbar } from "@/components/shared/navbar";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring"
        href="#main"
      >
        Skip to content
      </a>
      <Navbar />
      <main className="min-h-[calc(100dvh-8rem)] pt-16" id="main">{children}</main>
      <Footer />
    </>
  );
}
