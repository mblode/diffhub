"use client";

import { useEffect, useRef, useState } from "react";
import {
  FolderOpenIcon,
  CodeLinesIcon,
  CodeBracketsIcon,
  CopySimpleIcon,
  CheckIcon,
  ArrowUndoDownIcon,
} from "blode-icons-react";

interface ContextMenuProps {
  x: number;
  y: number;
  filePath: string;
  repoPath: string;
  onClose: () => void;
  onDiscard?: () => Promise<void>;
}

const APPS = [
  { icon: FolderOpenIcon, key: "finder", label: "Finder" },
  { icon: CodeLinesIcon, key: "zed", label: "Zed" },
  { icon: CodeLinesIcon, key: "vscode", label: "VS Code" },
  { icon: CodeLinesIcon, key: "xcode", label: "Xcode" },
  { icon: CodeBracketsIcon, key: "ghostty", label: "Ghostty" },
  { icon: CodeBracketsIcon, key: "terminal", label: "Terminal" },
] as const;

type AppKey = (typeof APPS)[number]["key"];

export const ContextMenu = ({ x, y, filePath, repoPath, onClose, onDiscard }: ContextMenuProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const openIn = async (app: AppKey) => {
    const fullPath = `${repoPath}/${filePath}`;
    try {
      await fetch("/api/open", {
        body: JSON.stringify({ app, path: fullPath }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    } catch {
      // best-effort — still close the menu
    }
    onClose();
  };

  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const handleDiscard = async () => {
    if (!onDiscard || discarding) {
      return;
    }
    setDiscarding(true);
    try {
      await onDiscard();
      onClose();
    } finally {
      setDiscarding(false);
    }
  };

  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const copyPath = async () => {
    const fullPath = `${repoPath}/${filePath}`;
    try {
      await navigator.clipboard.writeText(fullPath);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1200);
    } catch {
      onClose();
    }
  };

  // Adjust position to stay in viewport
  const style: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 200),
    position: "fixed",
    top: Math.min(y, window.innerHeight - 300),
    zIndex: 1000,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="diffhub-menu-animate min-w-[160px] rounded-lg border border-border bg-popover shadow-xl dark:shadow-none py-1 text-sm"
    >
      {/* File path header */}
      <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border mb-1 font-mono truncate max-w-[200px]">
        {filePath.split("/").pop()}
      </div>

      {APPS.map(({ key, label, icon: Icon }) => (
        <button
          type="button"
          key={key}
          // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
          onClick={() => openIn(key)}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
        >
          <Icon size={14} className="text-muted-foreground" />
          {label}
        </button>
      ))}

      <div className="border-t border-border mt-1 pt-1">
        <button
          type="button"
          // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
          onClick={copyPath}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
        >
          {copied ? (
            <CheckIcon size={14} className="text-diff-green" />
          ) : (
            <CopySimpleIcon size={14} className="text-muted-foreground" />
          )}
          {copied ? "Copied!" : "Copy path"}
        </button>
        {onDiscard && (
          <button
            type="button"
            // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onClick={handleDiscard}
            disabled={discarding}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            <ArrowUndoDownIcon size={14} className={discarding ? "animate-spin" : ""} />
            Discard changes
          </button>
        )}
      </div>
    </div>
  );
};
