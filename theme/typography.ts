/**
 * Design System: Typography Tokens
 *
 * Font family, size scale, line heights, and semantic text styles.
 * All components should use textStyles for consistency.
 */

import { TextStyle } from "react-native";

export const fontFamily = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semiBold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extraBold: "PlusJakartaSans_800ExtraBold",
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
  hero: 48,
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export const textStyles = {
  moneyLarge: {
    fontFamily: fontFamily.extraBold,
    fontSize: fontSize.hero,
    lineHeight: fontSize.hero * lineHeight.tight,
  } as TextStyle,

  moneyMedium: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize["3xl"],
    lineHeight: fontSize["3xl"] * lineHeight.tight,
  } as TextStyle,

  moneySmall: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.tight,
  } as TextStyle,

  h1: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize["3xl"],
    lineHeight: fontSize["3xl"] * lineHeight.tight,
  } as TextStyle,

  h2: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize["2xl"],
    lineHeight: fontSize["2xl"] * lineHeight.tight,
  } as TextStyle,

  h3: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.tight,
  } as TextStyle,

  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.relaxed,
  } as TextStyle,

  bodyMedium: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.relaxed,
  } as TextStyle,

  caption: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
  } as TextStyle,

  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  } as TextStyle,
} as const;
