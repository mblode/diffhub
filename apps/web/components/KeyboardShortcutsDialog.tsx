"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Kbd } from "@/components/ui/kbd";

interface ShortcutRowProps {
  keys: string[];
  description: string;
}

const ShortcutRow = ({ keys, description }: ShortcutRowProps) => (
  <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
    <span className="text-sm text-foreground">{description}</span>
    <div className="flex items-center gap-1">
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </div>
  </div>
);

const SHORTCUTS: ShortcutRowProps[] = [
  { description: "Next file", keys: ["j"] },
  { description: "Previous file", keys: ["k"] },
  { description: "Toggle viewed", keys: ["v"] },
  { description: "Toggle split / unified", keys: ["s"] },
  { description: "Refresh diff", keys: ["r"] },
  { description: "Focus file filter", keys: ["/"] },
  { description: "Open keyboard shortcuts", keys: ["?"] },
];

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsDialog = ({ open, onClose }: KeyboardShortcutsDialogProps) => (
  <Dialog.Root
    open={open}
    // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
    onOpenChange={(o) => {
      if (!o) {
        onClose();
      }
    }}
  >
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
      <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl dark:shadow-none outline-none transition-[opacity,transform] duration-200 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <Dialog.Title className="text-sm font-semibold text-foreground">
            Keyboard shortcuts
          </Dialog.Title>
          <Dialog.Close
            aria-label="Close"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
          >
            ×
          </Dialog.Close>
        </div>

        {/* Shortcuts list */}
        <div className="px-5 py-1">
          {SHORTCUTS.map((s) => (
            <ShortcutRow key={s.description} {...s} />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">
            Press <Kbd>?</Kbd> anywhere to open this dialog
          </p>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
);
