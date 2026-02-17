import React from "react";
import {
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Text } from "./Text";
import { colors, fontFamily, fontSize, radius, spacing } from "@/theme";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps {
  variant?: ButtonVariant;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

const variantStyles: Record<
  ButtonVariant,
  { bg: string; text: string }
> = {
  primary: {
    bg: colors.buttonPrimary,
    text: colors.buttonPrimaryText,
  },
  secondary: {
    bg: colors.buttonSecondary,
    text: colors.buttonSecondaryText,
  },
  ghost: {
    bg: colors.buttonGhost,
    text: colors.buttonGhostText,
  },
};

export function Button({
  variant = "primary",
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const { bg, text } = variantStyles[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={text} />
      ) : (
        <Text
          variant="bodyMedium"
          style={[
            styles.label,
            { color: text, fontFamily: fontFamily.semiBold },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[6],
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: fontSize.base,
  },
});
