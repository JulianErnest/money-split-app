import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  SafeAreaView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar, EMOJI_LIST } from "@/components/ui/Avatar";
import { colors, spacing, radius } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

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
        phone_number: user.phone ?? "",
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
            <Avatar emoji={selectedEmoji} size="lg" />
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
                    <Text style={styles.emojiText}>{emoji}</Text>
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
    padding: spacing[6],
    justifyContent: "center",
  },
  header: {
    marginBottom: spacing[8],
  },
  subtitle: {
    marginTop: spacing[2],
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: spacing[8],
  },
  emojiScroll: {
    marginTop: spacing[4],
    maxHeight: 56,
  },
  emojiRow: {
    gap: spacing[2],
    paddingHorizontal: spacing[1],
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  emojiSelected: {
    borderColor: colors.accent,
  },
  emojiText: {
    fontSize: 22,
  },
  inputSection: {
    marginBottom: spacing[4],
  },
  errorText: {
    marginBottom: spacing[4],
  },
  button: {
    width: "100%",
    marginTop: spacing[4],
  },
});
