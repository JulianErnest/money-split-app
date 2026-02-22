import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { spacing } from "@/theme";
import React from "react";
import { Text as RNText, StyleSheet, View } from "react-native";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  emoji: string;
  headline: string;
  subtext: string;
  actionLabel?: string;
  onAction?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function EmptyState({ emoji, headline, subtext, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <RNText style={styles.emoji}>{emoji}</RNText>
      <Text variant="bodyMedium" color="textPrimary" style={styles.headline}>
        {headline}
      </Text>
      <Text variant="body" color="textSecondary" style={styles.subtext}>
        {subtext}
      </Text>
      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          variant="primary"
          onPress={onAction}
          style={styles.action}
        />
      )}
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
  action: {
    marginTop: spacing[5],
  },
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { EmptyState };
export type { EmptyStateProps };
