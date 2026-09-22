"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

/**
 * Local mirror of `@blode/install-command`, same props. Tabs follow the ARIA
 * tabs pattern: one tab stop, arrow keys and Home/End move between commands.
 * The copied and failed states live in `CopyButton`.
 */
interface InstallCommandProps {
  className?: string;
  commands: { command: string; label: string }[];
  onCopy?: (label: string) => void;
}

export const InstallCommand = ({
  className,
  commands,
  onCopy,
}: InstallCommandProps): React.JSX.Element => {
  const [active, setActive] = useState(0);
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = commands[active];

  const select = useCallback((index: number) => {
    setActive(index);
    tabs.current[index]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const last = commands.length - 1;
      const next: Record<string, number> = {
        ArrowLeft: active === 0 ? last : active - 1,
        ArrowRight: active === last ? 0 : active + 1,
        End: last,
        Home: 0,
      };
      if (event.key in next) {
        event.preventDefault();
        select(next[event.key]);
      }
    },
    [active, commands.length, select],
  );

  const handleCopy = useCallback(() => onCopy?.(current.label), [current.label, onCopy]);

  return (
    <div className={cn("w-full max-w-md", className)}>
      {commands.length > 1 ? (
        <div
          aria-label="Install command"
          className="mb-2 flex gap-1 font-mono text-sm"
          role="tablist"
        >
          {commands.map((item, index) => {
            const selected = index === active;
            return (
              <button
                aria-controls={`${id}-panel`}
                aria-selected={selected}
                className={cn(
                  "min-h-9 rounded-full px-3 transition-[background-color,opacity] focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-2",
                  selected ? "bg-white/12 text-current" : "opacity-60 hover:opacity-100",
                )}
                id={`${id}-tab-${index}`}
                key={item.label}
                onClick={() => setActive(index)}
                onKeyDown={handleKeyDown}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div
        aria-labelledby={commands.length > 1 ? `${id}-tab-${active}` : undefined}
        className="flex max-w-full items-center gap-2 rounded-full bg-[#f7f7f4] py-2 pr-1.5 pl-4 font-mono text-[#26251e] text-sm"
        id={`${id}-panel`}
        role={commands.length > 1 ? "tabpanel" : undefined}
      >
        <code className="min-w-0 flex-1 truncate">{current.command}</code>
        <CopyButton
          ariaLabel={`Copy ${current.command}`}
          content={current.command}
          label="Copy install command"
          onCopy={handleCopy}
        />
      </div>
    </div>
  );
};
