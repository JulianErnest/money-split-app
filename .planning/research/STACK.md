# Technology Stack: Apple Sign-In Integration

**Project:** KKB (HatianApp) -- Apple Sign-In replacing Phone OTP
**Researched:** 2026-02-22
**Overall confidence:** HIGH

## Current Stack (No Changes Needed)

These are already installed and require zero modifications for Apple Sign-In:

| Technology | Installed Version | Role in Apple Sign-In |
|------------|-------------------|----------------------|
| `expo` | ~54.0.33 | Managed workflow, config plugins |
| `@supabase/supabase-js` | ^2.96.0 | `signInWithIdToken()` -- already supports Apple natively |
| `expo-sqlite` | ~16.0.10 | Session persistence via localStorage polyfill -- unchanged |
| `expo-router` | ~6.0.23 | Auth-gated routing -- unchanged |
| TypeScript | ~5.9.2 | Type safety -- unchanged |

**Key insight:** The existing `@supabase/supabase-js` v2.96.0 already includes `signInWithIdToken()` (available since v2.21.0). No Supabase library upgrade needed.

## New Dependencies to Add

### Required: expo-apple-authentication

| Field | Value |
|-------|-------|
| **Package** | `expo-apple-authentication` |
| **Version** | `~8.0.8` (latest stable for SDK 54) |
| **Purpose** | Native iOS Apple Sign-In dialog, credential handling, built-in button component |
| **Platform** | iOS only (no Android, no web support) |
| **Confidence** | HIGH -- verified via npm registry and Expo SDK 54 branch |

**Why this library:**
- First-party Expo package, guaranteed compatibility with SDK 54 managed workflow
- Provides native `ASAuthorizationController` dialog (not a web-based OAuth popup)
- Includes a pre-built `AppleAuthenticationButton` component that follows Apple's Human Interface Guidelines (required for App Store approval)
- Config plugin auto-configures the `com.apple.developer.applesignin` entitlement during EAS Build
- Works in Expo Go for iOS development testing

**Install command:**
```bash
npx expo install expo-apple-authentication
```

**Key APIs used:**
- `AppleAuthentication.signInAsync()` -- triggers native sign-in dialog, returns `identityToken`
- `AppleAuthentication.AppleAuthenticationButton` -- renders Apple-compliant sign-in button
- `AppleAuthentication.isAvailableAsync()` -- checks if Apple Sign-In is available on device
- `AppleAuthentication.getCredentialStateAsync()` -- checks if credential is still valid/revoked

### Optional but Recommended: expo-crypto

| Field | Value |
|-------|-------|
| **Package** | `expo-crypto` |
| **Version** | `~15.0.8` (latest stable for SDK 54) |
| **Purpose** | Nonce generation and SHA-256 hashing for replay attack prevention |
| **Platform** | iOS, Android, Web (universal) |
| **Confidence** | HIGH -- verified via npm registry and Expo docs |

