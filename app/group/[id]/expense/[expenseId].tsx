import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "@/components/ui/Text";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabase";
import { formatPeso } from "@/lib/expense-utils";
import { colors, spacing, radius } from "@/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpenseSplitRow {
  user_id: string;
  amount: number;
  users: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface ExpenseDetail {
  id: string;
  description: string;
  amount: number;
  paid_by: string;
  split_type: string;
  created_at: string;
  users: {
    display_name: string | null;
    avatar_url: string | null;
  };
  expense_splits: ExpenseSplitRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDetailDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExpenseDetailScreen() {
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();
  const router = useRouter();
  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!expenseId) {
      setError(true);
      setLoading(false);
      return;
    }
    fetchExpense();
  }, [expenseId]);

  async function fetchExpense() {
    try {
      const { data, error: fetchError } = await supabase
        .from("expenses")
        .select(
          "*, users!expenses_paid_by_fkey(display_name, avatar_url), expense_splits(user_id, amount, users(display_name, avatar_url))",
        )
        .eq("id", expenseId!)
        .single();

      if (fetchError || !data) {
        setError(true);
        return;
      }

      setExpense(data as unknown as ExpenseDetail);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  // ------- Loading state -------
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // ------- Error state -------
  if (error || !expense) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text variant="h2" color="accent">
              {"<"}
            </Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text variant="h2" color="textPrimary">
            Expense not found
          </Text>
          <Text
            variant="body"
            color="textSecondary"
            style={styles.errorSubtext}
          >
            This expense may have been deleted.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ------- Main render -------
  const payerName = expense.users.display_name || "Unknown";
  const payerEmoji = expense.users.avatar_url || undefined;
  const totalCentavos = Math.round(expense.amount * 100);
  const splitLabel =
    expense.split_type === "equal" ? "Equal" : "Custom";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text variant="h2" color="accent">
            {"<"}
          </Text>
        </Pressable>
        <Text variant="bodyMedium" color="textPrimary" style={styles.headerTitle}>
          Expense Detail
        </Text>
        {/* Spacer for centering */}
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <Text variant="h1" color="textPrimary" style={styles.description}>
          {expense.description}
        </Text>

        {/* Total amount */}
        <Text variant="h1" color="accent" style={styles.totalAmount}>
          {formatPeso(totalCentavos)}
        </Text>

        {/* Paid by */}
        <View style={styles.payerRow}>
          <Avatar emoji={payerEmoji} size="sm" />
          <Text variant="body" color="textSecondary">
            Paid by {payerName}
          </Text>
        </View>

        {/* Split type and date */}
        <View style={styles.metaRow}>
          <View style={styles.splitBadge}>
            <Text variant="caption" color="accent">
              {splitLabel}
            </Text>
          </View>
          <Text variant="caption" color="textSecondary">
            {formatDetailDate(expense.created_at)}
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Split Breakdown */}
        <Text
          variant="bodyMedium"
          color="textPrimary"
          style={styles.sectionHeader}
        >
          Split Breakdown
        </Text>

        {expense.expense_splits.map((split) => {
          const memberName = split.users.display_name || "Unknown";
          const memberEmoji = split.users.avatar_url || undefined;
          const splitCentavos = Math.round(split.amount * 100);
          const isPayer = split.user_id === expense.paid_by;

          return (
            <Card key={split.user_id} style={styles.splitCard}>
              <View style={styles.splitRow}>
                <Avatar emoji={memberEmoji} size="sm" />
                <View style={styles.splitInfo}>
                  <View style={styles.splitNameRow}>
                    <Text
                      variant="bodyMedium"
                      color="textPrimary"
                      numberOfLines={1}
                      style={styles.splitName}
                    >
                      {memberName}
                    </Text>
                    {isPayer && (
                      <View style={styles.paidBadge}>
                        <Text variant="caption" color="accent">
                          paid
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text variant="bodyMedium" color="textPrimary">
                  {formatPeso(splitCentavos)}
                </Text>
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
    gap: spacing[3],
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[10],
  },
  description: {
    textAlign: "center",
    marginTop: spacing[4],
  },
  totalAmount: {
    textAlign: "center",
    marginTop: spacing[2],
  },
  payerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    marginTop: spacing[4],
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[3],
    marginTop: spacing[3],
  },
  splitBadge: {
    backgroundColor: colors.accentSubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing[6],
  },
  sectionHeader: {
    marginBottom: spacing[3],
  },
  splitCard: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    marginBottom: spacing[2],
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  splitInfo: {
    flex: 1,
  },
  splitNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  splitName: {
    flexShrink: 1,
  },
  paidBadge: {
    backgroundColor: colors.accentSubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 1,
  },
  errorSubtext: {
    textAlign: "center",
  },
});
