import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  SafeAreaView,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { colors, spacing } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  created_at: string;
}

function formatPhone(phone: string): string {
  // Format as +63 9XX XXX XXXX
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) {
    const local = digits.slice(2);
    return `+63 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return phone;
}

function formatMemberSince(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user?.id]);

  async function fetchProfile() {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user!.id)
        .single();

      if (!error && data) {
        setProfile(data);
      }
    } catch {
      // Silently fail - UI will show fallback
    } finally {
      setLoading(false);
    }
  }

  function handleSignOut() {
    Alert.alert(
      "Sign out?",
      "You'll need to verify your phone number again to sign back in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            setSigningOut(true);
            try {
              await supabase.auth.signOut();
              // AuthProvider listener will detect session removal
              // and route to auth screen automatically
            } catch {
              setSigningOut(false);
              Alert.alert("Error", "Failed to sign out. Please try again.");
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const displayName = profile?.display_name ?? "User";
  const avatarEmoji = profile?.avatar_url ?? undefined;
  const phoneNumber = profile?.phone_number
    ? formatPhone(profile.phone_number)
    : user?.phone
      ? formatPhone(user.phone)
      : "";
  const memberSince = profile?.created_at
    ? formatMemberSince(profile.created_at)
    : "";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar emoji={avatarEmoji} size="lg" />
          <Text variant="h1" style={styles.name}>
            {displayName}
          </Text>
          {phoneNumber ? (
            <Text variant="body" color="textSecondary">
              {phoneNumber}
            </Text>
          ) : null}
        </View>

        {memberSince ? (
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text variant="body" color="textSecondary">
                Member since
              </Text>
              <Text variant="bodyMedium">{memberSince}</Text>
            </View>
          </Card>
        ) : null}

        <View style={styles.signOutSection}>
          <Button
            variant="ghost"
            label="Sign out"
            onPress={handleSignOut}
            loading={signingOut}
            style={styles.signOutButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexGrow: 1,
    padding: spacing[6],
  },
  header: {
    alignItems: "center",
    marginTop: spacing[8],
    marginBottom: spacing[8],
  },
  name: {
    marginTop: spacing[4],
    marginBottom: spacing[1],
  },
  infoCard: {
    marginBottom: spacing[6],
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  signOutSection: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing[8],
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: colors.error,
  },
});
