/**
 * Design System: Color Tokens
 *
 * Two-tier color system:
 * 1. Palette (primitives) - raw color values, never used directly in components
 * 2. Semantic tokens - meaningful names used throughout the app
 */

export const palette = {
  nearBlack: "#0D0D0D",
  dark1: "#141414",
  dark2: "#1A1A1A",
  dark3: "#222222",
  dark4: "#2A2A2A",
  dark5: "#333333",
  gray1: "#666666",
  gray2: "#888888",
  gray3: "#AAAAAA",
  gray4: "#CCCCCC",
  white: "#FFFFFF",
  green: "#9FE870",
  greenDark: "#7BC44E",
  greenSubtle: "#1A2E10",
  red: "#E85454",
  yellow: "#FFEB69",
} as const;

export const colors = {
  // Backgrounds
  background: palette.nearBlack,
  backgroundElevated: palette.dark1,
  backgroundCard: palette.dark2,

  // Surfaces
  surface: palette.dark3,
  surfaceElevated: palette.dark4,
  surfacePressed: palette.dark5,

  // Text
  textPrimary: palette.white,
  textSecondary: palette.gray3,
  textTertiary: palette.gray1,
  textInverse: palette.nearBlack,

  // Accent
  accent: palette.green,
  accentPressed: palette.greenDark,
  accentSubtle: palette.greenSubtle,

  // Buttons
  buttonPrimary: palette.green,
  buttonPrimaryText: palette.nearBlack,
  buttonSecondary: palette.dark3,
  buttonSecondaryText: palette.white,
  buttonGhost: "transparent",
  buttonGhostText: palette.white,

  // Inputs
  inputBorder: palette.dark5,
  inputBorderFocused: palette.green,
  inputText: palette.white,
  inputPlaceholder: palette.gray1,

  // Borders
  border: palette.dark4,
  borderSubtle: palette.dark3,

  // Status
  error: palette.red,
  warning: palette.yellow,
  success: palette.green,

  // Tab Bar
  tabBar: palette.dark1,
  tabBarBorder: palette.dark3,
  tabActive: palette.green,
  tabInactive: palette.gray1,
} as const;
