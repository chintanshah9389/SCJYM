export type AppThemeName = "blue" | "rose";

export const themePresets = {
  blue: {
    brand: {
      base: "#0f4c97",
      deep: "#072b57",
      soft: "#3a73b8",
      tint: "#f3f8ff",
      accent: "#21b1ff",
      accentSoft: "#bfe8ff",
      ink: "#0b1f36",
      gradients: {
        splash: ["#06356f", "#0f4c97", "#27a4f2"] as const,
        hero: ["#083b79", "#1557ab", "#2b9fe8"] as const,
        header: ["#0b4388", "#1f5eb0", "#37a6ec"] as const,
        tabBar: ["#ffffff", "#f3f8ff"] as const,
      },
    },
    ui: {
      pageBg: "#f5f9ff",
      card: "#ffffff",
      text: "#132742",
      textMuted: "#5f7692",
      border: "#dbe8f8",
      danger: "#dc2626",
      success: "#0f8a5f",
      info: "#0f4c97",
      surfaceBlue: "#eef5ff",
    },
    shadows: {
      card: {
        shadowColor: "#133a73",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 18,
        elevation: 4,
      },
      soft: {
        shadowColor: "#17427f",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 2,
      },
    },
  },
  rose: {
    brand: {
      base: "#c01e3a",
      deep: "#5f1524",
      soft: "#ea6e83",
      tint: "#fff8f8",
      accent: "#ff9a5f",
      accentSoft: "#ffd7bf",
      ink: "#3c1a21",
      gradients: {
        splash: ["#b32b43", "#df5f77", "#ffb487"] as const,
        hero: ["#b22a42", "#e26279", "#ffb98f"] as const,
        header: ["#bf3550", "#e9778f", "#ffcfac"] as const,
        tabBar: ["#ffffff", "#fff6f6"] as const,
      },
    },
    ui: {
      pageBg: "#fffafa",
      card: "#ffffff",
      text: "#3a1f26",
      textMuted: "#a2767e",
      border: "#f7dfe3",
      danger: "#dc2626",
      success: "#0f8a5f",
      info: "#bf3550",
      surfaceBlue: "#fff8f8",
    },
    shadows: {
      card: {
        shadowColor: "#7f2a3a",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 18,
        elevation: 4,
      },
      soft: {
        shadowColor: "#8a2f40",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 2,
      },
    },
  },
} as const;

const defaultTheme = themePresets.blue;

export const brand = defaultTheme.brand;
export const ui = defaultTheme.ui;
export const shadows = defaultTheme.shadows;
