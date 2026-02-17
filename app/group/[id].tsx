import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Avatar, EMOJI_LIST } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
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

interface GroupDetail {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) {
      setError(true);
      setLoading(false);
      return;
    }
    fetchGroup();
  }, [id]);

  async function fetchGroup() {
    try {
      const { data, error: fetchError } = await supabase
        .from("groups")
        .select("id, name, invite_code, created_by, created_at")
        .eq("id", id!)
        .single();

      if (fetchError || !data) {
        setError(true);
        return;
      }

      setGroup(data);
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

      {/* Members section */}
      <View style={styles.membersSection}>
        <Card style={styles.membersCard}>
          <Text variant="bodyMedium" color="textPrimary">
            Members
          </Text>
          {/* Member list added by Plan 03-03 */}
          <Text
            variant="body"
            color="textSecondary"
            style={styles.memberPlaceholder}
          >
            Member list coming soon
          </Text>
        </Card>
      </View>
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
    paddingBottom: spacing[6],
  },
  shareButton: {
    width: "100%",
  },
  membersSection: {
    paddingHorizontal: spacing[6],
    flex: 1,
  },
  membersCard: {
    gap: spacing[2],
  },
  memberPlaceholder: {
    marginTop: spacing[2],
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
