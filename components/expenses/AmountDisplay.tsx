import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "@/components/ui/Text";
import { spacing } from "@/theme";

interface AmountDisplayProps {
  /** Raw display string from numpad, e.g. "1234.50" */
  display: string;
  /** Whether the amount is effectively zero/empty */
  isEmpty: boolean;
}

export function AmountDisplay({ display, isEmpty }: AmountDisplayProps) {
  return (
    <View style={styles.container}>
      <Text
        variant="moneyLarge"
        color={isEmpty ? "textTertiary" : "textPrimary"}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {"\u20B1"} {isEmpty ? "0.00" : display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[4],
  },
});
