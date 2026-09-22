"use client";

import { Faq } from "@/components/marketing/faq";
import { InstallCommand } from "@/components/marketing/install-command";
import type { Faq as FaqItem } from "@/lib/faq";
import { captureFaqOpened, captureInstallCommandCopied } from "@/lib/conversion-events";

/**
 * The landing page is a Server Component and cannot hand a function to a
 * client block, so the analytics callbacks are bound here, on the client side
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

export const HomeFaq = ({ items }: { items: readonly FaqItem[] }): React.JSX.Element => (
  <Faq items={items} onOpen={captureFaqOpened} />
);
