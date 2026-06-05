import React, { createContext, useContext, useMemo, useState } from "react";
import { AppThemeName, themePresets } from "@/lib/theme";

type ThemeContextValue = {
  themeName: AppThemeName;
  setThemeName: (name: AppThemeName) => void;
  theme: (typeof themePresets)[AppThemeName];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<AppThemeName>("blue");

  const value = useMemo(
    () => ({
      themeName,
      setThemeName,
      theme: themePresets[themeName],
    }),
    [themeName]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }
  return ctx;
}
