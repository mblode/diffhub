/**
 * The CLI viewer's keyboard shortcuts, read from the `handleKey` effect in
 * `apps/cli/components/DiffApp.tsx` and the comment box's `onKeyDown` in
 * `apps/cli/components/DiffViewer.tsx`. This app does not depend on the CLI
 * package, so the list is restated rather than imported. Re-read both files
 * before editing it: a shortcut that doesn't work is the fastest way to lose a
 * reader who just installed the thing.
 *
 * The viewer ignores the global shortcuts while focus is in a text field,
 * which is why the comment keys are listed separately.
 */
export interface Shortcut {
  keys: string[];
  label: string;
}

export const VIEWER_SHORTCUTS: Shortcut[] = [
  { keys: ["j"], label: "Next file" },
  { keys: ["k"], label: "Previous file" },
  { keys: ["s"], label: "Switch between split and unified view" },
  { keys: ["/"], label: "Filter the file tree (t works too)" },
  { keys: ["r"], label: "Refresh the diff" },
  { keys: ["c"], label: "Collapse or expand the current file" },
  { keys: ["Shift", "C"], label: "Collapse every file" },
  { keys: ["Shift", "E"], label: "Expand every file" },
  { keys: ["F2"], label: "Show or hide the diff stats panel" },
];

export const COMMENT_SHORTCUTS: Shortcut[] = [
  { keys: ["Cmd", "Enter"], label: "Save the comment" },
  { keys: ["Esc"], label: "Cancel the comment" },
];
