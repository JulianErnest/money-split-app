import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Avatar, EMOJI_LIST } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import {
  ExpenseCard,
  type ExpenseCardExpense,
  type ExpenseCardSplit,
} from "@/components/expenses/ExpenseCard";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { colors, spacing, radius } from "@/theme";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGroupEmoji(groupName: string): string {
  let hash = 0;
  for (let i = 0; i < groupName.length; i++) {
    hash = ((hash << 5) - hash + groupName.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % EMOJI_LIST.length;
  return EMOJI_LIST[index];
}

function formatJoinedDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Joined today";
  if (diffDays === 1) return "Joined yesterday";
  if (diffDays < 30) return `Joined ${diffDays}d ago`;

  return `Joined ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GroupDetail {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

interface MemberRow {
  user_id: string;
  joined_at: string;
  users: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface ExpenseRow extends ExpenseCardExpense {
  expense_splits: ExpenseCardSplit[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Re-fetch on every focus (handles returning from add-expense)
  useFocusEffect(
    useCallback(() => {
      if (!id) {
        setError(true);
        setLoading(false);
        return;
      }
      fetchData();
    }, [id]),
  );

  async function fetchData() {
    try {
      const [groupResult, membersResult, expensesResult] = await Promise.all([
        supabase
          .from("groups")
          .select("id, name, invite_code, created_by, created_at")
          .eq("id", id!)
          .single(),
        supabase
          .from("group_members")
          .select("user_id, joined_at, users (id, display_name, avatar_url)")
          .eq("group_id", id!)
          .order("joined_at", { ascending: true }),
        supabase
          .from("expenses")
          .select(
            "id, description, amount, paid_by, split_type, created_at, users!expenses_paid_by_fkey(display_name, avatar_url), expense_splits(user_id, amount)",
          )
          .eq("group_id", id!)
          .order("created_at", { ascending: false }),
      ]);

      if (groupResult.error || !groupResult.data) {
        setError(true);
        return;
      }

      setGroup(groupResult.data);
      setMembers(
        (membersResult.data as unknown as MemberRow[]) ?? [],
      );
      setExpenses(
        (expensesResult.data as unknown as ExpenseRow[]) ?? [],
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!group) return;

    const url = Linking.createURL(`join/${group.invite_code}`);
    try {
      await Share.share({
        message: `Join "${group.name}" on HatianApp! ${url}`,
      });
    } catch {
      // User cancelled or share failed -- no action needed
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
  if (error || !group) {
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
          <Text variant="h2" color="textPrimary" style={styles.errorTitle}>
            Group not found
          </Text>
          <Text
            variant="body"
            color="textSecondary"
            style={styles.errorDescription}
          >
            This group may have been deleted or you don't have access.
          </Text>
          <Button
            label="Go Home"
            variant="primary"
            onPress={() => router.replace("/(tabs)")}
            style={styles.homeButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  const currentUserId = user?.id ?? "";

  // ------- Main render -------
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header bar with back button */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text variant="h2" color="accent">
            {"<"}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Group info */}
        <View style={styles.groupHeader}>
          <Avatar emoji={getGroupEmoji(group.name)} size="lg" />
          <Text variant="h2" color="textPrimary" style={styles.groupName}>
            {group.name}
          </Text>
        </View>

        {/* Share / Invite button */}
        <View style={styles.shareSection}>
          <Button
            label="Invite Friends"
            variant="primary"
            onPress={handleShare}
            style={styles.shareButton}
          />
        </View>

        {/* Add Expense button */}
        <View style={styles.addExpenseSection}>
          <Button
            label="Add Expense"
            variant="primary"
            onPress={() => router.push(`/group/${id}/add-expense`)}
            style={styles.addExpenseButton}
          />
        </View>

        {/* Expenses section */}
        <View style={styles.expensesSection}>
          <View style={styles.sectionHeader}>
            <Text variant="bodyMedium" color="textPrimary">
              Expenses
            </Text>
            <View style={styles.countBadge}>
              <Text variant="caption" color="textSecondary">
                {expenses.length}
              </Text>
            </View>
          </View>

          {expenses.length === 0 ? (
            <Text
              variant="body"
              color="textSecondary"
              style={styles.emptyText}
            >
              No expenses yet
            </Text>
          ) : (
            expenses.map((expense) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                splits={expense.expense_splits}
                currentUserId={currentUserId}
                onPress={() =>
                  router.push(`/group/${id}/expense/${expense.id}`)
                }
              />
            ))
          )}
        </View>

        {/* Members section */}
        <View style={styles.membersSection}>
          <View style={styles.sectionHeader}>
            <Text variant="bodyMedium" color="textPrimary">
              Members
            </Text>
            <View style={styles.countBadge}>
              <Text variant="caption" color="textSecondary">
                {members.length}
              </Text>
            </View>
          </View>

          {members.map((member) => {
            const isCreator = member.users.id === group.created_by;
            const displayName =
              member.users.display_name || "Unknown";
            const emoji = member.users.avatar_url || undefined;

            return (
              <Card key={member.user_id} style={styles.memberCard}>
                <View style={styles.memberRow}>
                  <Avatar emoji={emoji} size="sm" />
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text
                        variant="bodyMedium"
                        color="textPrimary"
                        numberOfLines={1}
                        style={styles.memberName}
                      >
                        {displayName}
                      </Text>
                      {isCreator && (
                        <View style={styles.creatorBadge}>
                          <Text variant="caption" color="accent">
                            Creator
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text variant="caption" color="textSecondary">
                      {formatJoinedDate(member.joined_at)}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[10],
  },
  groupHeader: {
    alignItems: "center",
    paddingVertical: spacing[6],
    gap: spacing[3],
  },
  groupName: {
    textAlign: "center",
    paddingHorizontal: spacing[6],
  },
  shareSection: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[3],
  },
  shareButton: {
    width: "100%",
  },
  addExpenseSection: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
  },
  addExpenseButton: {
    width: "100%",
  },
  expensesSection: {
    paddingHorizontal: spacing[6],
    gap: spacing[2],
    marginBottom: spacing[6],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  countBadge: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: spacing[6],
  },
  membersSection: {
    paddingHorizontal: spacing[6],
    gap: spacing[2],
  },
  memberCard: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  memberName: {
    flexShrink: 1,
  },
  creatorBadge: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 1,
  },
  errorTitle: {
    marginBottom: spacing[3],
    textAlign: "center",
  },
  errorDescription: {
    textAlign: "center",
    marginBottom: spacing[6],
  },
  homeButton: {
    minWidth: 200,
  },
});
