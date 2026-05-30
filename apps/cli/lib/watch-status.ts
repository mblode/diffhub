export type WatchStatus = "connecting" | "live" | "offline" | "updated";

export interface WatchStatusMeta {
  /** Chip styling (border + bg + text) used by the StatusBar pill. */
  className: string;
  /** Solid background colour for the System Monitor status dot. */
  dotClassName: string;
  label: string;
}

/**
 * Shared mapping from watch state → display metadata, used by both the
 * StatusBar pill and the sidebar's System Monitor panel. `updating` (a manual
 * or change-triggered refresh in flight) takes precedence over the base state.
 */
export const getWatchStatusMeta = (status: WatchStatus, updating: boolean): WatchStatusMeta => {
  if (updating) {
    return {
      className: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
      dotClassName: "bg-blue-500",
      label: "Updating…",
    };
  }

  if (status === "updated") {
    return {
      className: "border-diff-green/30 bg-diff-green/10 text-diff-green",
      dotClassName: "bg-diff-green",
      label: "Updated just now",
    };
  }

  if (status === "offline") {
    return {
      className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      dotClassName: "bg-amber-500",
      label: "Watch offline",
    };
  }

  if (status === "connecting") {
    return {
      className: "border-border bg-muted/40 text-muted-foreground",
      dotClassName: "bg-muted-foreground",
      label: "Connecting…",
    };
  }

  return {
    className: "border-border bg-muted/40 text-muted-foreground",
    dotClassName: "bg-diff-green",
    label: "Live",
  };
};
