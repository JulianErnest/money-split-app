import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Avatar, EMOJI_LIST } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { GroupsListSkeleton } from "@/components/ui/Skeleton";
import { AnimatedRefreshControl } from "@/components/ui/PullToRefresh";
import {
  AppBottomSheet,
  BottomSheetTextInput,
  useBottomSheet,
} from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { getCachedData, setCachedData } from "@/lib/cached-data";
import { useNetwork } from "@/lib/network-context";
import { enqueue } from "@/lib/offline-queue";
import { syncCompleteListeners } from "@/lib/sync-manager";
import { colors, spacing, radius } from "@/theme";
import { formatBalanceSummary, formatBalanceColor } from "@/lib/balance-utils";
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GroupsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { isOnline } = useNetwork();

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [groupBalances, setGroupBalances] = useState<Map<string, number>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const initialLoadDone = useRef(false);

  // Create group bottom sheet state
  const { ref: createSheetRef, open: openCreateSheet, close: closeCreateSheet } = useBottomSheet();
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  // ------- Load cached data on mount -------
  useEffect(() => {
    if (!user) return;
    const cached = getCachedData<GroupRow[]>(`${user.id}:groups`);
    if (cached && cached.length > 0) {
      setGroups(cached);
    }
    const cachedCounts = getCachedData<Record<string, number>>(
      `${user.id}:group_counts`,
    );
    if (cachedCounts) {
      setMemberCounts(cachedCounts);
    }
  }, [user]);

  // ------- Fetch groups -------
  const fetchGroups = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("group_members")
        .select(
          "group_id, groups (id, name, invite_code, created_by, created_at)"
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

      // Fetch member counts for all groups in a single query
      if (rows.length > 0) {
        const groupIds = rows.map((r) => r.groups.id);
        const { data: countData } = await supabase
          .from("group_members")
          .select("group_id")
          .in("group_id", groupIds);

        if (countData) {
          const counts = countData.reduce(
            (acc: Record<string, number>, row: { group_id: string }) => {
              acc[row.group_id] = (acc[row.group_id] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          );
          setMemberCounts(counts);
          setCachedData(`${user.id}:group_counts`, counts);
        }
      }
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
      for (const row of data as Array<{
        group_id: string;
        net_balance: number;
      }>) {
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

  useEffect(() => {
    fetchGroups().finally(() => {
      setLoading(false);
      initialLoadDone.current = true;
    });
  }, [fetchGroups]);

  // ------- Subscribe to sync-complete to re-fetch after offline flush -------
  useEffect(() => {
    const listener = () => {
      // Remove optimistic pending rows and re-fetch from server
      setGroups((prev) => prev.filter((g) => !g.pending));
      fetchGroups();
      fetchBalances();
    };
    syncCompleteListeners.add(listener);
    return () => {
      syncCompleteListeners.delete(listener);
    };
  }, [fetchGroups, fetchBalances]);

  // Refresh balances on every focus (picks up new expenses)
  useFocusEffect(
    useCallback(() => {
      fetchBalances();
    }, [fetchBalances]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchGroups(), fetchBalances()]);
    setRefreshing(false);
  }, [fetchGroups, fetchBalances]);

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

  // ------- Render helpers -------
  const renderItem = useCallback(
    ({ item }: { item: GroupRow }) => {
      const group = item.groups;
      const isPending = item.pending === true;
      const count = memberCounts[group.id] || 0;
      const countLabel = count === 1 ? "1 member" : `${count} members`;
      const netCentavos = groupBalances.get(group.id);

      const content = (
        <Pressable
          onPress={() => {
            if (!isPending) router.push(`/group/${group.id}` as any);
          }}
          style={[styles.cardWrapper, isPending && styles.pendingCard]}
        >
          <Card style={styles.card}>
            <View style={styles.row}>
              <Avatar emoji={getGroupEmoji(group.name)} size="md" />
              <View style={styles.info}>
                <Text variant="bodyMedium" color="textPrimary">
                  {group.name}
                </Text>
                {isPending ? (
                  <Text variant="caption" color="warning">
                    Pending sync...
                  </Text>
                ) : (
                  <Text variant="caption" color="textSecondary">
                    {countLabel}
                  </Text>
                )}
                {netCentavos != null && !isPending && (
                  <Text
                    variant="caption"
                    color={formatBalanceColor(netCentavos)}
                    style={styles.balanceText}
                  >
                    {formatBalanceSummary(netCentavos, formatPeso)}
                  </Text>
                )}
              </View>
              {!isPending && (
                <Text variant="body" color="textSecondary">
                  {">"}
                </Text>
              )}
            </View>
          </Card>
        </Pressable>
      );

      // Fade-in animation only on data refresh (not initial load)
      if (initialLoadDone.current) {
        return (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: "timing", duration: 300 }}
          >
            {content}
          </MotiView>
        );
      }

      return content;
    },
    [router, memberCounts, groupBalances],
  );

  const keyExtractor = useCallback(
    (item: GroupRow) => item.group_id,
    []
  );

  const ListEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <EmptyState
        emoji="🪙"
        headline="Wala ka pang group!"
        subtext="Tap + to create one, or ask a friend for an invite code"
      />
    );
  }, [loading]);

  // ------- Main render -------
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="h1" color="textPrimary">
          Groups
        </Text>
        <Pressable
          onPress={() => openCreateSheet()}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
        >
          <Text
            variant="h1"
            color="accent"
            style={styles.addButtonText}
          >
            +
          </Text>
        </Pressable>
      </View>

      {/* Skeleton while loading with no cached data */}
      {loading && groups.length === 0 ? (
        <GroupsListSkeleton />
      ) : (
        <FlatList
          data={groups}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          ListEmptyComponent={ListEmpty}
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
  cardWrapper: {
    // Pressable wrapper for the Card
  },
  pendingCard: {
    opacity: 0.6,
  },
  card: {
    // inherits Card defaults
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
  balanceText: {
    marginTop: 2,
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
