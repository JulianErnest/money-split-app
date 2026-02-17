import React, { useState } from "react";
import { View, TextInput, TextInputProps, StyleSheet } from "react-native";
import { Text } from "./Text";
import { colors, fontFamily, fontSize, spacing } from "@/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : focused
      ? colors.inputBorderFocused
      : colors.inputBorder;

  return (
    <View style={styles.container}>
      {label && (
        <Text variant="label" color="textTertiary" style={styles.label}>
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor={colors.inputPlaceholder}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[styles.input, { borderBottomColor: borderColor }, style]}
        {...props}
      />
      {error && (
        <Text variant="caption" color="error" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    marginBottom: spacing[1],
  },
  input: {
    color: colors.inputText,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  error: {
    marginTop: spacing[1],
  },
});
