import React from "react";
import { View, ViewProps, StyleSheet } from "react-native";
import { colors, radius, spacing } from "@/theme";

interface CardProps extends ViewProps {
  elevated?: boolean;
}

export function Card({ elevated = false, style, children, ...props }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        elevated && styles.elevated,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  elevated: {
    backgroundColor: colors.surfaceElevated,
  },
});
