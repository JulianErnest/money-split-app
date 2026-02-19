import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Avatar, EMOJI_LIST } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { GroupDetailSkeleton } from "@/components/ui/Skeleton";
import { AnimatedRefreshControl } from "@/components/ui/PullToRefresh";
import { useBottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ExpenseCard,
  type ExpenseCardExpense,
  type ExpenseCardSplit,
} from "@/components/expenses/ExpenseCard";
import { AddMemberSheet } from "@/components/groups/AddMemberModal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { getCachedData, setCachedData } from "@/lib/cached-data";
import { colors, spacing, radius } from "@/theme";
import {
  type GroupMember,
  fetchAllMembers,
} from "@/lib/group-members";
import {
  type Settlement,
  simplifyDebts,
  netBalancesToCentavos,
} from "@/lib/balance-utils";
import { formatPeso } from "@/lib/expense-utils";

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

interface ExpenseRow extends ExpenseCardExpense {
  expense_splits: ExpenseCardSplit[];
}

interface CachedGroupDetail {
  group: GroupDetail;
  expenses: ExpenseRow[];
  members: GroupMember[];
  settlements: Settlement[];
  balanceMemberFlags: [string, boolean][];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [balanceMemberFlags, setBalanceMemberFlags] = useState<
    Map<string, boolean>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const { ref: addMemberRef, open: openAddMember, close: closeAddMember } = useBottomSheet();

  // ------- Load cached data on mount -------
  useEffect(() => {
    if (!user || !id) return;
    const cached = getCachedData<CachedGroupDetail>(`${user.id}:group_${id}`);
    if (cached) {
      setGroup(cached.group);
      setExpenses(cached.expenses);
      setMembers(cached.members);
      setSettlements(cached.settlements);
      if (cached.balanceMemberFlags) {
        setBalanceMemberFlags(new Map(cached.balanceMemberFlags));
      }
    }
  }, [user, id]);

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
      const [groupResult, allMembers, expensesResult, balancesResult] =
        await Promise.all([
          supabase
            .from("groups")
            .select("id, name, invite_code, created_by, created_at")
            .eq("id", id!)
            .single(),
          fetchAllMembers(id!),
          supabase
            .from("expenses")
            .select(
              "id, description, amount, paid_by, split_type, created_at, users!expenses_paid_by_fkey(display_name, avatar_url), expense_splits(user_id, amount)",
            )
            .eq("group_id", id!)
            .order("created_at", { ascending: false }),
          supabase.rpc("get_group_balances", { p_group_id: id! }),
        ]);

      if (groupResult.error || !groupResult.data) {
        setError(true);
        return;
      }

      setGroup(groupResult.data);
      setMembers(allMembers);
      setExpenses(
        (expensesResult.data as unknown as ExpenseRow[]) ?? [],
      );

      // Compute simplified settlements from balance data
      if (balancesResult.data && !balancesResult.error) {
        const rows = balancesResult.data as Array<{
          member_id: string;
          is_pending: boolean;
          net_balance: number;
        }>;
        const centavosMap = netBalancesToCentavos(rows);
        setSettlements(simplifyDebts(centavosMap));

        // Track which member_ids are pending for display
        const flags = new Map<string, boolean>();
        for (const row of rows) {
          flags.set(row.member_id, row.is_pending);
        }
        setBalanceMemberFlags(flags);
      } else {
        setSettlements([]);
      }

