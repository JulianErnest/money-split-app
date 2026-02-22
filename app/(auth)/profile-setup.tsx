import { Avatar, EMOJI_LIST } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { colors, radius, spacing } from "@/theme";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text as RNText,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DISPLAY_EMOJIS = EMOJI_LIST.slice(0, 10);

export default function ProfileSetupScreen() {
  const { user, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Pre-select a random emoji on mount
    const randomIndex = Math.floor(Math.random() * DISPLAY_EMOJIS.length);
    setSelectedEmoji(DISPLAY_EMOJIS[randomIndex]);
  }, []);

  const trimmedName = displayName.trim();
  const isValid = trimmedName.length >= 2;

  async function handleSubmit() {
    setSubmitted(true);

    if (!isValid) {
      setError("Name must be at least 2 characters");
      return;
    }

    if (!user) {
      setError("Not authenticated. Please try again.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const { error: upsertError } = await supabase.from("users").upsert({
        id: user.id,
        phone_number: user.phone ?? null,
        display_name: trimmedName,
        avatar_url: selectedEmoji,
      });

      if (upsertError) {
        setError(upsertError.message);
        setSaving(false);
        return;
      }

      // Refresh auth context so isNewUser becomes false
      // Root layout will auto-redirect to (tabs)
      setSaving(false);
      await refreshProfile();
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  const validationError =
    submitted && !isValid ? "Name must be at least 2 characters" : "";

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text variant="h1">Set up your profile</Text>
            <Text variant="body" color="textSecondary" style={styles.subtitle}>
              Let your friends know who you are
            </Text>
          </View>

          <View style={styles.avatarSection}>
            <Avatar emoji={selectedEmoji} size="xl" />
            <Text
              variant="caption"
              color="textSecondary"
              style={styles.avatarHint}
            >
              Pick your avatar
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiRow}
              style={styles.emojiScroll}
            >
              {DISPLAY_EMOJIS.map((emoji) => {
                const isSelected = emoji === selectedEmoji;
                return (
                  <Pressable
                    key={emoji}
                    onPress={() => setSelectedEmoji(emoji)}
                    style={[
                      styles.emojiOption,
                      isSelected && styles.emojiSelected,
                    ]}
                  >
                    <RNText style={styles.emojiText}>{emoji}</RNText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.inputSection}>
            <Input
              label="Display name"
              placeholder="e.g., Juan"
              value={displayName}
              onChangeText={(text) => {
                setDisplayName(text);
                if (submitted && text.trim().length >= 2) {
                  setError("");
                }
              }}
              maxLength={30}
              autoFocus
              error={validationError}
            />
          </View>

          {error && !validationError ? (
            <Text variant="caption" color="error" style={styles.errorText}>
              {error}
            </Text>
          ) : null}

          <Button
            label="Let's go!"
            onPress={handleSubmit}
            disabled={!isValid}
            loading={saving}
            style={styles.button}
          />

          <Button
            label="Sign out"
            variant="ghost"
            onPress={() => supabase.auth.signOut()}
            style={styles.signOut}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing[8],
    justifyContent: "center",
  },
  header: {
    marginBottom: spacing[10],
    alignItems: "center",
  },
  subtitle: {
    marginTop: spacing[2],
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: spacing[10],
  },
  avatarHint: {
    marginTop: spacing[3],
    marginBottom: spacing[1],
  },
  emojiScroll: {
    marginTop: spacing[4],
    flexGrow: 0,
    alignSelf: "stretch",
  },
  emojiRow: {
    gap: spacing[3],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
  },
  emojiOption: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "transparent",
  },
  emojiSelected: {
    borderColor: colors.accent,
  },
  emojiText: {
    fontSize: 32,
    lineHeight: 38,
  },
  inputSection: {
    marginBottom: spacing[5],
  },
  errorText: {
    marginBottom: spacing[4],
  },
  button: {
    width: "100%",
    marginTop: spacing[6],
  },
  signOut: {
    borderWidth: 1,
    marginTop: spacing[6],
    borderColor: colors.error,
  },
});
