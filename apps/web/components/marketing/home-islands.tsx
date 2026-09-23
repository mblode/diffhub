"use client";

import { useEffect } from "react";

import { InstallCommand } from "@/components/marketing/install-command";
import { captureInstallCommandCopied, trackSectionViews } from "@/lib/conversion-events";

/**
 * The landing page is a Server Component and cannot hand a function to a
 * client block, so the analytics callback is bound here, on the client side
 * of the boundary.
 */

const INSTALL_COMMANDS = [
  { command: "npx diffhub@latest cmux", label: "cmux" },
  { command: "npx diffhub@latest", label: "Browser" },
];

export const HomeInstallCommand = ({ className }: { className?: string }): React.JSX.Element => (
  <InstallCommand
    className={className}
    commands={INSTALL_COMMANDS}
    onCopy={captureInstallCommandCopied}
  />
);

/**
 * Reports `section_viewed` for every `[data-section]` on the page. Renders
 * nothing; it only exists to run the observer on the client.
 */
export const SectionViews = (): null => {
  useEffect(() => trackSectionViews(document.querySelectorAll("[data-section]")), []);
  return null;
};
