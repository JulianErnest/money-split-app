import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui/Text";
import { colors, spacing, radius } from "@/theme";

type SplitType = "equal" | "custom";

interface SplitTypeToggleProps {
  value: SplitType;
  onChange: (value: SplitType) => void;
}

export function SplitTypeToggle({ value, onChange }: SplitTypeToggleProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.option, value === "equal" && styles.optionActive]}
        onPress={() => onChange("equal")}
      >
        <Text
          variant="bodyMedium"
          color={value === "equal" ? "textInverse" : "textSecondary"}
        >
          Equal
        </Text>
      </Pressable>
      <Pressable
        style={[styles.option, value === "custom" && styles.optionActive]}
        onPress={() => onChange("custom")}
      >
        <Text
          variant="bodyMedium"
          color={value === "custom" ? "textInverse" : "textSecondary"}
        >
          Custom
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[1],
  },
  option: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
  },
  optionActive: {
    backgroundColor: colors.accent,
  },
});
