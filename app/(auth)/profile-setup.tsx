import { Avatar, EMOJI_LIST } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { trackProfileCompleted } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";
import { isValidPHPhone } from "@/lib/group-members";
import { supabase } from "@/lib/supabase";
import { colors, fontFamily, fontSize, radius, spacing } from "@/theme";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text as RNText,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DISPLAY_EMOJIS = EMOJI_LIST.slice(0, 10);

export default function ProfileSetupScreen() {
  const { user, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // PROF-04: Pre-fill Apple-provided name from user_metadata
    const appleName = user?.user_metadata?.full_name;
    if (appleName && typeof appleName === "string") {
      setDisplayName(appleName);
    }

    // Pre-select a random emoji on mount
    const randomIndex = Math.floor(Math.random() * DISPLAY_EMOJIS.length);
    setSelectedEmoji(DISPLAY_EMOJIS[randomIndex]);
  }, []);

  const trimmedName = displayName.trim();
  const nameValid = trimmedName.length >= 2;
  const phoneValid = isValidPHPhone(phoneDigits);
  const isValid = nameValid && phoneValid;

  function formatPhoneInput(digits: string): string {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6)
      return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  function handlePhoneChange(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 10);
    setPhoneDigits(digits);
    if (submitted && isValidPHPhone(digits)) {
      setError("");
    }
  }

  async function handleSubmit() {
    setSubmitted(true);

    if (!isValid) {
      return;
    }

    if (!user) {
      setError("Not authenticated. Please try again.");
      return;
    }

    setSaving(true);
    setError("");

    const phoneE164 = `+63${phoneDigits}`;

    try {
      // Step 1: Upsert user profile
      const { error: upsertError } = await supabase.from("users").upsert({
        id: user.id,
        phone_number: phoneE164,
        display_name: trimmedName,
        avatar_url: selectedEmoji,
      });

      if (upsertError) {
        // PROF-03: Handle phone uniqueness constraint violation
        if (
          upsertError.code === "23505" ||
          upsertError.message.includes("duplicate key") ||
          upsertError.message.includes("unique")
        ) {
          setError(
            "This phone number is already registered to another account.",
          );
        } else {
          setError(upsertError.message);
        }
        setSaving(false);
        return;
      }

      // Step 2: Link pending invites for this phone (PROF-06)
      const { error: linkError } = await supabase.rpc(
        "link_phone_to_pending_invites",
        { p_phone_number: phoneE164 },
      );

      if (linkError) {
        console.warn("Failed to link pending invites:", linkError.message);
      }

      // Step 3: Refresh auth context so isNewUser becomes false
      // Root layout will auto-redirect to (tabs)
      setSaving(false);
      await refreshProfile();
      trackProfileCompleted(selectedEmoji !== '');
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  const nameError =
    submitted && !nameValid ? "Name must be at least 2 characters" : "";
  const phoneError =
    submitted && !phoneValid ? "Enter a valid Philippine mobile number" : "";

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
              error={nameError}
            />
          </View>

          <View style={styles.inputSection}>
            <Text variant="label" color="textTertiary" style={styles.label}>
              Phone number
            </Text>
            <View style={styles.phoneRow}>
              <Text style={styles.prefix}>+63</Text>
              <TextInput
                style={styles.phoneInput}
                value={formatPhoneInput(phoneDigits)}
                onChangeText={handlePhoneChange}
                keyboardType="number-pad"
                maxLength={12}
                placeholder="9XX XXX XXXX"
                placeholderTextColor={colors.inputPlaceholder}
                selectionColor={colors.accent}
                cursorColor={colors.accent}
              />
            </View>
            {phoneError ? (
              <Text variant="caption" color="error" style={styles.phoneError}>
                {phoneError}
              </Text>
            ) : null}
          </View>

          {error ? (
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
  label: {
    marginBottom: spacing[2],
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
  },
  prefix: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontFamily: fontFamily.semiBold,
    marginRight: spacing[2],
    paddingVertical: spacing[3],
  },
  phoneInput: {
    flex: 1,
    color: colors.inputText,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.lg,
    paddingVertical: spacing[3],
  },
  phoneError: {
    marginTop: spacing[2],
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
