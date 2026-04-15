"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export const ThemeProvider = ({
  children,
  ...props
}: ThemeProviderProps & { children?: React.ReactNode }) => (
  <NextThemesProvider {...props}>{children}</NextThemesProvider>
);
