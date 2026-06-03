export type WatchHealth = "connecting" | "live" | "offline";

export interface RefreshStatusMeta {
  /** Solid background colour for the status-bar refresh dot. */
  dotClassName: string;
  label: string;
}

/**
 * Display metadata for the status-bar refresh control. The diff never refreshes
 * on its own — a background detector only watches for changes and raises
 * `updatesAvailable` so the user knows a manual refresh would pull in new
 * changes. The StatusBar renders `dotClassName` as a status dot and surfaces
 * `label` via the refresh button's tooltip/aria-label.
 */
export const getRefreshStatusMeta = (
  updatesAvailable: boolean,
  watchHealth: WatchHealth,
): RefreshStatusMeta => {
  if (updatesAvailable) {
    return {
      dotClassName: "bg-blue-500 animate-pulse",
      label: "Updates available",
    };
  }

  if (watchHealth === "offline") {
    return {
      dotClassName: "bg-amber-500",
      label: "Change detection offline",
    };
  }

  if (watchHealth === "connecting") {
    return {
      dotClassName: "bg-muted-foreground",
      label: "Connecting…",
    };
  }

  return {
    dotClassName: "bg-diff-green",
    label: "Up to date",
  };
};
