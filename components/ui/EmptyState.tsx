import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { spacing } from "@/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  emoji: string;
  headline: string;
  subtext: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function EmptyState({ emoji, headline, subtext }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text variant="bodyMedium" color="textPrimary" style={styles.headline}>
        {headline}
      </Text>
      <Text variant="body" color="textSecondary" style={styles.subtext}>
        {subtext}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[6],
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing[3],
  },
  headline: {
    textAlign: "center",
    marginBottom: spacing[2],
  },
  subtext: {
    textAlign: "center",
    maxWidth: 280,
  },
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { EmptyState };
export type { EmptyStateProps };
