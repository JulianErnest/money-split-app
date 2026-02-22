# Phase 14: Core Auth Replacement - Research

**Researched:** 2026-02-22
**Domain:** Apple Sign-In (expo-apple-authentication), Supabase signInWithIdToken, Expo Router auth flow
**Confidence:** HIGH

## Summary

Phase 14 replaces the phone OTP authentication flow with Apple Sign-In using native iOS dialog (Face ID / Touch ID). The implementation uses `expo-apple-authentication` for the native Apple dialog and `supabase.auth.signInWithIdToken` to exchange the Apple identity token for a Supabase session. This is the standard pattern for native Apple Sign-In without OAuth browser redirects.

The work involves: (1) creating a new Apple Sign-In screen that replaces `phone.tsx`, (2) deleting the phone OTP screens (`phone.tsx`, `otp.tsx`), (3) updating all routing references from `/(auth)/phone` to the new Apple sign-in screen, (4) updating profile-setup to handle Apple users who have no phone number at auth time, and (5) updating the profile screen's sign-out message. The auth context (`AuthProvider`, `onAuthStateChange`) requires no changes -- Supabase's `signInWithIdToken` triggers the same auth state events as `signInWithOtp`.

**Primary recommendation:** Create a single new `sign-in.tsx` screen in `app/(auth)/` using `AppleAuthenticationButton` (Apple HIG compliant) with the nonce-based `signInWithIdToken` flow, delete the two OTP screens, and update the three files that reference `/(auth)/phone`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-apple-authentication | ~8.0.8 | Native Apple Sign-In dialog, `AppleAuthenticationButton` component | Already installed; official Expo SDK package; handles iOS entitlements via config plugin |
| @supabase/supabase-js | ^2.96.0 | `signInWithIdToken` for Apple identity token exchange | Already installed; native token exchange since v2.21.0 |
| expo-crypto | ~15.0.x | SHA-256 nonce hashing for `signInAsync` | Required for secure nonce handling; official Expo SDK package compatible with SDK 54 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-router | ~6.0.23 | Navigation routing for auth screens | Already installed; no changes to router itself, only route targets |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| expo-apple-authentication | @invertase/react-native-apple-authentication | expo-apple-authentication is already installed and is the official Expo package; invertase adds unnecessary dependency |
| Nonce-based flow | No-nonce flow | No-nonce technically works but is insecure (replay attacks possible); nonce adds minimal code |
| expo-crypto for SHA-256 | Web Crypto API / manual implementation | expo-crypto is official Expo SDK, works on all platforms, simple API |

**Installation:**
```bash
npx expo install expo-crypto
```

Note: `expo-apple-authentication` is already installed and configured in `app.json`.

## Architecture Patterns

### File Changes Overview
```
app/(auth)/
  _layout.tsx          # UPDATE: Replace phone/otp Stack.Screen with sign-in
  sign-in.tsx          # NEW: Apple Sign-In screen (replaces phone.tsx)
  phone.tsx            # DELETE
  otp.tsx              # DELETE
  profile-setup.tsx    # UPDATE: Remove phone_number from upsert (Apple users have no phone)

app/
  _layout.tsx          # UPDATE: router.replace("/(auth)/phone") -> "/(auth)/sign-in"

app/join/
  [code].tsx           # UPDATE: router.replace("/(auth)/phone") -> "/(auth)/sign-in"

app/(tabs)/
  profile.tsx          # UPDATE: Sign-out alert message (remove phone OTP reference)
```

### Pattern 1: Nonce-Based Apple Sign-In Flow
**What:** Generate a raw nonce, hash it with SHA-256, pass the hash to Apple's `signInAsync`, and the raw nonce to Supabase's `signInWithIdToken`. Supabase hashes the raw nonce and compares it to the nonce embedded in Apple's identity token.
**When to use:** Always -- this is the secure pattern for native Apple Sign-In with Supabase.
**Example:**
```typescript
// Source: Supabase Apple Auth docs + Expo Apple Authentication docs
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";

async function signInWithApple() {
  // 1. Generate raw nonce
  const rawNonce = Crypto.randomUUID();

  // 2. Hash nonce with SHA-256 (Apple requires hashed nonce)
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  // 3. Request Apple Sign-In with hashed nonce
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  // 4. Exchange identity token for Supabase session (pass RAW nonce)
  if (credential.identityToken) {
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) throw error;

    // 5. Capture fullName on first sign-in (Apple only provides it once!)
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
  }
}
```

