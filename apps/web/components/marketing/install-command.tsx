"use client";

import { Fragment, useCallback, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

/**
 * Local mirror of `@blode/install-command`, plus an optional `action` that
 * sits beside the command. Tabs follow the ARIA tabs pattern: one tab stop,
 * arrow keys and Home/End move between commands. The copied and failed states
 * live in `CopyButton`.
 */
interface InstallCommandProps {
  action?: ReactNode;
  align?: "center" | "start";
  className?: string;
  commands: { command: string; label: string }[];
  onCopy?: (label: string) => void;
}

export const InstallCommand = ({
  action,
  align = "start",
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
    <div
      className={cn(
        "flex max-w-full flex-col gap-2",
        align === "center" ? "items-center" : "items-start",
        className,
      )}
    >
      {commands.length > 1 ? (
        <div aria-label="Install command" className="flex items-center text-sm" role="tablist">
          {commands.map((item, index) => {
            const selected = index === active;
            return (
              <Fragment key={item.label}>
                {index > 0 ? <span aria-hidden="true" className="h-3 w-px bg-border" /> : null}
                <button
                  aria-controls={`${id}-panel`}
                  aria-selected={selected}
                  className={cn(
                    "min-h-9 rounded-sm px-3 transition-colors focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-2",
                    selected
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  id={`${id}-tab-${index}`}
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
              </Fragment>
            );
          })}
        </div>
      ) : null}
      <div
        className={cn(
          "flex max-w-full flex-col gap-3 sm:flex-row sm:items-center",
          align === "center" ? "items-center" : "items-start",
        )}
      >
        <div
          aria-labelledby={commands.length > 1 ? `${id}-tab-${active}` : undefined}
          className="flex h-10 max-w-full items-center gap-1 rounded-full bg-card py-1.5 pr-1.5 pl-4 font-mono text-foreground text-sm outline-1 -outline-offset-1 outline-foreground/10"
          id={`${id}-panel`}
          role={commands.length > 1 ? "tabpanel" : undefined}
        >
          <span aria-hidden="true" className="select-none pr-1 text-muted-foreground">
            $
          </span>
          <code className="min-w-0 truncate">{current.command}</code>
          <CopyButton
            ariaLabel={`Copy ${current.command}`}
            content={current.command}
            label="Copy install command"
            onCopy={handleCopy}
          />
        </div>
        {action}
      </div>
    </div>
  );
};
