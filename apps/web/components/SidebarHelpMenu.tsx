"use client";

import { KeyboardCableIcon } from "blode-icons-react";
import { useEffect, useRef, useState } from "react";
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog";
import { Kbd } from "@/components/ui/kbd";

export const SidebarHelpMenu = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // ? shortcut opens keyboard shortcuts dialog
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }
      if (e.key === "?") {
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Help and settings"
        // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onClick={() => setMenuOpen((o) => !o)}
        className="flex size-6 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
      >
        <svg
          aria-hidden="true"
          className="size-3.5"
          fill="currentColor"
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M7.569 9.75c-.332 0-.614-.27-.578-.6.021-.188.061-.372.136-.62q.158-.51.447-.82a3.4 3.4 0 0 1 .703-.577q.284-.182.507-.396.229-.219.358-.486a1.4 1.4 0 0 0 .13-.606 1.2 1.2 0 0 0-.171-.653 1.2 1.2 0 0 0-.466-.429 1.36 1.36 0 0 0-.647-.152q-.33 0-.628.148a1.23 1.23 0 0 0-.587.622c-.123.295-.367.555-.686.555h-.472c-.337 0-.616-.28-.55-.611q.103-.513.363-.905a2.55 2.55 0 0 1 1.08-.915A3.6 3.6 0 0 1 7.998 3q.888 0 1.563.32.68.319 1.057.91.382.586.382 1.392 0 .543-.172.972a2.4 2.4 0 0 1-.48.763 3.5 3.5 0 0 1-.74.595 3.2 3.2 0 0 0-.62.496 1.7 1.7 0 0 0-.353.605l-.034.106c-.1.316-.35.591-.682.591zM8.75 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />
        </svg>
      </button>

      {menuOpen && (
        <div className="diffr-menu-animate absolute bottom-full left-0 mb-1.5 z-50 min-w-[180px] rounded-lg border border-border bg-card shadow-lg dark:shadow-none py-1">
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
            // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onClick={() => {
              setShortcutsOpen(true);
              setMenuOpen(false);
            }}
          >
            <KeyboardCableIcon size={14} className="text-muted-foreground shrink-0" />
            Keyboard shortcuts
            <Kbd className="ml-auto">?</Kbd>
          </button>
        </div>
      )}

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
};
