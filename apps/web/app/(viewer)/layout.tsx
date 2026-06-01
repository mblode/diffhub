import { DiffsWorkerProvider } from "@diffhub/diff-core/react";
import { JetBrains_Mono } from "next/font/google";

// Diff body font, matching the CLI viewer's monospace.
const jetbrainsMono = JetBrains_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

// The live-demo viewer is full-bleed, mirroring the DiffHub CLI: it skips the
// marketing Navbar/Footer and mounts the diff worker pool (Shiki highlighting).
// The `.diffhub-app` palette scope + light/dark toggle is applied by PrDiffViewer
// (on both the viewer root and <html>, so portaled popups inherit it); this
// wrapper only carries the JetBrains Mono font variable.
export default function ViewerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <DiffsWorkerProvider>
      <div className={jetbrainsMono.variable}>{children}</div>
    </DiffsWorkerProvider>
  );
}
