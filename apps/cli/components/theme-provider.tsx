"use client";

import * as React from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  forcedTheme?: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: React.SetStateAction<string>) => void;
  systemTheme: Theme;
  theme: Theme;
  themes: Theme[];
}

interface ThemeProviderProps {
  attribute?: "class" | string;
  children?: React.ReactNode;
  defaultTheme?: Theme;
  disableTransitionOnChange?: boolean;
  enableSystem?: boolean;
}

const STORAGE_KEY = "theme";
const DEFAULT_THEME: Theme = "dark";

const ThemeContext = React.createContext<ThemeContextValue>({
  resolvedTheme: DEFAULT_THEME,
  setTheme: () => {
    // Default context only applies outside ThemeProvider.
  },
  systemTheme: DEFAULT_THEME,
  theme: DEFAULT_THEME,
  themes: ["light", "dark"],
});

const isTheme = (value: unknown): value is Theme => value === "dark" || value === "light";

const getStoredTheme = (fallback: Theme): Theme => {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
};

const applyTheme = (theme: Theme, attribute: string): void => {
  const root = document.documentElement;
  if (attribute === "class") {
    root.classList.remove("dark", "light");
    root.classList.add(theme);
  } else {
    root.setAttribute(attribute, theme);
  }
  root.style.colorScheme = theme;
};

export const ThemeProvider = ({
  attribute = "class",
  children,
  defaultTheme = DEFAULT_THEME,
}: ThemeProviderProps) => {
  const fallback = isTheme(defaultTheme) ? defaultTheme : DEFAULT_THEME;
  const [theme, setTheme] = React.useState<Theme>(() => getStoredTheme(fallback));

  React.useEffect(() => {
    applyTheme(theme, attribute);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage unavailable
    }
  }, [attribute, theme]);

  const setResolvedTheme = React.useCallback((nextTheme: React.SetStateAction<string>) => {
    setTheme((current) => {
      const value = typeof nextTheme === "function" ? nextTheme(current) : nextTheme;
      return isTheme(value) ? value : current;
    });
  }, []);

  const value = React.useMemo(
    () => ({
      resolvedTheme: theme,
      setTheme: setResolvedTheme,
      systemTheme: theme,
      theme,
      themes: ["light", "dark"] as Theme[],
    }),
    [setResolvedTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => React.useContext(ThemeContext);
