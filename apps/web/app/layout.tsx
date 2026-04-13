import { Agentation } from "agentation";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { DiffsWorkerProvider } from "@/components/DiffsWorkerProvider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const glide = localFont({
  display: "swap",
  src: [
    { path: "../public/glide-variable.woff2", style: "normal" },
    { path: "../public/glide-variable-italic.woff2", style: "italic" },
  ],
  variable: "--font-glide",
  weight: "400 900",
});

const operatorMono = localFont({
  display: "swap",
  src: [
    { path: "../public/operator-mono-book.woff2", style: "normal", weight: "400" },
    { path: "../public/operator-mono-book-italic.woff2", style: "italic", weight: "400" },
    { path: "../public/operator-mono-medium.woff2", style: "normal", weight: "500" },
    { path: "../public/operator-mono-medium-italic.woff2", style: "italic", weight: "500" },
  ],
  variable: "--font-operator-mono",
});

export const metadata: Metadata = {
  description: "GitHub PR-style local diff viewer",
  title: "diffhub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${glide.variable} ${operatorMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden bg-background antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <DiffsWorkerProvider>{children}</DiffsWorkerProvider>
          {process.env.NODE_ENV === "development" && <Agentation />}
        </ThemeProvider>
      </body>
    </html>
  );
}
