import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Avatar, EMOJI_LIST } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GroupRow {
  group_id: string;
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

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create group modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);

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
      setGroups((data as unknown as GroupRow[]) ?? []);
    } catch (err) {
      console.error("Unexpected error fetching groups:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchGroups().finally(() => setLoading(false));
  }, [fetchGroups]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGroups();
    setRefreshing(false);
  }, [fetchGroups]);

  // ------- Create group -------
  const handleCreateGroup = useCallback(async () => {
    const trimmed = newGroupName.trim();
    if (trimmed.length === 0 || trimmed.length > 50) {
      Alert.alert("Invalid name", "Group name must be 1-50 characters.");
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.rpc("create_group", {
        group_name: trimmed,
      });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      setNewGroupName("");
      setShowCreate(false);
      await fetchGroups();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }, [newGroupName, fetchGroups]);

  // ------- Render helpers -------
  const renderItem = useCallback(
    ({ item }: { item: GroupRow }) => {
      const group = item.groups;
      return (
        <Pressable
          onPress={() => router.push(`/group/${group.id}` as any)}
          style={styles.cardWrapper}
        >
          <Card style={styles.card}>
            <View style={styles.row}>
              <Avatar emoji={getGroupEmoji(group.name)} size="md" />
              <View style={styles.info}>
                <Text variant="bodyMedium" color="textPrimary">
                  {group.name}
                </Text>
              </View>
            </View>
          </Card>
        </Pressable>
      );
    },
    [router]
  );

  const keyExtractor = useCallback(
    (item: GroupRow) => item.group_id,
    []
  );

  const ListEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text variant="body" color="textSecondary" style={styles.emptyText}>
          No groups yet. Tap the + button to create one!
        </Text>
      </View>
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
          onPress={() => setShowCreate(true)}
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

      {/* Groups list */}
      <FlatList
        data={groups}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        ListEmptyComponent={ListEmpty}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      {/* Create group modal */}
      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreate(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCreate(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text variant="h2" color="textPrimary" style={styles.modalTitle}>
              New Group
            </Text>

            <TextInput
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

            <View style={styles.modalButtons}>
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => {
                  setNewGroupName("");
                  setShowCreate(false);
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
          </Pressable>
        </Pressable>
      </Modal>
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
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing[16],
  },
  emptyText: {
    textAlign: "center",
    paddingHorizontal: spacing[8],
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
  },
  modalContent: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.xl,
    padding: spacing[6],
  },
  modalTitle: {
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
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing[3],
  },
});
