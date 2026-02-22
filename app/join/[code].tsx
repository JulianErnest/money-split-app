import { Avatar, EMOJI_LIST } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Text as EmojiText,
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

type JoinState = "loading" | "success" | "error" | "unauthenticated";

interface GroupInfo {
  id: string;
  name: string;
  memberCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JoinGroupScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<JoinState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);

  // Fade-in animation for success state
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!code || code.trim().length === 0) {
      setErrorMessage("Invalid invite link. The invite code is missing.");
      setState("error");
      return;
    }

    if (!session) {
      setState("unauthenticated");
      return;
    }

    joinGroup(code.trim());
  }, [code, session]);

  useEffect(() => {
    if (state === "success") {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [state, fadeAnim, scaleAnim]);

  async function joinGroup(inviteCode: string) {
    setState("loading");
    try {
      const { data, error } = await supabase.rpc("join_group_by_invite", {
        invite: inviteCode,
      });

      if (error) {
        if (
          error.message.toLowerCase().includes("invalid") ||
          error.message.toLowerCase().includes("not found")
        ) {
          setErrorMessage(
            "This invite link is invalid or has expired. Please ask for a new one.",
          );
        } else {
          setErrorMessage(error.message);
        }
        setState("error");
        return;
      }

      if (data) {
        // Fetch group info for the success screen
        const { data: groupData } = await supabase
          .from("groups")
          .select("id, name")
          .eq("id", data)
          .single();

        const { count } = await supabase
          .from("group_members")
          .select("*", { count: "exact", head: true })
          .eq("group_id", data);

        setGroupInfo({
          id: data,
          name: groupData?.name ?? "Group",
          memberCount: count ?? 1,
        });
        setState("success");
      } else {
        setErrorMessage("Something went wrong. Please try again.");
        setState("error");
      }
    } catch {
      setErrorMessage(
        "A network error occurred. Please check your connection.",
      );
      setState("error");
    }
  }

  // ------- Loading state -------
  if (state === "loading") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text
              variant="bodyMedium"
              color="textPrimary"
              style={styles.loadingTitle}
            >
              Joining group...
            </Text>
            <Text
              variant="body"
              color="textSecondary"
              style={styles.loadingSubtitle}
            >
              {"Hang tight, we\u2019re adding you now"}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ------- Success state -------
  if (state === "success" && groupInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Animated.View
            style={[
              styles.successContent,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.checkBadge}>
              <EmojiText style={styles.checkEmoji}>{"\u2705"}</EmojiText>
            </View>

            <Text variant="h2" color="textPrimary" style={styles.successTitle}>
              {"You\u2019re in!"}
            </Text>

            <Card style={styles.groupCard}>
              <View style={styles.groupCardContent}>
                <Avatar emoji={getGroupEmoji(groupInfo.name)} size="lg" />
                <View style={styles.groupCardInfo}>
                  <Text variant="bodyMedium" color="textPrimary">
                    {groupInfo.name}
                  </Text>
                  <Text variant="body" color="textSecondary">
                    {groupInfo.memberCount}{" "}
                    {groupInfo.memberCount === 1 ? "member" : "members"}
                  </Text>
                </View>
              </View>
            </Card>

            <Text
              variant="body"
              color="textSecondary"
              style={styles.successSubtitle}
            >
              {"You\u2019ve been added to the group"}
            </Text>

            <Button
              label="Open Group"
              variant="primary"
              onPress={() => router.replace(`/group/${groupInfo.id}` as any)}
              style={styles.primaryButton}
            />
            <Button
              label="Go Home"
              variant="ghost"
              onPress={() => router.replace("/(tabs)")}
              style={styles.ghostButton}
            />
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // ------- Unauthenticated state -------
  if (state === "unauthenticated") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <View style={styles.iconBadge}>
            <Text style={styles.stateEmoji}>{"\u{1F512}"}</Text>
          </View>
          <Text variant="h2" color="textPrimary" style={styles.title}>
            Sign in to join
          </Text>
          <Text variant="body" color="textSecondary" style={styles.description}>
            You need to sign in before joining this group. After signing in,
            open the invite link again.
          </Text>
          <Button
            label="Go to Sign In"
            variant="primary"
            onPress={() => router.replace("/(auth)/sign-in")}
            style={styles.primaryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ------- Error state -------
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <View style={styles.iconBadge}>
          <Text style={styles.stateEmoji}>{"\u{1F6AB}"}</Text>
        </View>
        <Text variant="h2" color="textPrimary" style={styles.title}>
          Unable to join
        </Text>
        <Text variant="body" color="textSecondary" style={styles.description}>
          {errorMessage}
        </Text>
        <Button
          label="Go Home"
          variant="primary"
          onPress={() => router.replace("/(tabs)")}
          style={styles.primaryButton}
        />
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
  // Loading
  loadingCard: {
    alignItems: "center",
    gap: spacing[3],
  },
  loadingTitle: {
    marginTop: spacing[2],
  },
  loadingSubtitle: {
    textAlign: "center",
  },
  // Success
  successContent: {
    alignItems: "center",
    width: "100%",
  },
  checkBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
  },
  checkEmoji: {
    fontSize: 36,
  },
  successTitle: {
    marginBottom: spacing[5],
    textAlign: "center",
  },
  groupCard: {
    width: "100%",
    marginBottom: spacing[4],
  },
  groupCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
  },
  groupCardInfo: {
    flex: 1,
    gap: spacing[1],
  },
  successSubtitle: {
    textAlign: "center",
    marginBottom: spacing[6],
  },
  // Shared
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
  },
  stateEmoji: {
    fontSize: 36,
  },
  title: {
    marginBottom: spacing[3],
    textAlign: "center",
  },
  description: {
    textAlign: "center",
    marginBottom: spacing[6],
    paddingHorizontal: spacing[2],
  },
  primaryButton: {
    width: "100%",
  },
  ghostButton: {
    width: "100%",
    marginTop: spacing[2],
  },
});
