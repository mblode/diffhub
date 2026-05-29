// Client-safe display settings for the diff viewer toolbar's settings panel.
// Persisted as a single JSON object under `diffhub-display-settings`.

export type DiffIndicatorStyle = "classic" | "bars" | "none";

export interface DisplaySettings {
  showBackgrounds: boolean;
  showLineNumbers: boolean;
  wordWrap: boolean;
  diffIndicators: DiffIndicatorStyle;
}

export const DISPLAY_SETTINGS_KEY = "diffhub-display-settings";

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  diffIndicators: "classic",
  showBackgrounds: true,
  showLineNumbers: true,
  wordWrap: true,
};

const INDICATOR_VALUES = new Set<DiffIndicatorStyle>(["classic", "bars", "none"]);

/**
 * Validate a persisted display-settings object, filling any missing or invalid
 * field with its default. Guards against corrupt localStorage values.
 */
export const normalizeDisplaySettings = (value: unknown): DisplaySettings => {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_DISPLAY_SETTINGS;
  }
  const candidate = value as Partial<Record<keyof DisplaySettings, unknown>>;
  return {
    diffIndicators: INDICATOR_VALUES.has(candidate.diffIndicators as DiffIndicatorStyle)
      ? (candidate.diffIndicators as DiffIndicatorStyle)
      : DEFAULT_DISPLAY_SETTINGS.diffIndicators,
    showBackgrounds:
      typeof candidate.showBackgrounds === "boolean"
        ? candidate.showBackgrounds
        : DEFAULT_DISPLAY_SETTINGS.showBackgrounds,
    showLineNumbers:
      typeof candidate.showLineNumbers === "boolean"
        ? candidate.showLineNumbers
        : DEFAULT_DISPLAY_SETTINGS.showLineNumbers,
    wordWrap:
      typeof candidate.wordWrap === "boolean"
        ? candidate.wordWrap
        : DEFAULT_DISPLAY_SETTINGS.wordWrap,
  };
};