**Why this library:**
- `signInAsync()` accepts an optional `nonce` parameter to prevent replay attacks
- Supabase's `signInWithIdToken()` can verify the nonce if provided
- `expo-crypto` provides `digestStringAsync()` for SHA-256 hashing and `randomUUID()` for nonce generation
- While the nonce is technically optional for Apple native sign-in (Apple's own anti-replay protections exist), it adds defense-in-depth

**Install command:**
```bash
npx expo install expo-crypto
```

**Key APIs used:**
- `Crypto.randomUUID()` -- generates raw nonce
- `Crypto.digestStringAsync(CryptoDigestAlgorithm.SHA256, rawNonce)` -- hashes nonce before passing to `signInAsync()`

**Recommendation:** Include it. The cost is near-zero (tiny package, no native config needed), and it provides meaningful security improvement. If you want to keep dependencies minimal and ship faster, you can omit it -- Apple's native flow has its own replay protections.

## app.json Configuration Changes

### Required Changes

Add to the existing `app.json`:

```json
{
  "expo": {
    "ios": {
      "usesAppleSignIn": true
    },
    "plugins": [
      "expo-apple-authentication"
    ]
  }
}
```

**What these do:**
- `ios.usesAppleSignIn: true` -- adds the `com.apple.developer.applesignin` entitlement to the iOS build. Without this, the Apple Sign-In dialog will fail at runtime.
- `plugins: ["expo-apple-authentication"]` -- runs the config plugin during prebuild/EAS Build to configure native capabilities automatically. This sets `CFBundleAllowMixedLocalizations` to true so the sign-in button uses the device locale.

**Merged with existing config, the plugins array becomes:**
```json
"plugins": [
  "expo-router",
  ["expo-splash-screen", { ... }],
  "expo-sqlite",
  "expo-font",
  "expo-apple-authentication"
]
```

### No eas.json Changes Needed

The current EAS configuration handles this correctly as-is. EAS Build will automatically:
1. Read `ios.usesAppleSignIn: true` from app.json
2. Enable the "Sign In with Apple" capability on the provisioning profile
3. Add the entitlement to the binary

No manual Xcode configuration or bare workflow ejection is needed.

## Supabase Dashboard Configuration

### For Native-Only (Recommended Path)

Since KKB is iOS-only for Apple Sign-In (native dialog, not OAuth):

1. Go to **Supabase Dashboard > Authentication > Providers > Apple**
2. Enable the Apple provider
3. Add your iOS bundle identifier (`com.kkbsplit.app`) to the **Client IDs** field
4. **You do NOT need to configure:** Secret Key, Services ID, or any OAuth callback URLs

**Critical advantage of native-only:** No 6-month secret key rotation. The OAuth flow requires Apple to generate a secret from a .p8 signing key, and that secret expires every 6 months. The native `signInWithIdToken()` flow bypasses this entirely -- Supabase verifies the ID token directly against Apple's public keys (https://appleid.apple.com/auth/keys).

**Confidence:** HIGH -- confirmed by official Supabase docs: "If you're building a native app only, you do not need to configure the OAuth settings."

### Apple Developer Console Setup

Required steps in Apple Developer Console (https://developer.apple.com):

1. **Certificates, Identifiers & Profiles > Identifiers**
2. Select your App ID (`com.kkbsplit.app`) or create one
3. Enable **"Sign In with Apple"** capability
4. Save

That is all. No Services ID, no signing key (.p8), no callback URL configuration for native-only flow.

## Integration Pattern

The auth flow connects these pieces:

```
User taps "Sign in with Apple" button
        |
        v
expo-apple-authentication.signInAsync()
  --> Native iOS ASAuthorizationController dialog
  --> User authenticates with Face ID / Touch ID / password
  --> Returns AppleAuthenticationCredential { identityToken, fullName, email }
        |
        v
supabase.auth.signInWithIdToken({
  provider: 'apple',
  token: credential.identityToken,
})
  --> Supabase verifies token against Apple's public keys
  --> Creates or links user in auth.users
  --> Returns session (access_token + refresh_token)
        |
        v
Existing auth-context.tsx onAuthStateChange fires
  --> Session stored via expo-sqlite localStorage
  --> isNewUser check runs against users table
  --> App navigates accordingly
```

**Key point:** The existing `AuthProvider` in `lib/auth-context.tsx` and the Supabase client in `lib/supabase.ts` require no structural changes. The `onAuthStateChange` listener already handles new sessions regardless of provider.

## What NOT to Add

### DO NOT add: @invertase/react-native-apple-authentication

**Why not:** This is the bare React Native alternative. `expo-apple-authentication` is the first-party Expo package. Using `@invertase` in a managed Expo workflow adds unnecessary complexity, requires manual native module linking, and may conflict with Expo's config plugin system. The Supabase social auth quickstart shows `@invertase` for bare RN projects, but their Apple auth guide correctly shows `expo-apple-authentication` for Expo projects.

### DO NOT add: expo-auth-session / expo-web-browser (for Apple OAuth)

**Why not:** These would be needed for the OAuth-based web redirect flow. The native `signInWithIdToken()` approach is strictly better for iOS:
- No browser popup (native dialog instead)
- No 6-month secret key rotation
- No Services ID configuration
- Better UX (Face ID / Touch ID integration)
- Required by Apple for native iOS apps anyway

### DO NOT add: react-native-keychain or expo-secure-store (for token storage)

**Why not:** The existing `expo-sqlite/localStorage` polyfill already handles session persistence via the Supabase client's `storage: localStorage` config. Adding a second storage mechanism for tokens creates confusion. Supabase manages token refresh internally.

### DO NOT add: jwt-decode or jose (for token verification)

**Why not:** Token verification happens server-side in Supabase Auth. The client passes the raw `identityToken` to `signInWithIdToken()` and Supabase handles verification against Apple's JWKS endpoint. Client-side token inspection is unnecessary.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Apple Auth Library | `expo-apple-authentication` | `@invertase/react-native-apple-authentication` | Not needed for Expo managed workflow; adds native linking complexity |
| Auth Flow | Native `signInWithIdToken` | OAuth via `signInWithOAuth` | OAuth requires browser popup, 6-month key rotation, worse UX |
| Nonce Generation | `expo-crypto` | `uuid` + manual SHA-256 | `expo-crypto` is already Expo-native, provides both generation and hashing |
| Session Storage | Existing `expo-sqlite/localStorage` | `expo-secure-store` | Already working; changing storage would invalidate existing sessions |

## Installation Summary

```bash
# Required
npx expo install expo-apple-authentication

# Recommended (for nonce security)
npx expo install expo-crypto
```

Total new dependencies: 1 required + 1 recommended = 2 packages.

## Version Compatibility Matrix

| Package | Version | Expo SDK 54 | React Native 0.81 | Verified |
|---------|---------|-------------|-------------------|----------|
| `expo-apple-authentication` | ~8.0.8 | Yes | Yes | npm registry |
| `expo-crypto` | ~15.0.8 | Yes | Yes | npm registry |
| `@supabase/supabase-js` | ^2.96.0 (existing) | N/A | N/A | Already installed |

## Sources

- [Expo AppleAuthentication SDK Docs](https://docs.expo.dev/versions/latest/sdk/apple-authentication/) -- API reference, config plugin setup, platform support
- [Expo Crypto SDK Docs](https://docs.expo.dev/versions/latest/sdk/crypto/) -- API reference for nonce generation
- [Supabase: Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple) -- Dashboard config, native vs OAuth, signInWithIdToken examples
- [Supabase: signInWithIdToken Reference](https://supabase.com/docs/reference/javascript/auth-signinwithidtoken) -- Method signature, parameters
- [Supabase: Native Mobile Auth Announcement](https://supabase.com/blog/native-mobile-auth) -- Native ID token flow rationale
- [Expo SDK 54 Branch: expo-apple-authentication](https://github.com/expo/expo/tree/sdk-54/packages/expo-apple-authentication) -- Source code verification
- [expo-apple-authentication on npm](https://www.npmjs.com/package/expo-apple-authentication) -- Version history, publish dates
- [Expo iOS Capabilities](https://docs.expo.dev/build-reference/ios-capabilities/) -- EAS Build entitlement handling
