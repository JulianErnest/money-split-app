import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  SafeAreaView,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { colors, fontFamily, fontSize, spacing, radius } from "@/theme";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_WRONG_ATTEMPTS = 3;
const LOCKOUT_DURATION_SECONDS = 5 * 60; // 5 minutes

function maskPhone(phone: string): string {
  // +63 9XX XXX XXXX → +63 9XX XXX XXXX with middle masked
  if (phone.length < 6) return phone;
  const prefix = phone.slice(0, 6); // +63 9X
  const suffix = phone.slice(-4);
  return `${prefix}X XXX ${suffix}`;
}

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockedUntil) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        setLockedUntil(null);
        setWrongAttempts(0);
        setError("");
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  const verifyOtp = useCallback(
    async (code: string) => {
      if (verifying || isLocked || !phone) return;

      setVerifying(true);
      setError("");

      try {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          phone,
          token: code,
          type: "sms",
        });

        if (verifyError) {
          const newAttempts = wrongAttempts + 1;
          setWrongAttempts(newAttempts);

          if (newAttempts >= MAX_WRONG_ATTEMPTS) {
            const lockTime = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
            setLockedUntil(lockTime);
            setLockoutRemaining(LOCKOUT_DURATION_SECONDS);
            setError("Too many attempts. Try again in 5 minutes.");
          } else {
            const remaining = MAX_WRONG_ATTEMPTS - newAttempts;
            setError(
              `Invalid code. ${remaining} attempt${remaining > 1 ? "s" : ""} remaining.`
            );
          }

          // Clear digits on wrong attempt
          setDigits(Array(OTP_LENGTH).fill(""));
          inputRefs.current[0]?.focus();
        }
        // On success: AuthProvider's onAuthStateChange handles navigation
      } catch {
        setError("Network error. Please try again.");
        setDigits(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      } finally {
        setVerifying(false);
      }
    },
    [phone, verifying, wrongAttempts, isLocked]
  );

  function handleDigitChange(text: string, index: number) {
    if (isLocked) return;

    // Only accept single digit
    const digit = text.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (error) setError("");

    if (digit && index < OTP_LENGTH - 1) {
      // Auto-advance to next box
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are filled
    if (digit && index === OTP_LENGTH - 1) {
      const code = newDigits.join("");
      if (code.length === OTP_LENGTH) {
        verifyOtp(code);
      }
    }
  }

  function handleKeyPress(
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      // Move to previous box on backspace when current is empty
      const newDigits = [...digits];
      newDigits[index - 1] = "";
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || resending || isLocked || !phone) return;

    setResending(true);
    setError("");

    try {
      const { error: resendError } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (resendError) {
        setError(resendError.message);
      } else {
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setWrongAttempts(0);
        setDigits(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  }

  function formatLockoutTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text variant="h2" color="textPrimary">
            Enter verification code
          </Text>
          <Text variant="body" color="textSecondary" style={styles.subtitle}>
            Sent to {maskPhone(phone ?? "")}
          </Text>
        </View>

        <View style={styles.otpContainer}>
          <View style={styles.otpRow}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.otpBox,
                  index === digits.findIndex((d) => !d) && styles.otpBoxFocused,
                  isLocked && styles.otpBoxDisabled,
                ]}
                value={digit}
                onChangeText={(text) => handleDigitChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                editable={!verifying && !isLocked}
                selectTextOnFocus
                autoFocus={index === 0}
              />
            ))}
          </View>

          {verifying && (
            <ActivityIndicator
              color={colors.accent}
              style={styles.spinner}
            />
          )}

          {error ? (
            <Text variant="caption" color="error" style={styles.error}>
              {error}
            </Text>
          ) : null}

          {isLocked && (
            <Text variant="caption" color="textSecondary" style={styles.lockoutTimer}>
              Try again in {formatLockoutTime(lockoutRemaining)}
            </Text>
          )}
        </View>

        {!isLocked && (
          <View style={styles.resendContainer}>
            {resendCooldown > 0 ? (
              <Text variant="body" color="textTertiary">
                Resend in {resendCooldown}s
              </Text>
            ) : (
              <Button
                variant="ghost"
                label={resending ? "Sending..." : "Resend code"}
                onPress={handleResend}
                disabled={resending}
              />
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing[6],
  },
  header: {
    marginBottom: spacing[8],
  },
  subtitle: {
    marginTop: spacing[2],
  },
  otpContainer: {
    alignItems: "center",
    marginBottom: spacing[8],
  },
  otpRow: {
    flexDirection: "row",
    gap: spacing[2],
  },
  otpBox: {
    width: 48,
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "transparent",
    textAlign: "center",
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bold,
    color: colors.textPrimary,
  },
  otpBoxFocused: {
    borderColor: colors.inputBorderFocused,
  },
  otpBoxDisabled: {
    opacity: 0.4,
  },
  spinner: {
    marginTop: spacing[4],
  },
  error: {
    marginTop: spacing[3],
    textAlign: "center",
  },
  lockoutTimer: {
    marginTop: spacing[2],
    textAlign: "center",
  },
  resendContainer: {
    alignItems: "center",
  },
});
