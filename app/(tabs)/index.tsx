import { Avatar, EMOJI_LIST } from "@/components/ui/Avatar";
import { AvatarStack } from "@/components/ui/AvatarStack";
import {
  AppBottomSheet,
  BottomSheetTextInput,
  useBottomSheet,
} from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { GlassCard } from "@/components/ui/GlassCard";
import { AnimatedRefreshControl } from "@/components/ui/PullToRefresh";
import {
  ActivitySectionSkeleton,
  GroupsListSkeleton,
} from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useToast } from "@/components/ui/Toast";
import {
  ActivityItem,
  fetchRecentActivity,
  formatRelativeTime,
} from "@/lib/activity";
import { useAuth } from "@/lib/auth-context";
import { formatBalanceColor, formatBalanceSummary } from "@/lib/balance-utils";
import { getCachedData, setCachedData } from "@/lib/cached-data";
import { formatPeso } from "@/lib/expense-utils";
import {
  GroupCardData,
  fetchGroupCardData,
} from "@/lib/group-card-data";
import { fetchPendingInvites, InviteRow } from "@/lib/group-members";
import { useNetwork } from "@/lib/network-context";
import { enqueue } from "@/lib/offline-queue";
import { supabase } from "@/lib/supabase";
import { syncCompleteListeners } from "@/lib/sync-manager";
import { colors, radius, spacing } from "@/theme";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MotiPressable } from "moti/interactions";
import { MotiView } from "moti";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Pressable, SectionList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

/** Returns gradient colors based on balance direction. */
function getBalanceGradientColors(
  netBalance: number,
): [string, string, string] {
  if (netBalance > 0) {
    // Positive (owed to user) -> green glow
    return ["#0D0D0D", "rgba(159, 232, 112, 0.12)", "#0D0D0D"];
  }
  if (netBalance < 0) {
    // Negative (user owes) -> red glow
    return ["#0D0D0D", "rgba(232, 84, 84, 0.12)", "#0D0D0D"];
  }
  // Zero / settled -> neutral amber glow
  return ["#0D0D0D", "rgba(245, 166, 35, 0.08)", "#0D0D0D"];
}

// ---------------------------------------------------------------------------
// Balance Summary Header
// ---------------------------------------------------------------------------

function BalanceSummaryHeader({
  netBalance,
  hasGroups,
}: {
  netBalance: number;
  hasGroups: boolean;
}) {
  if (!hasGroups) return null;

  return (
    <LinearGradient
      colors={getBalanceGradientColors(netBalance)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={balanceSummaryStyles.container}
    >
      <Text variant="caption" color="textSecondary">
        Overall Balance
      </Text>
      <Text variant="moneyLarge" color={formatBalanceColor(netBalance)}>
        P{formatPeso(Math.abs(netBalance))}
      </Text>
      <Text variant="body" color="textSecondary">
        {formatBalanceSummary(netBalance, formatPeso)}
      </Text>
    </LinearGradient>
  );
}

const balanceSummaryStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[6],
  },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GroupRow {
  group_id: string;
  pending?: boolean;
  groups: {
    id: string;
    name: string;
    invite_code: string;
    created_by: string;
    created_at: string;
  };
}

type SectionType = "invite" | "group";

interface InviteSection {
  title: string;
  data: InviteRow[];
  type: "invite";
}

interface GroupSection {
  title: string;
  data: GroupRow[];
  type: "group";
}

