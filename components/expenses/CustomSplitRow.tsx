import React, { useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { Text } from "@/components/ui/Text";
import { Avatar } from "@/components/ui/Avatar";
import { colors, spacing, radius, fontFamily, fontSize } from "@/theme";
import { formatPeso, pesosToCentavos } from "@/lib/expense-utils";

interface Member {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface CustomSplitRowProps {
  member: Member;
  amountCentavos: number;
  onAmountChange: (centavos: number) => void;
}

export function CustomSplitRow({
  member,
  amountCentavos,
  onAmountChange,
}: CustomSplitRowProps) {
  const [inputValue, setInputValue] = useState(
    amountCentavos > 0 ? formatPeso(amountCentavos) : "",
  );

  function handleChangeText(text: string) {
    // Strip non-numeric except decimal
    const cleaned = text.replace(/[^0-9.]/g, "");

    // Prevent multiple decimals
    const parts = cleaned.split(".");
    const sanitized =
      parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;

    // Limit to 2 decimal places
    const decimalIndex = sanitized.indexOf(".");
    const limited =
      decimalIndex !== -1 && sanitized.length - decimalIndex > 3
        ? sanitized.slice(0, decimalIndex + 3)
        : sanitized;

    setInputValue(limited);

    const parsed = parseFloat(limited);
    if (isNaN(parsed)) {
      onAmountChange(0);
    } else {
      onAmountChange(pesosToCentavos(parsed));
    }
  }

  function handleBlur() {
    // Re-format on blur
    if (amountCentavos > 0) {
      setInputValue(formatPeso(amountCentavos));
    } else {
      setInputValue("");
    }
  }

  function handleFocus() {
    // Show raw number on focus for easy editing
    if (amountCentavos > 0) {
      setInputValue((amountCentavos / 100).toString());
    }
  }

  return (
    <View style={styles.row}>
      <Avatar emoji={member.avatar_url || undefined} size="sm" />
      <Text
        variant="bodyMedium"
        color="textPrimary"
        style={styles.name}
        numberOfLines={1}
      >
        {member.display_name}
      </Text>
      <View style={styles.inputContainer}>
        <Text variant="body" color="textTertiary" style={styles.pesoSign}>
          {"\u20B1"}
        </Text>
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          onFocus={handleFocus}
          keyboardType="numeric"
          placeholder="0.00"
          placeholderTextColor={colors.inputPlaceholder}
          selectionColor={colors.accent}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  name: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    minWidth: 100,
  },
  pesoSign: {
    marginRight: spacing[1],
  },
  input: {
    color: colors.inputText,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    paddingVertical: spacing[2],
    minWidth: 60,
    textAlign: "right",
  },
});
