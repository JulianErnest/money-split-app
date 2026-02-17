import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { colors, fontFamily, fontSize, spacing, radius } from "@/theme";

export default function PhoneScreen() {
  const router = useRouter();
  const [rawDigits, setRawDigits] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = rawDigits.length === 10;

  function formatDisplay(digits: string): string {
    // Format: 9XX XXX XXXX
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  function handleChangeText(text: string) {
    // Strip non-digits
    const digits = text.replace(/\D/g, "").slice(0, 10);
    setRawDigits(digits);
    if (error) setError("");
  }

  async function handleSubmit() {
    if (!isValid || loading) return;

    setLoading(true);
    setError("");

    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        phone: `+63${rawDigits}`,
      });

      if (signInError) {
        if (signInError.message.includes("rate")) {
          setError("Too many requests. Please try again later.");
        } else {
          setError(signInError.message);
        }
        return;
      }

      router.push({
        pathname: "/(auth)/otp",
        params: { phone: `+63${rawDigits}` },
      });
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text variant="h1" color="accent" style={styles.appName}>
              Hatian
            </Text>
            <Text variant="body" color="textSecondary">
              Split expenses with your barkada
            </Text>
          </View>

          <View style={styles.inputSection}>
            <Text variant="label" color="textTertiary" style={styles.label}>
              Phone number
            </Text>

            <View style={styles.phoneRow}>
              <Text style={styles.prefix}>+63</Text>
              <TextInput
                style={styles.phoneInput}
                value={formatDisplay(rawDigits)}
                onChangeText={handleChangeText}
                keyboardType="number-pad"
                maxLength={12} // 10 digits + 2 spaces
                placeholder="9XX XXX XXXX"
                placeholderTextColor={colors.inputPlaceholder}
                selectionColor={colors.accent}
                cursorColor={colors.accent}
                autoFocus
              />
            </View>

            {error ? (
              <Text variant="caption" color="error" style={styles.error}>
                {error}
              </Text>
            ) : null}
          </View>

          <Button
            label="Send OTP"
            onPress={handleSubmit}
            disabled={!isValid}
            loading={loading}
            style={styles.button}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing[6],
  },
  header: {
    marginBottom: spacing[10],
  },
  appName: {
    marginBottom: spacing[2],
  },
  inputSection: {
    marginBottom: spacing[8],
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
  error: {
    marginTop: spacing[2],
  },
  button: {
    width: "100%",
  },
});
