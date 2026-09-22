"use client";

import { InstallCommand } from "@/components/marketing/install-command";
import { captureInstallCommandCopied } from "@/lib/conversion-events";

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
