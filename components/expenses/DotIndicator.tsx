import React from "react";
import { View, StyleSheet } from "react-native";
import { colors, spacing } from "@/theme";

interface DotIndicatorProps {
  current: number;
  total: number;
}

export function DotIndicator({ current, total }: DotIndicatorProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i === current ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing[2],
    paddingVertical: spacing[3],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
  dotInactive: {
    backgroundColor: colors.surface,
  },
});
