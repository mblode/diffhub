export const WATCH_STREAM_EVENTS = {
  CHANGE: "change",
  ERROR: "watch-error",
  READY: "ready",
} as const;

export type WatchStreamEvent = (typeof WATCH_STREAM_EVENTS)[keyof typeof WATCH_STREAM_EVENTS];