      // Cache the fetched data for instant reopens
      if (user && groupResult.data) {
        const flagsArray: [string, boolean][] = [];
        if (balancesResult.data && !balancesResult.error) {
          for (const row of balancesResult.data as Array<{
            member_id: string;
            is_pending: boolean;
          }>) {
            flagsArray.push([row.member_id, row.is_pending]);
          }
        }
        setCachedData(`${user.id}:group_${id}`, {
          group: groupResult.data,
          expenses:
            (expensesResult.data as unknown as ExpenseRow[]) ?? [],
          members: allMembers,
          settlements: simplifyDebts(
            netBalancesToCentavos(
              (balancesResult.data as Array<{
                member_id: string;
                is_pending: boolean;
                net_balance: number;
              }>) ?? [],
            ),
          ),
          balanceMemberFlags: flagsArray,
        } satisfies CachedGroupDetail);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  async function handleShare() {
    if (!group) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const url = Linking.createURL(`join/${group.invite_code}`);
    try {
      await Share.share({
        message: `Join "${group.name}" on HatianApp! ${url}`,
      });
    } catch {
      // User cancelled or share failed -- no action needed
    }
  }

  function handleRemoveMember(member: GroupMember) {
    Alert.alert(
      "Remove Member",
      `Remove ${member.display_name} from this group? Their expense splits will also be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { error: rpcError } = await supabase.rpc(
              "remove_group_member",
              {
                p_group_id: id!,
                p_member_id: member.id,
                p_is_pending: member.isPending,
              },
            );
            if (rpcError) {
              Alert.alert("Error", rpcError.message);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchData();
          },
        },
      ],
    );
  }

  // ------- Loading state -------
  if (loading && !group) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text variant="h2" color="accent">
              {"<"}
            </Text>
          </Pressable>
        </View>
        <GroupDetailSkeleton />
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

  // Build a lookup map for member display names
  const memberMap = new Map<string, GroupMember>();
  for (const m of members) {
    memberMap.set(m.id, m);
  }

  function getMemberDisplayName(memberId: string): string {
    const m = memberMap.get(memberId);
    if (m) return m.display_name;
    return memberId.slice(0, 8);
  }

  function isMemberPending(memberId: string): boolean {
    // Check the balance RPC flags first, then fall back to member list
    const flag = balanceMemberFlags.get(memberId);
    if (flag !== undefined) return flag;
    const m = memberMap.get(memberId);
    return m?.isPending ?? false;
  }

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
        refreshControl={
          <AnimatedRefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        {/* Group info */}
        <View style={styles.groupHeader}>
          <Avatar emoji={getGroupEmoji(group.name)} size="lg" />
          <Text variant="h2" color="textPrimary" style={styles.groupName}>
            {group.name}
          </Text>
        </View>

        {/* Share / Invite + Add Member buttons */}
        <View style={styles.shareSection}>
          <Button
            label="Invite Friends"
            variant="primary"
            onPress={handleShare}
            style={styles.shareButton}
          />
          <Button
            label="Add Member"
            variant="secondary"
            onPress={openAddMember}
            style={styles.addMemberButton}
          />
        </View>

        {/* Add Expense button */}
        <View style={styles.addExpenseSection}>
          <Button
            label="Add Expense"
            variant="primary"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/group/${id}/add-expense`);
            }}
            style={styles.addExpenseButton}
          />
        </View>

        {/* Balances section */}
        <View style={styles.balancesSection}>
          <View style={styles.sectionHeader}>
            <Text variant="bodyMedium" color="textPrimary">
              Balances
            </Text>
          </View>

