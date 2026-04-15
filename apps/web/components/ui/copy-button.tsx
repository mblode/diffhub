"use client";

import { useCallback, useState } from "react";
import { CheckIcon, CopySimpleIcon } from "blode-icons-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label?: string;
  copiedLabel?: string;
  delay?: number;
  className?: string;
}

export const CopyButton = ({
  value,
  label = "Copy file path",
  copiedLabel = "Copied!",
  delay = 400,
  className,
}: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — fail silently
    }
  }, [value]);

  return (
    <TooltipProvider delay={delay}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleCopy}
              aria-label={copied ? copiedLabel : label}
              className={cn(
                "size-6",
                copied
                  ? "text-diff-green"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                className,
              )}
            />
          }
        >
          {copied ? <CheckIcon size={12} /> : <CopySimpleIcon size={12} />}
        </TooltipTrigger>
        <TooltipContent side="bottom">{copied ? copiedLabel : label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
