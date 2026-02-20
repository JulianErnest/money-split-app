import { ActivitySectionSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import {
  ActivityItem,
  fetchRecentActivity,
  formatRelativeTime,
  getDayLabel,
} from "@/lib/activity";
import { formatPeso } from "@/lib/expense-utils";
import { colors, radius, spacing } from "@/theme";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActivityHistoryScreen() {
  const router = useRouter();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // ------- Load initial data -------
  useEffect(() => {
    async function loadInitial() {
      try {
        const data = await fetchRecentActivity(PAGE_SIZE, 0);
        setActivities(data);
        setOffset(data.length);
        setHasMore(data.length === PAGE_SIZE);
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, []);

  // ------- Load more for infinite scroll -------
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchRecentActivity(PAGE_SIZE, offset);
      setActivities((prev) => [...prev, ...data]);
      setOffset((prev) => prev + data.length);
      if (data.length < PAGE_SIZE) setHasMore(false);
    } catch {
      // Silently handle
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, offset]);

  // ------- Render helpers -------
  const renderItem = useCallback(
    ({ item, index }: { item: ActivityItem; index: number }) => {
      const isExpense = item.type === "expense";

      // Day header: show when day changes from previous item
      const currentDayLabel = getDayLabel(item.created_at);
      const previousDayLabel =
        index > 0 ? getDayLabel(activities[index - 1].created_at) : null;
      const showDayHeader = index === 0 || currentDayLabel !== previousDayLabel;

      return (
        <View>
          {showDayHeader && (
            <View style={styles.dayHeader}>
              <Text variant="label" color="textSecondary">
                {currentDayLabel.toUpperCase()}
              </Text>
            </View>
          )}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        </View>
      );
    },
    [activities, router],
  );

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }, [loadingMore]);

  const renderEmpty = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.skeletonContainer}>
          <ActivitySectionSkeleton />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <RNText style={styles.emptyEmoji}>📋</RNText>
        <Text variant="bodyMedium" color="textPrimary" style={styles.emptyText}>
          No recent activity
        </Text>
        <Text variant="body" color="textSecondary" style={styles.emptySubtext}>
          Expenses and settlements from your groups will show up here
        </Text>
      </View>
    );
  }, [loading]);

  const keyExtractor = useCallback(
    (item: ActivityItem) => item.id,
    [],
  );

  // ------- Main render -------
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
        >
          <Text variant="h2" color="accent">
            {"<"}
          </Text>
        </Pressable>
        <Text variant="h2" color="textPrimary">
          Activity History
        </Text>
        <View style={styles.backButton} />
      </View>

      {/* Activity list */}
      <FlatList
        data={activities}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    gap: spacing[3],
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[10],
    flexGrow: 1,
  },
  dayHeader: {
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
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
  footer: {
    paddingVertical: spacing[4],
    alignItems: "center",
  },
  skeletonContainer: {
    paddingTop: spacing[4],
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[6],
    flex: 1,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing[3],
  },
  emptyText: {
    textAlign: "center",
    marginBottom: spacing[2],
  },
  emptySubtext: {
    textAlign: "center",
    maxWidth: 280,
  },
});
