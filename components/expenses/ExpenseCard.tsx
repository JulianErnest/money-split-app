import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { formatPeso } from "@/lib/expense-utils";
import { colors, spacing } from "@/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpenseCardExpense {
  id: string;
  description: string;
  amount: number; // DB stores pesos (numeric)
  paid_by: string;
  split_type: string;
  created_at: string;
  users: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface ExpenseCardSplit {
  user_id: string;
  amount: number; // DB stores pesos (numeric)
}

interface ExpenseCardProps {
  expense: ExpenseCardExpense;
  splits: ExpenseCardSplit[];
  currentUserId: string;
  onPress: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatExpenseDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  // Check if today
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return "Today";
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface BalanceImpact {
  text: string;
  color: string;
}

function getBalanceImpact(
  expense: ExpenseCardExpense,
  splits: ExpenseCardSplit[],
  currentUserId: string,
): BalanceImpact {
  const isPayer = expense.paid_by === currentUserId;
  const userSplit = splits.find((s) => s.user_id === currentUserId);

  if (!userSplit) {
    return { text: "Not involved", color: colors.textSecondary };
  }

  const totalAmountCentavos = Math.round(expense.amount * 100);
  const userSplitCentavos = Math.round(userSplit.amount * 100);

  if (isPayer) {
    const lentCentavos = totalAmountCentavos - userSplitCentavos;
    if (lentCentavos === 0) {
      return {
        text: `You paid ${formatPeso(totalAmountCentavos)}`,
        color: colors.textSecondary,
      };
    }
    return {
      text: `You lent ${formatPeso(lentCentavos)}`,
      color: colors.accent,
    };
  }

  return {
    text: `You owe ${formatPeso(userSplitCentavos)}`,
    color: colors.error,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExpenseCard({
  expense,
  splits,
  currentUserId,
  onPress,
}: ExpenseCardProps) {
  const payerName = expense.users.display_name || "Unknown";
  const payerEmoji = expense.users.avatar_url || undefined;
  const totalDisplay = formatPeso(Math.round(expense.amount * 100));
  const balance = getBalanceImpact(expense, splits, currentUserId);

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.row}>
          {/* Left: payer avatar */}
          <Avatar emoji={payerEmoji} size="sm" />

          {/* Middle: description, payer, date */}
          <View style={styles.middle}>
            <Text
              variant="bodyMedium"
              color="textPrimary"
              numberOfLines={1}
            >
              {expense.description}
            </Text>
            <Text variant="caption" color="textSecondary">
              Paid by {payerName}
            </Text>
            <Text variant="caption" color="textSecondary">
              {formatExpenseDate(expense.created_at)}
            </Text>
          </View>

          {/* Right: amount and balance impact */}
          <View style={styles.right}>
            <Text variant="bodyMedium" color="textPrimary">
              {totalDisplay}
            </Text>
            <Text variant="caption" style={{ color: balance.color }}>
              {balance.text}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  middle: {
    flex: 1,
    gap: 2,
  },
  right: {
    alignItems: "flex-end",
    gap: 2,
  },
});
