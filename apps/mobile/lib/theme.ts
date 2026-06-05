export const brand = {
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
};

export const ui = {
  pageBg: "#fffafa",
  card: "#ffffff",
  text: "#3a1f26",
  textMuted: "#a2767e",
  border: "#f7dfe3",
  danger: "#dc2626",
  success: "#0f8a5f",
  info: "#bf3550",
  surfaceBlue: "#fff8f8",
};

export const shadows = {
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
};
