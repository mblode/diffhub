import type { CaptureResult } from "posthog-js";
import posthog from "posthog-js";

const isLocalHost = () => {
  if (typeof window === "undefined") {return false;}
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
};

const EXTENSION_EXCEPTION_MARKERS = [
  "runtime.sendMessage",
  "Extension context invalidated",
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "safari-web-extension://",
  "adoptedStyleSheets",
  "WNAdoptedStylesManager",
  "_makeContainerForSrcDocIFrame",
];

const NOISE_MESSAGE_MARKERS = [
  "AbortError",
  "The user aborted a request",
  "NetworkError",
  "A network error occurred",
  "Script error.",
  "Internal Next.js error",
];

const matchesMarker = (value: unknown, markers: string[]) =>
  typeof value === "string" && markers.some((m) => value.includes(m));

const isNoisyException = (event: CaptureResult): boolean => {
  if (event.event !== "$exception") {return false;}
  const exceptions = event.properties?.$exception_list;
  if (!Array.isArray(exceptions)) {return false;}
  return exceptions.some((exception) => {
    if (
      matchesMarker(exception?.value, EXTENSION_EXCEPTION_MARKERS) ||
      matchesMarker(exception?.type, EXTENSION_EXCEPTION_MARKERS) ||
      matchesMarker(exception?.value, NOISE_MESSAGE_MARKERS) ||
      matchesMarker(exception?.type, NOISE_MESSAGE_MARKERS)
    ) {
      return true;
    }
    const frames = exception?.stacktrace?.frames;
    if (
      Array.isArray(frames) &&
      frames.some(
        (frame: { abs_path?: unknown; filename?: unknown }) =>
          matchesMarker(frame?.filename, EXTENSION_EXCEPTION_MARKERS) ||
          matchesMarker(frame?.abs_path, EXTENSION_EXCEPTION_MARKERS) ||
          (typeof frame?.filename === "string" &&
            frame.filename.includes("node_modules/next/dist/client")) ||
          (typeof frame?.abs_path === "string" &&
            frame.abs_path.includes("node_modules/next/dist/client")),
      )
    ) {
      return true;
    }
    return false;
  });
};

if (!isLocalHost()) {
  posthog.init("phc_yYatHXysbRxjTyfmyCKSUyMSQpgepJPuxegz2HtpfX35", {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    before_send: (event) => {
      if (event && isNoisyException(event)) {return null;}
      return event;
    },
    defaults: "2026-05-30",
    ui_host: "https://us.posthog.com",
  });
}