type HomeSection = InviteSection | GroupSection;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GroupsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { isOnline } = useNetwork();
  const { showToast } = useToast();

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupBalances, setGroupBalances] = useState<Map<string, number>>(
    new Map(),
  );
  const [groupCardData, setGroupCardData] = useState<
    Map<string, GroupCardData>
  >(new Map());

  const netBalance = useMemo(() => {
    let total = 0;
    for (const centavos of groupBalances.values()) {
      total += centavos;
    }
    return total;
  }, [groupBalances]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Activity feed state
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  // Invite inbox state
  const [pendingInvites, setPendingInvites] = useState<InviteRow[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Create group bottom sheet state
  const {
    ref: createSheetRef,
    open: openCreateSheet,
    close: closeCreateSheet,
  } = useBottomSheet();
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  // ------- Load cached data on mount -------
  useEffect(() => {
    if (!user) return;
    const cached = getCachedData<GroupRow[]>(`${user.id}:groups`);
    if (cached && cached.length > 0) {
      setGroups(cached);
    }
    const cachedActivities = getCachedData<ActivityItem[]>(
      `${user.id}:recent_activity`,
    );
    if (cachedActivities && cachedActivities.length > 0) {
      setActivities(cachedActivities);
    }
  }, [user]);

  // ------- Fetch groups -------
  const fetchGroups = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("group_members")
        .select(
          "group_id, groups (id, name, invite_code, created_by, created_at)",
        )
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch groups:", error.message);
        return;
      }

      const rows = (data as unknown as GroupRow[]) ?? [];
      setGroups(rows);
      setCachedData(`${user.id}:groups`, rows);
    } catch (err) {
      console.error("Unexpected error fetching groups:", err);
    }
  }, [user]);

  // Fetch per-group net balances for current user
  const fetchBalances = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc("get_my_group_balances");
      if (error || !data) return;
      const map = new Map<string, number>();
      for (const row of data as {
        group_id: string;
        net_balance: number;
      }[]) {
        const centavos = Math.round(row.net_balance * 100);
        if (centavos !== 0) {
          map.set(row.group_id, centavos);
        }
      }
      setGroupBalances(map);
    } catch {
      // Silently skip -- don't break the groups list
    }
  }, [user]);

  // ------- Fetch group card data (members, last activity) -------
  const fetchCardData = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchGroupCardData();
      const map = new Map<string, GroupCardData>();
      for (const item of data) {
        map.set(item.group_id, item);
      }
      setGroupCardData(map);
    } catch {
      // Silently skip
    }
  }, [user]);

  // ------- Fetch recent activity -------
  const fetchActivities = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchRecentActivity(5);
      setActivities(data);
      setCachedData(`${user.id}:recent_activity`, data);
    } catch {
      // Silently skip -- don't break the dashboard
    } finally {
      setActivitiesLoading(false);
    }
  }, [user]);

  // ------- Fetch pending invites -------
  const fetchInvites = useCallback(async () => {
    if (!user) return;
    const invites = await fetchPendingInvites();
    setPendingInvites(invites);
  }, [user]);

  useEffect(() => {
    Promise.all([
      fetchGroups(),
      fetchInvites(),
      fetchActivities(),
      fetchCardData(),
    ]).finally(() => {
      setLoading(false);
    });
  }, [fetchGroups, fetchInvites, fetchActivities, fetchCardData]);

  // ------- Subscribe to sync-complete to re-fetch after offline flush -------
  useEffect(() => {
    const listener = () => {
      // Remove optimistic pending rows and re-fetch from server
      setGroups((prev) => prev.filter((g) => !g.pending));
      fetchGroups();
      fetchBalances();
      fetchInvites();
      fetchActivities();
      fetchCardData();
    };
    syncCompleteListeners.add(listener);
    return () => {
      syncCompleteListeners.delete(listener);
    };
  }, [fetchGroups, fetchBalances, fetchInvites, fetchActivities, fetchCardData]);

  // Refresh balances, groups, invites, activities, and card data on every focus
  useFocusEffect(
    useCallback(() => {
      fetchBalances();
      fetchGroups();
      fetchInvites();
      fetchActivities();
      fetchCardData();
    }, [
      fetchBalances,
      fetchGroups,
      fetchInvites,
      fetchActivities,
      fetchCardData,
    ]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchGroups(),
      fetchBalances(),
      fetchInvites(),
      fetchActivities(),
      fetchCardData(),
    ]);
    setRefreshing(false);
  }, [fetchGroups, fetchBalances, fetchInvites, fetchActivities, fetchCardData]);

  // ------- Accept invite handler -------
  const handleAcceptInvite = useCallback(
    async (invite: InviteRow) => {
      setAcceptingId(invite.pending_member_id);
      try {
        const { data: groupId, error } = await supabase.rpc("accept_invite", {
          p_pending_member_id: invite.pending_member_id,
        });
        if (error) {
          showToast({ message: error.message, type: "error" });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
        // Remove from local state immediately
        setPendingInvites((prev) =>
          prev.filter((i) => i.pending_member_id !== invite.pending_member_id),
        );
        // Toast and navigate
        showToast({
          message: `You joined ${invite.group_name}!`,
          type: "success",
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push(`/group/${groupId}` as any);
      } catch {
        showToast({
          message: "Something went wrong. Please try again.",
          type: "error",
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setAcceptingId(null);
      }
    },
    [showToast, router],
  );

  // ------- Decline invite handler -------
  const handleDeclineInvite = useCallback(
    (invite: InviteRow) => {
      Alert.alert(
        "Decline Invite",
        "Declining will remove you from all expense splits in this group.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Decline",
            style: "destructive",
            onPress: async () => {
              try {
                const { error } = await supabase.rpc("decline_invite", {
                  p_pending_member_id: invite.pending_member_id,
                });
                if (error) {
                  showToast({ message: error.message, type: "error" });
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Error,
                  );
                  return;
                }
                // Silently remove (no toast per user decision)
                setPendingInvites((prev) =>
                  prev.filter(
                    (i) => i.pending_member_id !== invite.pending_member_id,
                  ),
                );
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
              } catch {
                showToast({
                  message: "Something went wrong. Please try again.",
                  type: "error",
                });
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Error,
                );
              }
            },
          },
        ],
      );
    },
    [showToast],
  );

  // ------- Create group -------
  const handleCreateGroup = useCallback(async () => {
    const trimmed = newGroupName.trim();
    if (trimmed.length === 0 || trimmed.length > 50) {
      Alert.alert("Invalid name", "Group name must be 1-50 characters.");
      return;
    }

    // Offline path: enqueue and add optimistic row
    if (!isOnline) {
      enqueue("create_group", { group_name: trimmed });
      const optimisticRow: GroupRow = {
        group_id: `pending-${Date.now()}`,
        pending: true,
        groups: {
          id: `pending-${Date.now()}`,
          name: trimmed,
          invite_code: "",
          created_by: user?.id ?? "",
          created_at: new Date().toISOString(),
        },
      };
      setGroups((prev) => [optimisticRow, ...prev]);
      setNewGroupName("");
      closeCreateSheet();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.rpc("create_group", {
        group_name: trimmed,
      });

      if (error) {
        Alert.alert("Error", error.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      setNewGroupName("");
      closeCreateSheet();
      await fetchGroups();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Something went wrong.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCreating(false);
    }
  }, [newGroupName, fetchGroups, isOnline, user]);

  // ------- SectionList data -------
  const sections: HomeSection[] = useMemo(() => {
    const result: HomeSection[] = [
      { title: "My Groups", data: groups, type: "group" as const },
    ];
    if (pendingInvites.length > 0) {
      result.push({
        title: "Pending Invites",
        data: pendingInvites,
        type: "invite" as const,
      });
    }
    return result;
  }, [pendingInvites, groups]);

  // ------- Render helpers -------

  const renderActivityItem = useCallback(
    (item: ActivityItem) => {
      const isExpense = item.type === "expense";
      return (
        <Pressable
          key={item.id}
          onPress={() => {
            if (isExpense && item.expense_id) {
              router.push(
                `/group/${item.group_id}/expense/${item.expense_id}` as any,
              );
            } else {
              router.push(`/group/${item.group_id}` as any);
            }
          }}
          style={styles.activityItem}
        >
          <View
            style={[
              styles.activityIcon,
              {
                backgroundColor: isExpense
                  ? colors.accentSubtle
                  : colors.surface,
              },
            ]}
          >
            <Text
              variant="caption"
              color={isExpense ? "accent" : "textSecondary"}
            >
              {isExpense ? "E" : "S"}
            </Text>
          </View>
          <View style={styles.activityInfo}>
            <Text variant="bodyMedium" color="textPrimary" numberOfLines={1}>
              {item.description}
            </Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {item.group_name} · {formatRelativeTime(item.created_at)}
            </Text>
          </View>
          <Text
            variant="bodyMedium"
            color={isExpense ? "textPrimary" : "accent"}
          >
            P{formatPeso(Math.round(item.amount * 100))}
          </Text>
        </Pressable>
      );
    },
    [router],
  );

  const renderGroupCard = useCallback(
    (item: GroupRow) => {
      const group = item.groups;
      const isPending = item.pending === true;
      const cardInfo = groupCardData.get(group.id);
      const netCentavos = groupBalances.get(group.id);

      // Pending (offline) groups: simple rendering without MotiPressable
      if (isPending) {
        return (
          <View style={styles.pendingCard}>
            <GlassCard>
              <View style={styles.cardTopRow}>
                <Avatar emoji={getGroupEmoji(group.name)} size="md" />
                <View style={styles.info}>
                  <Text variant="bodyMedium" color="textPrimary">
                    {group.name}
                  </Text>
                  <Text variant="caption" color="warning">
                    Pending sync...
                  </Text>
                </View>
              </View>
            </GlassCard>
          </View>
        );
      }

      return (
        <MotiPressable
          onPress={() => router.push(`/group/${group.id}` as any)}
          animate={({ pressed }) => {
            "worklet";
            return {
              scale: pressed ? 0.97 : 1,
              opacity: pressed ? 0.9 : 1,
            };
          }}
          transition={{
            type: "timing",
            duration: 150,
          }}
        >
          <GlassCard>
            <View style={styles.cardTopRow}>
              <Avatar emoji={getGroupEmoji(group.name)} size="md" />
              <View style={styles.info}>
                <Text variant="bodyMedium" color="textPrimary">
                  {group.name}
                </Text>
                <Text variant="caption" color="textTertiary">
                  {cardInfo?.last_activity_at
                    ? formatRelativeTime(cardInfo.last_activity_at)
                    : "No activity yet"}
                </Text>
              </View>
              {netCentavos != null && netCentavos !== 0 && (
                <View style={styles.cardBalanceCol}>
                  <Text
                    variant="bodyMedium"
                    color={formatBalanceColor(netCentavos)}
                  >
                    P{formatPeso(Math.abs(netCentavos))}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {netCentavos > 0 ? "owed to you" : "you owe"}
                  </Text>
                </View>
              )}
            </View>
            {cardInfo && cardInfo.members.length > 0 && (
              <View style={styles.cardAvatarRow}>
                <AvatarStack members={cardInfo.members} max={4} />
              </View>
            )}
          </GlassCard>
        </MotiPressable>
      );
    },
    [router, groupBalances, groupCardData],
  );

  const renderInviteCard = useCallback(
    (invite: InviteRow) => {
      const isAccepting = acceptingId === invite.pending_member_id;
      const isAnyAccepting = acceptingId !== null;

      const content = (
        <Card style={styles.inviteCard}>
          <View style={styles.row}>
            <Avatar emoji={getGroupEmoji(invite.group_name)} size="md" />
            <View style={styles.info}>
              <Text variant="bodyMedium" color="textPrimary">
                {invite.group_name}
              </Text>
              <Text variant="caption" color="textSecondary">
                Invited by {invite.invited_by_name}
              </Text>
            </View>
          </View>
          <View style={styles.inviteActions}>
            <Button
              variant="primary"
              label="Accept"
              onPress={() => handleAcceptInvite(invite)}
              loading={isAccepting}
              disabled={isAnyAccepting}
              style={styles.acceptButton}
            />
            <Button
              variant="ghost"
              label="Decline"
              onPress={() => handleDeclineInvite(invite)}
              disabled={isAnyAccepting}
              style={styles.declineButton}
            />
          </View>
        </Card>
      );

      return (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "timing", duration: 300 }}
        >
          {content}
        </MotiView>
      );
    },
    [acceptingId, handleAcceptInvite, handleDeclineInvite],
  );

  const renderItem = useCallback(
    ({ item, section }: { item: any; section: HomeSection }) => {
      if (section.type === "invite") {
        return renderInviteCard(item as InviteRow);
      }
      return renderGroupCard(item as GroupRow);
    },
    [renderInviteCard, renderGroupCard],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: HomeSection }) => (
      <View style={styles.sectionHeader}>
        <Text variant="label" color="textSecondary">
          {section.title}
        </Text>
      </View>
    ),
    [],
  );

  const renderSectionFooter = useCallback(
    ({ section }: { section: HomeSection }) => {
      if (section.type === "group" && groups.length === 0 && !loading) {
        return (
          <EmptyState
            emoji="👥"
            headline="No groups yet"
            subtext="Create a group to start splitting expenses with friends"
          />
        );
      }
      return null;
    },
    [groups.length, loading],
  );

  const keyExtractor = useCallback((item: any, index: number) => {
    if (item.pending_member_id) return item.pending_member_id;
    if (item.group_id) return item.group_id;
    return String(index);
  }, []);

  const dashboardHeader = useMemo(
    () => (
      <View>
        <BalanceSummaryHeader
          netBalance={netBalance}
          hasGroups={groups.length > 0}
        />

        {groups.length > 0 && (
          <>
            <View style={styles.sectionDivider} />

            <View style={styles.activitySection}>
              <View style={styles.activityHeaderRow}>
                <Text variant="label" color="textSecondary">
                  Recent Activity
                </Text>
                {activities.length > 0 && (
                  <Pressable
                    onPress={() => router.push("/activity" as any)}
                    hitSlop={8}
                  >
                    <Text variant="caption" color="accent">
                      See all
                    </Text>
                  </Pressable>
                )}
              </View>
              {activitiesLoading ? (
                <ActivitySectionSkeleton />
              ) : activities.length === 0 ? (
                <Text variant="caption" color="textTertiary">
                  No recent activity
                </Text>
              ) : (
                activities.map((item) => renderActivityItem(item))
              )}
            </View>

            <View style={styles.sectionDivider} />
          </>
        )}
      </View>
    ),
    [
      netBalance,
      groups.length,
      activities,
      activitiesLoading,
      renderActivityItem,
      router,
    ],
  );

  // ------- Main render -------
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="h2" color="textPrimary">
          Home
        </Text>
        <Pressable
          onPress={() => openCreateSheet()}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
        >
          <Text variant="h1" color="accent" style={styles.addButtonText}>
            +
          </Text>
        </Pressable>
      </View>

      {/* Skeleton while loading with no cached data */}
      {loading && groups.length === 0 ? (
        <GroupsListSkeleton />
      ) : (
        <SectionList
          ListHeaderComponent={dashboardHeader}
          sections={sections as any}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={renderSectionFooter}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          alwaysBounceVertical={true}
          refreshControl={
            <AnimatedRefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
        />
      )}

      {/* Create group bottom sheet */}
      <AppBottomSheet
        ref={createSheetRef}
        snapPoints={["45%"]}
        onDismiss={() => setNewGroupName("")}
      >
        <View style={styles.sheetContent}>
          <Text variant="h2" color="textPrimary" style={styles.sheetTitle}>
            New Group
          </Text>

          <BottomSheetTextInput
            style={styles.input}
            placeholder="Group name"
            placeholderTextColor={colors.inputPlaceholder}
            value={newGroupName}
            onChangeText={setNewGroupName}
            maxLength={50}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreateGroup}
          />

          <View style={styles.sheetButtons}>
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => {
                setNewGroupName("");
                closeCreateSheet();
              }}
            />
            <Button
              label="Create"
              variant="primary"
              onPress={handleCreateGroup}
              loading={creating}
              disabled={newGroupName.trim().length === 0}
            />
          </View>
        </View>
      </AppBottomSheet>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  addButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
  },
  addButtonPressed: {
    backgroundColor: colors.surfacePressed,
  },
  addButtonText: {
    fontSize: 28,
    lineHeight: 32,
  },
  list: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[10],
    gap: spacing[3],
    flexGrow: 1,
  },
  sectionHeader: {
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: spacing[6],
  },
  activitySection: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    gap: spacing[2],
  },
  activityHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  activityInfo: {
    flex: 1,
    gap: 2,
  },
  pendingCard: {
    opacity: 0.6,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  cardBalanceCol: {
    alignItems: "flex-end",
  },
  cardAvatarRow: {
    marginTop: spacing[3],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  info: {
    flex: 1,
    gap: 2,
  },
  // Invite card styles
  inviteCard: {
    // inherits Card defaults
  },
  inviteActions: {
    flexDirection: "row",
    gap: spacing[3],
    marginTop: spacing[3],
  },
  acceptButton: {
    flex: 1,
    height: 44,
  },
  declineButton: {
    flex: 1,
    height: 44,
  },
  // Bottom sheet
  sheetContent: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
  },
  sheetTitle: {
    marginBottom: spacing[4],
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    height: 48,
    paddingHorizontal: spacing[4],
    color: colors.inputText,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    marginBottom: spacing[4],
  },
  sheetButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing[3],
  },
});
