import React from "react";
import { View, StyleSheet } from "react-native";
import { Skeleton } from "moti/skeleton";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { colors, spacing, radius } from "@/theme";

// ---------------------------------------------------------------------------
// Shared skeleton color config (dark theme shimmer)
// ---------------------------------------------------------------------------

const SKELETON_COLORS = [
  colors.surface,
  colors.surfaceElevated,
  colors.surface,
] as const;

const COLOR_MODE = "dark" as const;

// ---------------------------------------------------------------------------
// GroupCardSkeleton - matches GroupRow card layout
// ---------------------------------------------------------------------------

export function GroupCardSkeleton() {
  return (
    <Card>
      <View style={skStyles.groupCardRow}>
        <Skeleton
          colorMode={COLOR_MODE}
          colors={[...SKELETON_COLORS]}
          radius="round"
          width={40}
          height={40}
        />
        <View style={skStyles.groupCardInfo}>
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius={radius.md}
            width="60%"
            height={16}
          />
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius={radius.md}
            width="30%"
            height={12}
          />
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// GroupsListSkeleton - 4x GroupCardSkeleton
// ---------------------------------------------------------------------------

export function GroupsListSkeleton() {
  return (
    <Skeleton.Group show>
      <View style={skStyles.groupsList}>
        <GroupCardSkeleton />
        <GroupCardSkeleton />
        <GroupCardSkeleton />
        <GroupCardSkeleton />
      </View>
    </Skeleton.Group>
  );
}

// ---------------------------------------------------------------------------
// ExpenseCardSkeleton - single expense card shape
// ---------------------------------------------------------------------------

export function ExpenseCardSkeleton() {
  return (
    <Card>
      <View style={skStyles.expenseCardRow}>
        <Skeleton
          colorMode={COLOR_MODE}
          colors={[...SKELETON_COLORS]}
          radius="round"
          width={36}
          height={36}
        />
        <View style={skStyles.expenseCardInfo}>
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius={radius.md}
            width="70%"
            height={14}
          />
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius={radius.md}
            width="35%"
            height={12}
          />
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SettlementCardSkeleton - settlement card shape
// ---------------------------------------------------------------------------

function SettlementCardSkeleton() {
  return (
    <Card style={skStyles.settlementCard}>
      <View style={skStyles.settlementRow}>
        <View style={skStyles.settlementPerson}>
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius="round"
            width={36}
            height={36}
          />
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius={radius.md}
            width={60}
            height={10}
          />
        </View>
        <View style={skStyles.settlementCenter}>
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius={radius.md}
            width={50}
            height={14}
          />
        </View>
        <View style={skStyles.settlementPerson}>
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius="round"
            width={36}
            height={36}
          />
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius={radius.md}
            width={60}
            height={10}
          />
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// GroupDetailSkeleton - matches group detail layout
// ---------------------------------------------------------------------------

export function GroupDetailSkeleton() {
  return (
    <Skeleton.Group show>
      <View style={skStyles.groupDetail}>
        {/* Group avatar + name */}
        <View style={skStyles.groupDetailHeader}>
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius="round"
            width={64}
            height={64}
          />
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius={radius.md}
            width={140}
            height={20}
          />
        </View>

        {/* Action buttons */}
        <View style={skStyles.groupDetailButtons}>
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius={radius.md}
            width="100%"
            height={44}
          />
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius={radius.md}
            width="100%"
            height={44}
          />
        </View>

        {/* Add expense button */}
        <View style={skStyles.groupDetailAddExpense}>
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius={radius.md}
            width="100%"
            height={44}
          />
        </View>

        {/* Balances section */}
        <View style={skStyles.sectionContainer}>
          <Text variant="bodyMedium" color="textPrimary">
            Balances
          </Text>
          <View style={skStyles.sectionGap}>
            <SettlementCardSkeleton />
            <SettlementCardSkeleton />
          </View>
        </View>

        {/* Expenses section */}
        <View style={skStyles.sectionContainer}>
          <Text variant="bodyMedium" color="textPrimary">
            Expenses
          </Text>
          <View style={skStyles.sectionGap}>
            <ExpenseCardSkeleton />
            <ExpenseCardSkeleton />
            <ExpenseCardSkeleton />
          </View>
        </View>
      </View>
    </Skeleton.Group>
  );
}

// ---------------------------------------------------------------------------
// BalanceDetailSkeleton - matches balance drill-down screen layout
// ---------------------------------------------------------------------------

export function BalanceDetailSkeleton() {
  return (
    <Skeleton.Group show>
      <View style={skStyles.balanceDetail}>
        {/* Member avatar + name */}
        <View style={skStyles.balanceDetailHeader}>
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius="round"
            width={48}
            height={48}
          />
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius={radius.md}
            width={120}
            height={20}
          />
        </View>

        {/* Summary amount */}
        <View style={skStyles.balanceDetailAmount}>
          <Skeleton
            colorMode={COLOR_MODE}
            colors={[...SKELETON_COLORS]}
            radius={radius.md}
            width={100}
            height={28}
          />
        </View>

        {/* Expenses section */}
        <View style={skStyles.sectionContainer}>
          <Text variant="bodyMedium" color="textPrimary">
            Contributing Expenses
          </Text>
          <View style={skStyles.sectionGap}>
            <ExpenseCardSkeleton />
            <ExpenseCardSkeleton />
            <ExpenseCardSkeleton />
          </View>
        </View>
      </View>
    </Skeleton.Group>
  );
}

// ---------------------------------------------------------------------------
// ActivityItemSkeleton - matches activity row layout on dashboard
// ---------------------------------------------------------------------------

export function ActivityItemSkeleton() {
  return (
    <View style={skStyles.activityRow}>
      <Skeleton
        colorMode={COLOR_MODE}
        colors={[...SKELETON_COLORS]}
        radius="round"
        width={32}
        height={32}
      />
      <View style={skStyles.activityInfo}>
        <Skeleton
          colorMode={COLOR_MODE}
          colors={[...SKELETON_COLORS]}
          radius={radius.md}
          width="65%"
          height={14}
        />
        <Skeleton
          colorMode={COLOR_MODE}
          colors={[...SKELETON_COLORS]}
          radius={radius.md}
          width="40%"
          height={12}
        />
      </View>
      <Skeleton
        colorMode={COLOR_MODE}
        colors={[...SKELETON_COLORS]}
        radius={radius.md}
        width={60}
        height={14}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// ActivitySectionSkeleton - 3x ActivityItemSkeleton in a Skeleton.Group
// ---------------------------------------------------------------------------

export function ActivitySectionSkeleton() {
  return (
    <Skeleton.Group show>
      <View style={skStyles.activitySection}>
        <ActivityItemSkeleton />
        <ActivityItemSkeleton />
        <ActivityItemSkeleton />
      </View>
    </Skeleton.Group>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const skStyles = StyleSheet.create({
  // GroupCardSkeleton
  groupCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  groupCardInfo: {
    flex: 1,
    gap: spacing[2],
  },

  // GroupsListSkeleton
  groupsList: {
    paddingHorizontal: spacing[6],
    gap: spacing[3],
  },

  // ExpenseCardSkeleton
  expenseCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  expenseCardInfo: {
    flex: 1,
    gap: spacing[2],
  },

  // SettlementCardSkeleton
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

  // GroupDetailSkeleton
  groupDetail: {
    paddingBottom: spacing[10],
  },
  groupDetailHeader: {
    alignItems: "center",
    paddingVertical: spacing[6],
    gap: spacing[3],
  },
  groupDetailButtons: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  groupDetailAddExpense: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
  },

  // Shared section
  sectionContainer: {
    paddingHorizontal: spacing[6],
    gap: spacing[2],
    marginBottom: spacing[6],
  },
  sectionGap: {
    gap: spacing[2],
  },

  // BalanceDetailSkeleton
  balanceDetail: {
    paddingBottom: spacing[10],
  },
  balanceDetailHeader: {
    alignItems: "center",
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  balanceDetailAmount: {
    alignItems: "center",
    paddingBottom: spacing[4],
  },

  // ActivityItemSkeleton
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  activityInfo: {
    flex: 1,
    gap: spacing[1],
  },

  // ActivitySectionSkeleton
  activitySection: {
    gap: spacing[1],
  },
});