### Pattern 2: Apple Sign-In Availability Check
**What:** Check if Apple Sign-In is available on the device before rendering the button.
**When to use:** AUTH-04 requires checking credential availability.
**Example:**
```typescript
// Source: Expo Apple Authentication docs
import * as AppleAuthentication from "expo-apple-authentication";

const [isAvailable, setIsAvailable] = useState(false);

useEffect(() => {
  AppleAuthentication.isAvailableAsync().then(setIsAvailable);
}, []);

// Only render button when available
if (!isAvailable) return <FallbackUI />;
```

### Pattern 3: Apple HIG-Compliant Button
**What:** Use `AppleAuthenticationButton` component with required explicit `width` and `height` styling.
**When to use:** Always -- Apple HIG prohibits custom-styled sign-in buttons.
**Example:**
```typescript
// Source: Expo Apple Authentication docs
// CRITICAL: height and width MUST be set or button won't appear
<AppleAuthentication.AppleAuthenticationButton
  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
  cornerRadius={5}
  style={{ width: 280, height: 56 }}
  onPress={handleSignIn}
/>
```

### Pattern 4: Cancellation Error Handling
**What:** Distinguish user cancellation from actual errors.
**When to use:** AUTH-03 requires graceful handling of cancellation.
**Example:**
```typescript
// Source: Expo Apple Authentication docs
try {
  await signInWithApple();
} catch (e: any) {
  if (e.code === "ERR_REQUEST_CANCELED") {
    // User cancelled -- return to sign-in screen silently (AUTH-03)
    return;
  }
  // Actual error -- show message
  setError("Sign-in failed. Please try again.");
}
```

### Pattern 5: Auth Context Unchanged
**What:** `AuthProvider` and `onAuthStateChange` work identically for both `signInWithOtp` and `signInWithIdToken`. No changes needed.
**When to use:** This is the existing pattern -- do not modify it.
**Why:** Both methods produce the same Supabase session with `access_token` and `refresh_token`. The `onAuthStateChange` listener fires `SIGNED_IN` event regardless of provider. Session persistence via `expo-sqlite/localStorage` handles both equally.

### Anti-Patterns to Avoid
- **Custom Apple Sign-In button styling:** Violates Apple HIG and can cause App Store rejection. Must use `AppleAuthenticationButton`.
- **Storing fullName in a separate API call after navigation:** The `credential` object is only available in the `signInAsync` callback. If you navigate away or defer, the fullName data is lost.
- **Calling `signInWithIdToken` without nonce:** Works but is insecure. Always generate and pass a nonce.
- **Storing empty string as phone_number for Apple users:** The profile-setup upsert currently does `phone_number: user.phone ?? ""`. For Apple users, `user.phone` is undefined, so this writes `""` to the database. The NULLIF guard is only in the auth trigger, NOT in client-side upserts. This WILL cause UNIQUE constraint violations for the second Apple user. Must send `null` instead.
- **Using `getCredentialStateAsync` on simulator:** This API only works on real devices. Do not include it in the auth flow.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Apple Sign-In button | Custom `Pressable` with Apple logo | `AppleAuthenticationButton` | Apple HIG requirement; App Store rejection risk |
| Nonce generation | `Math.random()` string | `Crypto.randomUUID()` from expo-crypto | Cryptographically secure; proper entropy |
| Nonce hashing | Manual SHA-256 implementation | `Crypto.digestStringAsync(SHA256, nonce)` | Platform-native, verified implementation |
| Session persistence | Manual token storage | Supabase client `persistSession: true` + expo-sqlite localStorage | Already configured in `lib/supabase.ts` |
| Auth state routing | Manual session checks | `AuthProvider` + `onAuthStateChange` | Already implemented in `lib/auth-context.tsx` |

**Key insight:** The auth context and session management already work correctly with `signInWithIdToken`. The only new code is the Apple dialog trigger and token exchange. Everything downstream (session storage, auth routing, profile setup) uses the same Supabase session object.

## Common Pitfalls

