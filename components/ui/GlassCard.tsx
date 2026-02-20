import React from "react";
import { View, ViewProps, StyleSheet } from "react-native";
import { radius, spacing } from "@/theme";

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
}

export function GlassCard({ style, children, ...props }: GlassCardProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: radius.lg,
    padding: spacing[4],
  },
});
