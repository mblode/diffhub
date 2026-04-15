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
      <Navbar />
      <main className="min-h-[calc(100dvh-8rem)] pt-16">{children}</main>
      <Footer />
    </>
  );
}
