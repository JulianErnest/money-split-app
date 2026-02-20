import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { supabase } from "@/lib/supabase";
import { colors, fontFamily, fontSize, spacing } from "@/theme";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

const CAROUSEL_IMAGES = [
  require("@/assets/images/auth/friends-1.jpg"),
  require("@/assets/images/auth/friends-2.jpg"),
  require("@/assets/images/auth/friends-3.jpg"),
];
const INTERVAL = 5000;

export default function PhoneScreen() {
  const router = useRouter();
  const [rawDigits, setRawDigits] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      });
    }, INTERVAL);
    return () => clearInterval(timer);
  }, []);

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
    <View style={styles.root}>
      {/* Background carousel */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <ImageBackground
          source={CAROUSEL_IMAGES[currentIndex]}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Dark overlay */}
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <Text variant="h1" color="accent" style={styles.appName}>
                MoneySplitApp
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
                  maxLength={12}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13, 13, 13, 0.75)",
  },
  safeArea: {
    flex: 1,
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
