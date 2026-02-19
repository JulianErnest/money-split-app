import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { BalanceDetailSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { colors, spacing, radius } from "@/theme";
import { formatPeso } from "@/lib/expense-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContributingExpense {
  id: string;
  description: string;
  amount: number; // total expense amount (centavos from DB as pesos -- converted)
  created_at: string;
  debtor_share: number; // the debtor's split amount (centavos from DB as pesos -- converted)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BalanceDrillDownScreen() {
  const { id, memberId, direction, memberName, amount } =
    useLocalSearchParams<{
      id: string;
      memberId: string;
      direction: string; // "owe" or "owed"
      memberName: string;
      amount: string; // formatted peso string for header
    }>();

  const router = useRouter();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<ContributingExpense[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id || !memberId || !user) {
        setLoading(false);
        return;
      }
      fetchContributingExpenses();
    }, [id, memberId, user]),
  );

  async function fetchContributingExpenses() {
    try {
      const currentUserId = user!.id;
      // Determine creditor and debtor based on direction
      const creditorId = direction === "owe" ? memberId! : currentUserId;
      const debtorId = direction === "owe" ? currentUserId : memberId!;

      const { data, error } = await supabase
        .from("expenses")
        .select(
          "id, description, amount, created_at, expense_splits!inner(amount, user_id, pending_member_id)",
        )
        .eq("group_id", id!)
        .eq("paid_by", creditorId)
        .or(
          `user_id.eq.${debtorId},pending_member_id.eq.${debtorId}`,
          { referencedTable: "expense_splits" },
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch contributing expenses:", error.message);
        setExpenses([]);
        return;
      }

      const rows = (data ?? []) as Array<{
        id: string;
        description: string;
        amount: number;
        created_at: string;
        expense_splits: Array<{
          amount: number;
          user_id: string | null;
          pending_member_id: string | null;
        }>;
      }>;

      const mapped: ContributingExpense[] = rows.map((row) => {
        // Find the debtor's split from the joined splits
        const split = row.expense_splits.find(
          (s) => s.user_id === debtorId || s.pending_member_id === debtorId,
        );
        return {
          id: row.id,
          description: row.description,
          amount: Math.round(row.amount * 100),
          created_at: row.created_at,
          debtor_share: split ? Math.round(split.amount * 100) : 0,
        };
      });

      setExpenses(mapped);
    } catch (err) {
      console.error("Unexpected error fetching drill-down:", err);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Header text
  // ---------------------------------------------------------------------------

  const headerText =
    direction === "owe"
      ? `You owe ${memberName || "them"}`
      : `${memberName || "They"} owes you`;

  const headerColor = direction === "owe" ? "error" : "accent";

  // ---------------------------------------------------------------------------
  // Date formatting
  // ---------------------------------------------------------------------------

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const renderExpense = useCallback(
    ({ item }: { item: ContributingExpense }) => (
      <Card style={styles.expenseCard}>
        <View style={styles.expenseHeader}>
          <Text
            variant="bodyMedium"
            color="textPrimary"
            numberOfLines={1}
            style={styles.expenseDescription}
          >
            {item.description}
          </Text>
          <Text variant="caption" color="textTertiary">
            {formatDate(item.created_at)}
          </Text>
        </View>
        <View style={styles.expenseAmounts}>
          <Text variant="caption" color="textSecondary">
            Total: {"\u20B1"}{formatPeso(item.amount)}
          </Text>
          <Text variant="caption" color={headerColor}>
            Share: {"\u20B1"}{formatPeso(item.debtor_share)}
          </Text>
        </View>
      </Card>
    ),
    [headerColor],
  );

  const keyExtractor = useCallback(
    (item: ContributingExpense) => item.id,
    [],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text variant="h2" color="accent">
              {"<"}
            </Text>
          </Pressable>
        </View>
        <BalanceDetailSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text variant="h2" color="accent">
            {"<"}
          </Text>
        </Pressable>
      </View>

      {/* Balance summary header */}
      <View style={styles.summaryHeader}>
        <Text variant="h2" color={headerColor}>
          {headerText}
        </Text>
        {amount && (
          <Text variant="h1" color={headerColor} style={styles.amountText}>
            {"\u20B1"}{amount}
          </Text>
        )}
      </View>

      {/* Contributing expenses list */}
      <View style={styles.sectionHeader}>
        <Text variant="bodyMedium" color="textPrimary">
          Contributing Expenses
        </Text>
        <View style={styles.countBadge}>
          <Text variant="caption" color="textSecondary">
            {expenses.length}
          </Text>
        </View>
      </View>

      <FlatList
        data={expenses}
        renderItem={renderExpense}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text
            variant="body"
            color="textSecondary"
            style={styles.emptyText}
          >
            No expenses found
          </Text>
        }
      />
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
  summaryHeader: {
    alignItems: "center",
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    gap: spacing[1],
  },
  amountText: {
    marginTop: spacing[1],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[6],
    marginBottom: spacing[2],
    marginTop: spacing[2],
  },
  countBadge: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  list: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[10],
    gap: spacing[2],
    flexGrow: 1,
  },
  expenseCard: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  expenseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  expenseDescription: {
    flex: 1,
  },
  expenseAmounts: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: spacing[6],
  },
});
