import React from "react";
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from "react-native";
import { colors, textStyles } from "@/theme";

type TextVariant = keyof typeof textStyles;
type ColorKey = keyof typeof colors;

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: ColorKey;
}

export function Text({
  variant = "body",
  color = "textPrimary",
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      style={[textStyles[variant], { color: colors[color] as string }, style]}
      {...props}
    />
  );
}