### Pitfall 1: Apple Provides fullName ONLY on First Authorization (CRITICAL)
**What goes wrong:** After the first successful Apple Sign-In, subsequent sign-ins return `null` for `credential.fullName`. If you don't capture it immediately in the first sign-in callback, the name is lost forever (Apple design decision, not a bug).
**Why it happens:** Apple's privacy design only shares name data once per app-user pair. Even deleting and reinstalling the app doesn't reset this.
**How to avoid:** Immediately after `signInWithIdToken` succeeds, check `credential.fullName.givenName` and if present, call `supabase.auth.updateUser({ data: { full_name, given_name, family_name } })` within the same function, before any navigation occurs.
**Warning signs:** First user sign-in works and shows name. Second sign-in (or sign-out + sign-in) shows no name. Cannot be fixed without user going to Settings > Apple ID > Password & Security > Apps Using Apple ID and revoking, then re-authorizing.

### Pitfall 2: Profile Setup Writes Empty String for Phone (CRITICAL)
**What goes wrong:** `profile-setup.tsx` line 58 does `phone_number: user.phone ?? ""`. For Apple users, `user.phone` is undefined, so this writes `""` to the users table. The UNIQUE constraint allows only ONE row with `phone_number = ""`. The second Apple user's profile setup fails with a constraint violation.
**Why it happens:** The NULLIF guard from Phase 13 is in the auth trigger, but profile-setup uses a direct client-side upsert to the `users` table.
**How to avoid:** Change the profile-setup upsert to send `phone_number: user.phone ?? null` (or omit the field entirely when phone is not available). Since the column is now nullable (Phase 13), this is safe.
**Warning signs:** First Apple user completes profile setup. Second Apple user gets a database error during profile setup.

### Pitfall 3: AppleAuthenticationButton Not Rendering (Height/Width)
**What goes wrong:** The `AppleAuthenticationButton` renders as invisible / 0-height if `width` and `height` are not explicitly set in the `style` prop.
**Why it happens:** Unlike normal React Native components, the native Apple button does not self-size. The Expo docs explicitly warn about this.
**How to avoid:** Always set explicit `width` and `height` in the `style` prop. Do not rely on `flex: 1` or parent layout alone.
**Warning signs:** Screen renders but button is not visible. No crash, no error.

### Pitfall 4: Stale Route References to phone.tsx
**What goes wrong:** After deleting `phone.tsx` and `otp.tsx`, the app crashes because `_layout.tsx` still references `/(auth)/phone` and `join/[code].tsx` still navigates to `/(auth)/phone`.
**Why it happens:** Route references are string literals scattered across multiple files.
**How to avoid:** Search entire codebase for `/(auth)/phone` and `/(auth)/otp` before deleting files. There are exactly 3 references to update:
  1. `app/_layout.tsx` line 39: `router.replace("/(auth)/phone")` -> `"/(auth)/sign-in"`
  2. `app/join/[code].tsx` line 254: `router.replace("/(auth)/phone")` -> `"/(auth)/sign-in"`
  3. `app/(auth)/_layout.tsx` lines 12-13: Replace `Stack.Screen name="phone"` and `name="otp"` with `name="sign-in"`
**Warning signs:** App crashes on launch for unauthenticated users, or on opening join link.

### Pitfall 5: Sign-Out Alert References Phone OTP
**What goes wrong:** The profile screen's sign-out alert says "You'll need to verify your phone number again to sign back in." which is incorrect after switching to Apple Sign-In.
**Why it happens:** The alert message was written for the phone OTP flow.
**How to avoid:** Update the alert message in `app/(tabs)/profile.tsx` line 77 to reference Apple Sign-In instead.
**Warning signs:** Users see confusing messaging about phone verification after the auth flow has changed.

### Pitfall 6: Testing on iOS Simulator
**What goes wrong:** Apple Sign-In does not work reliably on the iOS Simulator. `signInAsync` may throw errors or behave unexpectedly. `getCredentialStateAsync` always fails on simulator.
**Why it happens:** Apple Sign-In requires Secure Enclave and real Apple ID integration that the simulator cannot provide.
**How to avoid:** Test on a real iOS device. This is documented as a hard requirement in the phase blockers. Use `isAvailableAsync()` check (AUTH-04) to gracefully handle unavailable environments.
**Warning signs:** Auth works in development but fails in testing. Simulator returns `ERR_REQUEST_FAILED`.

### Pitfall 7: Nonce Mismatch Causes 400 Error
**What goes wrong:** `signInWithIdToken` returns HTTP 400 if the raw nonce passed to Supabase doesn't match the hashed nonce embedded in Apple's identity token.
**Why it happens:** Developers pass the hashed nonce to both Apple and Supabase instead of passing hashed to Apple and raw to Supabase.
**How to avoid:** Follow the pattern exactly: `hashedNonce` -> Apple `signInAsync({ nonce: hashedNonce })`; `rawNonce` -> Supabase `signInWithIdToken({ nonce: rawNonce })`.
**Warning signs:** Apple dialog succeeds but Supabase returns error. Console shows 400 status.

