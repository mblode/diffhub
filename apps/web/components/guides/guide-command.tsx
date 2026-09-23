"use client";

import { useCallback } from "react";

import { CopyButton } from "@/components/ui/copy-button";
import { captureInstallCommandCopied } from "@/lib/conversion-events";

/**
 * The one command block the guides show, on a light page. A client island
 * only because the copy has to fire `install_command_copied`: the guides are
 * Server Components and cannot hand `CopyButton` a callback themselves.
 *
 * The command sits in a real `<code>` element so it can still be selected by
 * hand when the clipboard is blocked, which is `CopyButton`'s failure hint.
 */
export const GuideCommand = ({
  command,
  variant,
}: {
  command: string;
  /** Names the command in the event, e.g. "cmux" or "Browser". */
  variant: string;
}): React.JSX.Element => {
  const handleCopy = useCallback(() => captureInstallCommandCopied(variant), [variant]);

  return (
    <div className="my-6 flex w-fit max-w-full items-center gap-2 rounded-full border border-border/60 bg-secondary/50 py-1.5 pr-1.5 pl-4 font-mono text-muted-foreground text-sm">
      <code className="min-w-0 truncate">{command}</code>
      <CopyButton
        ariaLabel={`Copy ${command}`}
        content={command}
        label="Copy install command"
        onCopy={handleCopy}
      />
    </div>
  );
};
