import { Avatar, EMOJI_LIST } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { colors, spacing, radius } from "@/theme";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GroupRow {
  group_id: string;
  groups: {
    id: string;
    name: string;
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AddExpenseScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const didAutoNavigate = useRef(false);

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id, groups (id, name)")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch groups:", error.message);
        return;
      }

      const rows = (data as unknown as GroupRow[]) ?? [];
      setGroups(rows);

      // Auto-navigate if only one group
      if (rows.length === 1 && !didAutoNavigate.current) {
        didAutoNavigate.current = true;
        router.replace(`/group/${rows[0].groups.id}/add-expense` as any);
      }
    } catch (err) {
      console.error("Unexpected error fetching groups:", err);
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useFocusEffect(
    useCallback(() => {
      didAutoNavigate.current = false;
      setLoading(true);
      fetchGroups();
    }, [fetchGroups]),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Text variant="h2" color="textPrimary">
            Add Expense
          </Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (groups.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Text variant="h2" color="textPrimary">
            Add Expense
          </Text>
        </View>
        <EmptyState
          emoji="👥"
          headline="No groups yet"
          subtext="Create or join a group first, then you can add expenses here."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text variant="h2" color="textPrimary">
          Add Expense
        </Text>
        <Text variant="body" color="textSecondary" style={styles.subtitle}>
          Which group is this for?
        </Text>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.group_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(`/group/${item.groups.id}/add-expense` as any)
            }
          >
            <Card style={styles.card}>
              <View style={styles.row}>
                <Avatar emoji={getGroupEmoji(item.groups.name)} size="md" />
                <Text
                  variant="bodyMedium"
                  color="textPrimary"
                  style={styles.groupName}
                >
                  {item.groups.name}
                </Text>
                <Text variant="body" color="textSecondary">
                  {">"}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
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
  },
  header: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  subtitle: {
    marginTop: spacing[1],
  },
  list: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[10],
    gap: spacing[3],
  },
  card: {
    // inherits Card defaults
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  groupName: {
    flex: 1,
  },
});