          {settlements.length === 0 ? (
            <EmptyState
              emoji="✅"
              headline="All settled!"
              subtext="Walang utang-utangan. Nice!"
            />
          ) : (
            settlements.map((s, idx) => {
              const fromPending = isMemberPending(s.from);
              const toPending = isMemberPending(s.to);

              // Determine drill-down navigation params
              const isCurrentUserDebtor = s.from === currentUserId;
              const isCurrentUserCreditor = s.to === currentUserId;
              const otherMemberId = isCurrentUserDebtor ? s.to : s.from;
              const drillDirection = isCurrentUserDebtor ? "owe" : "owed";
              const otherName = getMemberDisplayName(otherMemberId);

              function handleSettlementPress() {
                // Only navigate if current user is involved in this settlement
                if (!isCurrentUserDebtor && !isCurrentUserCreditor) return;
                router.push(
                  `/group/${id}/balance/${otherMemberId}?direction=${drillDirection}&memberName=${encodeURIComponent(otherName)}&amount=${encodeURIComponent(formatPeso(s.amount))}` as any,
                );
              }

              return (
                <Pressable
                  key={`${s.from}-${s.to}-${idx}`}
                  onPress={handleSettlementPress}
                >
                  <Card style={styles.settlementCard}>
                    <View style={styles.settlementRow}>
                      {/* Debtor */}
                      <View style={styles.settlementPerson}>
                        {fromPending ? (
                          <View style={styles.pendingAvatarSmall}>
                            <Text variant="caption" color="textSecondary">
                              {"#"}
                            </Text>
                          </View>
                        ) : (
                          <Avatar
                            emoji={
                              memberMap.get(s.from)?.avatar_url || undefined
                            }
                            size="sm"
                          />
                        )}
                        <Text
                          variant="caption"
                          color="textPrimary"
                          numberOfLines={1}
                          style={styles.settlementName}
                        >
                          {getMemberDisplayName(s.from)}
                        </Text>
                      </View>

                      {/* Arrow + Amount */}
                      <View style={styles.settlementCenter}>
                        <Text variant="caption" color="textTertiary">
                          owes
                        </Text>
                        <Text variant="bodyMedium" color="error">
                          {"\u20B1"}{formatPeso(s.amount)}
                        </Text>
                      </View>

                      {/* Creditor */}
                      <View style={styles.settlementPerson}>
                        {toPending ? (
                          <View style={styles.pendingAvatarSmall}>
                            <Text variant="caption" color="textSecondary">
                              {"#"}
                            </Text>
                          </View>
                        ) : (
                          <Avatar
                            emoji={
                              memberMap.get(s.to)?.avatar_url || undefined
                            }
                            size="sm"
                          />
                        )}
                        <Text
                          variant="caption"
                          color="textPrimary"
                          numberOfLines={1}
                          style={styles.settlementName}
                        >
                          {getMemberDisplayName(s.to)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })
          )}
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
            <EmptyState
              emoji="🧾"
              headline="No expenses yet"
              subtext="Mag-add ng expense para ma-track kung sino may utang"
            />
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
            const isCreator = !member.isPending && member.id === group.created_by;
            const isSelf = !member.isPending && member.id === currentUserId;
            const canRemove = !isCreator && !isSelf;

            if (member.isPending) {
              return (
                <Card key={member.id} style={styles.memberCard}>
                  <View style={styles.memberRow}>
                    <View style={styles.pendingAvatar}>
                      <Text variant="body" color="textSecondary">
                        {"#"}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <View style={styles.memberNameRow}>
                        <Text
                          variant="bodyMedium"
                          color="textPrimary"
                          numberOfLines={1}
                          style={styles.memberName}
                        >
                          {member.display_name}
                        </Text>
                        <View style={styles.pendingBadge}>
                          <Text variant="caption" color="warning">
                            Pending
                          </Text>
                        </View>
                      </View>
                      <Text variant="caption" color="textTertiary">
                        Pending signup
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleRemoveMember(member)}
                      style={styles.removeButton}
                      hitSlop={8}
                    >
                      <Text variant="caption" color="error">
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              );
            }

            const emoji = member.avatar_url || undefined;

            return (
              <Card key={member.id} style={styles.memberCard}>
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
                        {member.display_name}
                      </Text>
                      {isCreator && (
                        <View style={styles.creatorBadge}>
                          <Text variant="caption" color="accent">
                            Creator
                          </Text>
                        </View>
                      )}
                      {isSelf && !isCreator && (
                        <View style={styles.creatorBadge}>
                          <Text variant="caption" color="textTertiary">
                            You
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {canRemove && (
                    <Pressable
                      onPress={() => handleRemoveMember(member)}
                      style={styles.removeButton}
                      hitSlop={8}
                    >
                      <Text variant="caption" color="error">
                        Remove
                      </Text>
                    </Pressable>
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>

      {/* Add Member Bottom Sheet */}
      <AddMemberSheet
        ref={addMemberRef}
        groupId={id!}
        onClose={closeAddMember}
        onAdded={() => fetchData()}
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
    gap: spacing[2],
  },
  shareButton: {
    width: "100%",
  },
  addMemberButton: {
    width: "100%",
  },
  addExpenseSection: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
  },
  addExpenseButton: {
    width: "100%",
  },
  balancesSection: {
    paddingHorizontal: spacing[6],
    gap: spacing[2],
    marginBottom: spacing[6],
  },
  settlementCard: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  settlementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settlementPerson: {
    alignItems: "center",
    gap: spacing[1],
    flex: 1,
  },
  settlementCenter: {
    alignItems: "center",
    paddingHorizontal: spacing[2],
  },
  settlementName: {
    textAlign: "center",
    maxWidth: 90,
  },
  pendingAvatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center" as const,
    justifyContent: "center" as const,
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
  pendingBadge: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 1,
  },
  removeButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  pendingAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center" as const,
    justifyContent: "center" as const,
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