### Pitfall 8: Supabase Provider Not Configured or Wrong Client ID
**What goes wrong:** `signInWithIdToken` returns 400 or 422 error even with correct nonce handling.
**Why it happens:** The Apple provider is not enabled in Supabase dashboard, or the Authorized Client IDs field doesn't contain the app's bundle ID.
**How to avoid:** Phase 13 should have configured this (bundle ID `com.kkbsplit.app` in Authorized Client IDs). Verify before testing Phase 14.
**Warning signs:** Nonce is correct but Supabase still rejects the token.

## Code Examples

### Complete Sign-In Screen (sign-in.tsx)
```typescript
// Source: Supabase Apple Auth docs + Expo Apple Authentication docs
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import React, { useEffect, useState } from "react";
import {
  Animated,
  ImageBackground,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/components/ui/Text";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/theme";

// Reuse the carousel images from the old phone.tsx
const CAROUSEL_IMAGES = [
  require("@/assets/images/auth/friends-1.jpg"),
  require("@/assets/images/auth/friends-2.jpg"),
  require("@/assets/images/auth/friends-3.jpg"),
];
const INTERVAL = 5000;

export default function SignInScreen() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setIsAvailable);
  }, []);

  // Image carousel (same as old phone.tsx)
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

  async function handleSignIn() {
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      // Generate nonce
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      // Apple Sign-In dialog
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

      // Exchange for Supabase session
      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      // Capture fullName IMMEDIATELY (only available on first sign-in)
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
      if (e.code === "ERR_REQUEST_CANCELED") {
        // User cancelled -- do nothing (AUTH-03)
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
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text variant="h1" color="accent" style={styles.appName}>
              KKB
            </Text>
            <Text variant="body" color="textSecondary">
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
  root: { flex: 1, backgroundColor: colors.background },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(13,13,13,0.75)" },
  safeArea: { flex: 1 },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: spacing[6] },
  header: { marginBottom: spacing[10] },
  appName: { marginBottom: spacing[2] },
  error: { marginBottom: spacing[4] },
  appleButton: { width: "100%", height: 56 },
});
```

### Updated Auth Layout
```typescript
// app/(auth)/_layout.tsx
import { Stack } from "expo-router";
import { colors } from "@/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="profile-setup" />
    </Stack>
  );
}
```

### Updated Root Layout Navigation
```typescript
// In app/_layout.tsx RootNavigator, change line 39:
// Before:
router.replace("/(auth)/phone");
// After:
router.replace("/(auth)/sign-in");
```

### Updated Join Flow Navigation
```typescript
// In app/join/[code].tsx, change line 254:
// Before:
onPress={() => router.replace("/(auth)/phone")}
// After:
onPress={() => router.replace("/(auth)/sign-in")}
```

### Updated Profile Setup (phone_number fix)
```typescript
// In app/(auth)/profile-setup.tsx, change line 56-62:
// Before:
const { error: upsertError } = await supabase.from("users").upsert({
  id: user.id,
  phone_number: user.phone ?? "",
  display_name: trimmedName,
  avatar_url: selectedEmoji,
});

// After:
const { error: upsertError } = await supabase.from("users").upsert({
  id: user.id,
  phone_number: user.phone ?? null,
  display_name: trimmedName,
  avatar_url: selectedEmoji,
});
```

