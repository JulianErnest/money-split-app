import React from "react";
import { RefreshControl, RefreshControlProps } from "react-native";
import { colors } from "@/theme";

/**
 * Themed RefreshControl with accent-colored indicator.
 * Drop-in replacement for React Native's RefreshControl,
 * pre-configured with the app's dark theme colors.
 */
export function AnimatedRefreshControl({
  refreshing,
  onRefresh,
  ...rest
}: RefreshControlProps) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.accent}
      colors={[colors.accent]}
      progressBackgroundColor={colors.surface}
      {...rest}
    />
  );
}
