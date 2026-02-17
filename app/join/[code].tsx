import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/theme";

type JoinState = "loading" | "error" | "unauthenticated";

export default function JoinGroupScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<JoinState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

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

  async function joinGroup(inviteCode: string) {
    setState("loading");
    try {
      const { data, error } = await supabase.rpc("join_group_by_invite", {
        invite: inviteCode,
      });

      if (error) {
        // Check for specific error messages from RPC
        if (
          error.message.toLowerCase().includes("invalid") ||
          error.message.toLowerCase().includes("not found")
        ) {
          setErrorMessage(
            "This invite link is invalid or has expired. Please ask for a new one."
          );
        } else {
          setErrorMessage(error.message);
        }
        setState("error");
        return;
      }

      if (data) {
        // Successfully joined (or already a member) -- navigate to group
        router.replace(`/group/${data}` as any);
      } else {
        setErrorMessage("Something went wrong. Please try again.");
        setState("error");
      }
    } catch {
      setErrorMessage("A network error occurred. Please check your connection.");
      setState("error");
    }
  }

  if (state === "loading") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text
            variant="body"
            color="textSecondary"
            style={styles.loadingText}
          >
            Joining group...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state === "unauthenticated") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text variant="h2" color="textPrimary" style={styles.title}>
            Sign in to join
          </Text>
          <Text
            variant="body"
            color="textSecondary"
            style={styles.description}
          >
            You need to sign in before you can join this group. Please sign in
            and then open the invite link again.
          </Text>
          <Button
            label="Go to Sign In"
            variant="primary"
            onPress={() => router.replace("/(auth)/phone")}
            style={styles.button}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
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
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

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
  loadingText: {
    marginTop: spacing[4],
  },
  title: {
    marginBottom: spacing[3],
    textAlign: "center",
  },
  description: {
    textAlign: "center",
    marginBottom: spacing[6],
    paddingHorizontal: spacing[4],
  },
  button: {
    minWidth: 200,
  },
});
