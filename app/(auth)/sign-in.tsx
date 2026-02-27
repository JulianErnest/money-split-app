import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  ImageBackground,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/components/ui/Text";
import { trackSignIn } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { colors, fontFamily, fontSize, radius, spacing } from "@/theme";

const CAROUSEL_IMAGES = [
  require("@/assets/images/auth/friends-1.jpg"),
  require("@/assets/images/auth/friends-2.jpg"),
  require("@/assets/images/auth/friends-3.jpg"),
];
const INTERVAL = 5000;

const CAROUSEL_TAGLINES = [
  "Split bills, not friendships",
  "Track expenses with your barkada",
  "Settle up in seconds",
];

export default function SignInScreen() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // AUTH-04: Check Apple Sign-In availability
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setIsAvailable);
  }, []);

  // Image carousel (same pattern as phone.tsx)
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

  // AUTH-02: Nonce-based Apple Sign-In flow
  async function handleSignIn() {
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      // Generate raw nonce and hash it
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      // AUTH-01: Trigger native Apple Sign-In dialog
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        setError("Sign-in failed. Please try again.");
        return;
      }

      // Exchange Apple identity token for Supabase session
      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      trackSignIn('apple');

      // CRITICAL: Capture fullName immediately (Apple only provides it on first auth)
      if (credential.fullName?.givenName) {
        const fullName = [
          credential.fullName.givenName,
          credential.fullName.familyName,
        ]
          .filter(Boolean)
          .join(" ");

        await supabase.auth.updateUser({
          data: {
            full_name: fullName,
            given_name: credential.fullName.givenName,
            family_name: credential.fullName.familyName,
          },
        });
      }

      // AuthProvider's onAuthStateChange handles navigation automatically
    } catch (e: any) {
      // AUTH-03: User cancellation -- return silently
      if (e.code === "ERR_REQUEST_CANCELED") {
        return;
      }
      setError("Sign-in failed. Please try again.");
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

      {/* Gradient overlay -- lighter top, darker bottom */}
      <View style={styles.overlayTop} />
      <View style={styles.overlayBottom} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Page indicator dots */}
          <View style={styles.dotsRow}>
            {CAROUSEL_IMAGES.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {/* Rotating tagline -- fades with carousel */}
          <Animated.View style={{ opacity: fadeAnim, marginBottom: spacing[6] }}>
            <Text variant="h2" color="textPrimary" style={styles.tagline}>
              {CAROUSEL_TAGLINES[currentIndex]}
            </Text>
          </Animated.View>

          <View style={styles.header}>
            <Text color="accent" style={styles.appName}>
              KKB
            </Text>
            <Text variant="body" color="textSecondary" style={styles.subtitle}>
              Split expenses with your barkada
            </Text>
          </View>

          {error ? (
            <Text variant="caption" color="error" style={styles.error}>
              {error}
            </Text>
          ) : null}

          {isAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
              }
              buttonStyle={
                AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              }
              cornerRadius={8}
              style={styles.appleButton}
              onPress={handleSignIn}
            />
          ) : (
            <Text variant="body" color="textSecondary">
              Apple Sign-In is not available on this device.
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlayTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(13, 13, 13, 0.3)",
  },
  overlayBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(13, 13, 13, 0.85)",
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[12],
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing[2],
    marginBottom: spacing[8],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
  dotInactive: {
    backgroundColor: colors.textTertiary,
  },
  tagline: {
    textAlign: "center",
  },
  header: {
    marginBottom: spacing[6],
  },
  appName: {
    fontSize: fontSize.hero,
    fontFamily: fontFamily.extraBold,
    lineHeight: fontSize.hero * 1.2,
    textAlign: "center",
    marginBottom: spacing[2],
  },
  subtitle: {
    textAlign: "center",
  },
  error: {
    marginBottom: spacing[4],
  },
  appleButton: {
    width: "100%",
    height: 56,
  },
});
