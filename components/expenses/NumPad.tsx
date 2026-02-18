import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui/Text";
import { colors, spacing, radius } from "@/theme";

interface NumPadProps {
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onBackspace: () => void;
}

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "del"],
];

export function NumPad({ onDigit, onDecimal, onBackspace }: NumPadProps) {
  function handlePress(key: string) {
    if (key === ".") onDecimal();
    else if (key === "del") onBackspace();
    else onDigit(key);
  }

  return (
    <View style={styles.container}>
      {KEYS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.key,
                pressed && styles.keyPressed,
              ]}
              onPress={() => handlePress(key)}
            >
              <Text variant="h3" color="textPrimary">
                {key === "del" ? "\u{2190}" : key}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
    paddingHorizontal: spacing[4],
  },
  row: {
    flexDirection: "row",
    gap: spacing[2],
  },
  key: {
    flex: 1,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  keyPressed: {
    backgroundColor: colors.surfacePressed,
  },
});
