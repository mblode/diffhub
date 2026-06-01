// Client-safe catalog of syntax themes the diff viewer can render with.
//
// The list is the 4 Pierre themes (shipped by @pierre/diffs) followed by the
// 65 Shiki bundled themes. Regenerate the bundled portion with:
//
//   node -e "import('shiki').then(s=>process.stdout.write(JSON.stringify(s.bundledThemesInfo.map(t=>({id:t.id,name:t.displayName,type:t.type})))))"
//
// Theme ids are passed straight into CodeView's `options.theme` ({ light, dark }).
// They resolve lazily on the main thread via @pierre/diffs' getSharedHighlighter
// → getResolvedOrResolveTheme → shiki `bundledThemes[id]`, so no preload step is
// needed — selecting a new id re-renders with it on the next paint.

export interface DiffThemeInfo {
  id: string;
  name: string;
  type: "light" | "dark";
}

export const DEFAULT_LIGHT_THEME = "pierre-light-soft";
export const DEFAULT_DARK_THEME = "pierre-dark-soft";

export const DIFF_THEMES: readonly DiffThemeInfo[] = [
  // Pierre themes (provided by @pierre/diffs, not Shiki's bundle).
  { id: "pierre-light", name: "Pierre Light", type: "light" },
  { id: "pierre-light-soft", name: "Pierre Light Soft", type: "light" },
  { id: "pierre-dark", name: "Pierre Dark", type: "dark" },
  { id: "pierre-dark-soft", name: "Pierre Dark Soft", type: "dark" },
  // Shiki bundled themes.
  { id: "andromeeda", name: "Andromeeda", type: "dark" },
  { id: "aurora-x", name: "Aurora X", type: "dark" },
  { id: "ayu-dark", name: "Ayu Dark", type: "dark" },
  { id: "ayu-light", name: "Ayu Light", type: "light" },
  { id: "ayu-mirage", name: "Ayu Mirage", type: "dark" },
  { id: "catppuccin-frappe", name: "Catppuccin Frappé", type: "dark" },
  { id: "catppuccin-latte", name: "Catppuccin Latte", type: "light" },
  { id: "catppuccin-macchiato", name: "Catppuccin Macchiato", type: "dark" },
  { id: "catppuccin-mocha", name: "Catppuccin Mocha", type: "dark" },
  { id: "dark-plus", name: "Dark Plus", type: "dark" },
  { id: "dracula", name: "Dracula Theme", type: "dark" },
  { id: "dracula-soft", name: "Dracula Theme Soft", type: "dark" },
  { id: "everforest-dark", name: "Everforest Dark", type: "dark" },
  { id: "everforest-light", name: "Everforest Light", type: "light" },
  { id: "github-dark", name: "GitHub Dark", type: "dark" },
  { id: "github-dark-default", name: "GitHub Dark Default", type: "dark" },
  { id: "github-dark-dimmed", name: "GitHub Dark Dimmed", type: "dark" },
  { id: "github-dark-high-contrast", name: "GitHub Dark High Contrast", type: "dark" },
  { id: "github-light", name: "GitHub Light", type: "light" },
  { id: "github-light-default", name: "GitHub Light Default", type: "light" },
  { id: "github-light-high-contrast", name: "GitHub Light High Contrast", type: "light" },
  { id: "gruvbox-dark-hard", name: "Gruvbox Dark Hard", type: "dark" },
  { id: "gruvbox-dark-medium", name: "Gruvbox Dark Medium", type: "dark" },
  { id: "gruvbox-dark-soft", name: "Gruvbox Dark Soft", type: "dark" },
  { id: "gruvbox-light-hard", name: "Gruvbox Light Hard", type: "light" },
  { id: "gruvbox-light-medium", name: "Gruvbox Light Medium", type: "light" },
  { id: "gruvbox-light-soft", name: "Gruvbox Light Soft", type: "light" },
  { id: "horizon", name: "Horizon", type: "dark" },
  { id: "horizon-bright", name: "Horizon Bright", type: "dark" },
  { id: "houston", name: "Houston", type: "dark" },
  { id: "kanagawa-dragon", name: "Kanagawa Dragon", type: "dark" },
  { id: "kanagawa-lotus", name: "Kanagawa Lotus", type: "light" },
  { id: "kanagawa-wave", name: "Kanagawa Wave", type: "dark" },
  { id: "laserwave", name: "LaserWave", type: "dark" },
  { id: "light-plus", name: "Light Plus", type: "light" },
  { id: "material-theme", name: "Material Theme", type: "dark" },
  { id: "material-theme-darker", name: "Material Theme Darker", type: "dark" },
  { id: "material-theme-lighter", name: "Material Theme Lighter", type: "light" },
  { id: "material-theme-ocean", name: "Material Theme Ocean", type: "dark" },
  { id: "material-theme-palenight", name: "Material Theme Palenight", type: "dark" },
  { id: "min-dark", name: "Min Dark", type: "dark" },
  { id: "min-light", name: "Min Light", type: "light" },
  { id: "monokai", name: "Monokai", type: "dark" },
  { id: "night-owl", name: "Night Owl", type: "dark" },
  { id: "night-owl-light", name: "Night Owl Light", type: "light" },
  { id: "nord", name: "Nord", type: "dark" },
  { id: "one-dark-pro", name: "One Dark Pro", type: "dark" },
  { id: "one-light", name: "One Light", type: "light" },
  { id: "plastic", name: "Plastic", type: "dark" },
  { id: "poimandres", name: "Poimandres", type: "dark" },
  { id: "red", name: "Red", type: "dark" },
  { id: "rose-pine", name: "Rosé Pine", type: "dark" },
  { id: "rose-pine-dawn", name: "Rosé Pine Dawn", type: "light" },
  { id: "rose-pine-moon", name: "Rosé Pine Moon", type: "dark" },
  { id: "slack-dark", name: "Slack Dark", type: "dark" },
  { id: "slack-ochin", name: "Slack Ochin", type: "light" },
  { id: "snazzy-light", name: "Snazzy Light", type: "light" },
  { id: "solarized-dark", name: "Solarized Dark", type: "dark" },
  { id: "solarized-light", name: "Solarized Light", type: "light" },
  { id: "synthwave-84", name: "Synthwave '84", type: "dark" },
  { id: "tokyo-night", name: "Tokyo Night", type: "dark" },
  { id: "vesper", name: "Vesper", type: "dark" },
  { id: "vitesse-black", name: "Vitesse Black", type: "dark" },
  { id: "vitesse-dark", name: "Vitesse Dark", type: "dark" },
  { id: "vitesse-light", name: "Vitesse Light", type: "light" },
];

export interface DiffThemeSelection {
  light: string;
  dark: string;
}

export const DEFAULT_DIFF_THEMES: DiffThemeSelection = {
  dark: DEFAULT_DARK_THEME,
  light: DEFAULT_LIGHT_THEME,
};

const LIGHT_THEME_IDS = new Set(DIFF_THEMES.filter((t) => t.type === "light").map((t) => t.id));
const DARK_THEME_IDS = new Set(DIFF_THEMES.filter((t) => t.type === "dark").map((t) => t.id));

/**
 * Validate a persisted theme selection, falling back to the github defaults for
 * any id that is not a known light/dark theme. Keeps a corrupt localStorage
 * value from feeding an unresolvable id into CodeView.
 */
export const normalizeDiffThemes = (value: unknown): DiffThemeSelection => {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_DIFF_THEMES;
  }
  const candidate = value as Partial<DiffThemeSelection>;
  return {
    dark:
      typeof candidate.dark === "string" && DARK_THEME_IDS.has(candidate.dark)
        ? candidate.dark
        : DEFAULT_DARK_THEME,
    light:
      typeof candidate.light === "string" && LIGHT_THEME_IDS.has(candidate.light)
        ? candidate.light
        : DEFAULT_LIGHT_THEME,
  };
};