### Updated Profile Screen Sign-Out Message
```typescript
// In app/(tabs)/profile.tsx, change line 77:
// Before:
"You'll need to verify your phone number again to sign back in.",
// After:
"You'll need to sign in with Apple again to access your account.",
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phone OTP (`signInWithOtp`) | Apple Sign-In (`signInWithIdToken`) | This phase | Simpler UX, no SMS costs, no OTP entry |
| OAuth browser redirect for Apple | Native `signInWithIdToken` | Supabase JS v2.21.0+ | No browser popup, no 6-month key rotation |
| No nonce in Apple flow | SHA-256 nonce via expo-crypto | Best practice since 2024 | Prevents replay attacks |

**Deprecated/outdated:**
- `signInWithOtp` for phone: Being removed in this phase
- `@invertase/react-native-apple-authentication`: Older library; `expo-apple-authentication` is the Expo-native replacement
- OAuth flow for Apple on native: `signInWithIdToken` is strictly better (no key rotation, no browser)

## Open Questions

1. **expo-crypto version compatibility with Expo SDK 54**
   - What we know: expo-crypto is an official Expo SDK package and should be compatible. The docs reference SDK 54.
   - What's unclear: The exact version that `npx expo install expo-crypto` will resolve for SDK 54.
   - Recommendation: Install with `npx expo install expo-crypto` which auto-selects the compatible version. LOW risk.

2. **Whether `Crypto.randomUUID()` is sufficient nonce entropy**
   - What we know: `randomUUID()` generates a v4 UUID (122 bits of randomness) which is cryptographically random. This is the same approach recommended in Firebase and Supabase examples.
   - What's unclear: Whether Supabase has specific nonce length requirements.
   - Recommendation: Use `randomUUID()` -- it's the pattern shown in expo-crypto docs and provides sufficient entropy. MEDIUM confidence.

3. **fullName capture reliability on first sign-in**
   - What we know: Apple provides fullName ONLY on first authorization. If the user has previously authorized the app (e.g., during TestFlight testing), fullName will be null.
   - What's unclear: How to handle users who already authorized during development. Revoking in Settings > Apple ID is the only reset.
   - Recommendation: Store fullName in `user_metadata` via `updateUser` when available. Accept that some test users may need to revoke and re-authorize. Document this for testers.

4. **Whether `AppleAuthenticationButton` style width "100%" works**
   - What we know: Expo docs say explicit width and height are required. Percentage widths may or may not work.
   - What's unclear: Whether `width: "100%"` is treated the same as a numeric pixel value.
   - Recommendation: Test with `width: "100%"` first. If the button doesn't render, fall back to a numeric width or use `onLayout` to measure parent width. LOW risk.

## Sources

### Primary (HIGH confidence)
- Expo Apple Authentication docs (https://docs.expo.dev/versions/latest/sdk/apple-authentication/) -- API reference, `signInAsync`, `AppleAuthenticationButton`, error codes, platform notes
- Expo Crypto docs (https://docs.expo.dev/versions/latest/sdk/crypto/) -- `digestStringAsync`, `randomUUID`, `CryptoDigestAlgorithm.SHA256`
- Supabase Apple Sign-In docs (https://supabase.com/docs/guides/auth/social-login/auth-apple) -- `signInWithIdToken` pattern, nonce handling, fullName capture
- Supabase GitHub raw docs (https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/social-login/auth-apple.mdx) -- Expo-specific code example with nonce
- Codebase analysis: `app/(auth)/phone.tsx`, `app/(auth)/otp.tsx`, `app/(auth)/_layout.tsx`, `app/(auth)/profile-setup.tsx`, `app/_layout.tsx`, `app/join/[code].tsx`, `app/(tabs)/profile.tsx`, `lib/auth-context.tsx`, `lib/supabase.ts`
- Phase 13 Research (`.planning/phases/13-database-infrastructure-prep/13-RESEARCH.md`) -- database prep context, NULLIF pattern, Supabase provider config

### Secondary (MEDIUM confidence)
- Supabase Expo Social Auth Quickstart (https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth) -- full component example
- Supabase signInWithIdToken API reference (https://supabase.com/docs/reference/javascript/auth-signinwithidtoken) -- parameter types
- Supabase GitHub Issue #26747 (https://github.com/supabase/supabase/issues/26747) -- 400 error caused by missing Client ID configuration
- Supabase GitHub Issue #1392 (https://github.com/supabase/supabase-js/issues/1392) -- fullName not available after first sign-in

### Tertiary (LOW confidence)
- Community blog posts about Apple Sign-In nonce patterns -- confirmed by primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- expo-apple-authentication already installed; signInWithIdToken is well-documented; expo-crypto is official Expo SDK
- Architecture: HIGH -- all file changes identified by codebase grep; auth context pattern verified; routing references enumerated
- Pitfalls: HIGH -- verified against official docs (fullName, button sizing, nonce), codebase analysis (empty string phone, stale routes, sign-out message), and GitHub issues (400 error, nonce mismatch)
- Code examples: HIGH -- based on official Supabase + Expo docs, adapted to match existing codebase patterns (carousel, theme, component library)

**Research date:** 2026-02-22
**Valid until:** 30 days (Expo SDK and Supabase auth APIs are stable; Apple Sign-In protocol unchanged)
