# Technology Stack: PostHog Analytics Integration

**Project:** KKB (HatianApp) -- PostHog product analytics
**Researched:** 2026-02-24
**Overall confidence:** HIGH

## Current Stack (No Changes Needed)

These are already installed and require zero modifications for PostHog analytics:

| Technology | Installed Version | Role in PostHog Integration |
|------------|-------------------|----------------------------|
| `posthog-react-native` | ^4.36.0 (installed) | Core SDK -- already in package.json |
| `expo-file-system` | ~19.0.21 | Persistent storage for PostHog event queue and anonymous ID |
| `expo-application` | ~7.0.8 | App name, version, build number auto-captured as event properties |
| `expo-device` | ~8.0.10 | Device manufacturer, model, OS version auto-captured |
| `expo-localization` | ~17.0.8 | Locale and timezone auto-captured |
| `@react-navigation/native` | ^7.1.28 | Peer dependency satisfied (but NOT used for autocapture -- see Pitfalls) |
| `expo-router` | ~6.0.23 | Manual screen tracking via `usePathname()` hook |
| `@supabase/supabase-js` | ^2.96.0 | Source of user ID for PostHog `identify()` |
| TypeScript | ~5.9.2 | Full type definitions included in `posthog-react-native` |

**Key insight:** Every dependency PostHog needs for Expo managed workflow is already installed. The `posthog-react-native@4.36.0` package is already in `package.json`. No new packages need to be added.

## Verified: posthog-react-native Already Installed

The project already has `posthog-react-native@4.36.0` installed (confirmed via `npm ls`). This is the latest version as of 2026-02-24 (published 2 days ago per npm registry).

**All peer dependencies are satisfied by existing packages:**

| Peer Dependency | Required | Installed Version | Status |
|-----------------|----------|-------------------|--------|
| `expo-file-system` | >= 13.0.0 | 19.0.21 | Satisfied |
| `expo-application` | >= 4.0.0 | 7.0.8 | Satisfied |
| `expo-device` | >= 4.0.0 | 8.0.10 | Satisfied |
| `expo-localization` | >= 11.0.0 | 17.0.8 | Satisfied |
| `@react-navigation/native` | >= 5.0.0 | 7.1.28 | Satisfied |
| `react-native-safe-area-context` | >= 4.0.0 | ~5.6.0 | Satisfied |
| `@react-native-async-storage/async-storage` | >= 1.0.0 | Not installed | Not needed (expo-file-system used instead) |
| `react-native-device-info` | >= 10.0.0 | Not installed | Not needed (expo-device used instead) |
| `react-native-localize` | >= 3.0.0 | Not installed | Not needed (expo-localization used instead) |
| `posthog-react-native-session-replay` | >= 1.3.0 | Not installed | Not needed (session replay out of scope) |
| `react-native-svg` | >= 15.0.0 | Not installed | Not needed (only for surveys UI) |

All peer dependencies are marked optional. The Expo-specific ones (`expo-file-system`, `expo-application`, `expo-device`, `expo-localization`) are the correct set for Expo managed workflow and are all already present.

**Confidence:** HIGH -- verified by reading `node_modules/posthog-react-native/dist/native-deps.js` source code. The storage resolution order is: (1) `expo-file-system/legacy`, (2) `expo-file-system` new File API, (3) `@react-native-async-storage/async-storage`. Since `expo-file-system@19.0.21` is installed, storage will work without async-storage.

## Expo SDK 54 Compatibility: RESOLVED

**Historical issue:** When Expo SDK 54 shipped (upgrading `expo-file-system` to v19.0.0+), the old `readAsStringAsync`/`writeAsStringAsync` APIs were moved to `expo-file-system/legacy`, breaking PostHog (GitHub issue [PostHog/posthog-js#2229](https://github.com/PostHog/posthog-js/issues/2229)).

**Resolution:** Fixed in `posthog-react-native@4.4.1+` via [PR #2234](https://github.com/PostHog/posthog-js/issues/2229). The SDK now:
1. Tries `expo-file-system/legacy` first (the `readAsStringAsync`/`writeAsStringAsync` API)
2. Falls back to `expo-file-system` new API (using `File` class and `Paths.document`)
3. Falls back to `@react-native-async-storage/async-storage`

Since the project uses `posthog-react-native@4.36.0` (well past 4.4.1), this is fully resolved.

**Confidence:** HIGH -- verified by reading the actual `native-deps.js` source code in the installed package. The `buildOptimisiticAsyncStorage()` function contains both legacy and new `expo-file-system` code paths.

## No app.json Changes Needed

Unlike `expo-apple-authentication`, PostHog does not require:
- No Expo config plugin entry in `plugins[]`
- No iOS entitlements or capabilities
- No Android permissions
- No additional `app.json` configuration

PostHog is pure JavaScript with optional native peer dependencies (all Expo packages already installed). It runs entirely in the JS layer.

## PostHog Account/Project Setup Required

Before writing any code, you need:

1. **PostHog account** at [posthog.com](https://posthog.com) (free tier: 1M events/month)
2. **Project API key** -- found in PostHog dashboard under Project Settings
3. **Instance host** -- `https://us.i.posthog.com` (US cloud) or `https://eu.i.posthog.com` (EU cloud)

These two values (`apiKey` and `host`) are the only configuration needed to initialize the SDK.

## Core API Surface (from installed type definitions)

The `posthog-react-native@4.36.0` SDK provides these APIs relevant to the analytics scope:

### PostHogProvider (React Context)

```typescript
interface PostHogProviderProps {
  children: React.ReactNode;
  apiKey?: string;
  options?: PostHogOptions;
  client?: PostHog;           // Alternative: pass pre-initialized instance
  autocapture?: boolean | PostHogAutocaptureOptions;
  debug?: boolean;
  style?: StyleProp<ViewStyle>;
}
```

### usePostHog() Hook

```typescript
const posthog: PostHog = usePostHog();
```

Returns the PostHog client instance with full API access.

### Key Methods for Analytics Scope

```typescript
// Event capture
posthog.capture(eventName: string, properties?: Record<string, any>): void

// Screen view tracking (manual -- required for Expo Router)
posthog.screen(name: string, properties?: Record<string, any>): Promise<void>

// User identification (tie anonymous ID to known user)
posthog.identify(distinctId: string, properties?: Record<string, any>): void

// Set person properties without re-identifying
posthog.setPersonProperties(
  userPropertiesToSet?: Record<string, any>,
  userPropertiesToSetOnce?: Record<string, any>
): void

// Reset on logout (clears distinct ID, anonymous ID, super properties)
posthog.reset(): void

// Super properties (sent with every subsequent event)
posthog.register(properties: Record<string, any>): Promise<void>
posthog.unregister(property: string): Promise<void>

// Manual flush (events batch by default, flush to send immediately)
posthog.flush(): Promise<void>

// Privacy controls
posthog.optIn(): Promise<void>
posthog.optOut(): Promise<void>
```

### PostHogOptions (Relevant Subset)

```typescript
interface PostHogOptions {
  host?: string;                          // PostHog instance URL
  flushAt?: number;                       // Events to batch before flush (default: 20)
  flushInterval?: number;                 // Flush interval in ms (default: 30000)
  persistence?: 'memory' | 'file';        // Storage type (default: 'file')
  captureAppLifecycleEvents?: boolean;    // App installed/opened/backgrounded (default: false)
  enableSessionReplay?: boolean;          // Session replay (default: false, out of scope)
  customAppProperties?: PostHogCustomAppProperties | ((props) => props);
  customStorage?: PostHogCustomStorage;   // Custom storage implementation
  defaultOptIn?: boolean;                 // Whether tracking starts enabled (default: true)
  sendFeatureFlagEvent?: boolean;         // Auto-capture flag evaluations (default: true)
  preloadFeatureFlags?: boolean;          // Load flags on init (default: true)
}
```

## Integration Points with Existing Stack

### PostHog + Supabase Auth

The `identify()` call should use the Supabase `user.id` as the `distinctId`:

```typescript
// When user authenticates via Apple Sign-In
const { data: { user } } = await supabase.auth.getUser();
posthog.identify(user.id, {
  name: user.user_metadata.display_name,
});
```

On logout:
```typescript
await supabase.auth.signOut();
posthog.reset(); // Clears PostHog identity
```

**Key consideration:** Call `identify()` AFTER successful auth, not before. Call `reset()` on sign-out to prevent event leakage between users.

### PostHog + Expo Router (Screen Tracking)

**CRITICAL: Autocapture `captureScreens` does NOT work with Expo Router.** This is documented in the SDK source code (verified in `types.d.ts` line 37-41) and confirmed via GitHub issues [#2740](https://github.com/PostHog/posthog-js/issues/2740) and [#2455](https://github.com/PostHog/posthog-js/issues/2455).

The issue: PostHog's autocapture screen tracking uses `useNavigationState` from `@react-navigation/native`, which throws `"Couldn't get the navigation state"` when the PostHogProvider sits outside the navigator (as it must with Expo Router's file-based routing).

**Solution:** Disable autocapture screen tracking and use Expo Router's `usePathname()` hook for manual screen tracking:

```typescript
// In root _layout.tsx
import { usePathname, useGlobalSearchParams } from 'expo-router';
import { usePostHog } from 'posthog-react-native';

export default function RootLayout() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (posthog) {
      posthog.screen(pathname, { ...params });
    }
  }, [pathname, params]);

  // ... rest of layout
}
```

This pattern is explicitly recommended by:
- PostHog's own SDK type comments (line 37-41 in `types.d.ts`)
- Expo's official [screen tracking guide](https://docs.expo.dev/router/reference/screen-tracking/)
- PostHog's response to GitHub issue #2740

**PostHogProvider autocapture config:**
```typescript
<PostHogProvider
  apiKey={POSTHOG_API_KEY}
  options={{ host: POSTHOG_HOST }}
  autocapture={{
    captureTouches: true,       // Touch event autocapture works fine
    captureScreens: false,      // MUST be false for Expo Router
    captureLifecycleEvents: true, // App lifecycle is fine
  }}
>
```

### PostHog + Existing App Structure

PostHogProvider wraps the app at the root layout level, similar to how other providers (auth context, etc.) are structured. It should be placed high in the component tree but does NOT need to wrap NavigationContainer (since Expo Router manages that internally).

## What NOT to Add

### DO NOT add: posthog-node

**Why not:** `posthog-node` is the server-side SDK for Node.js backends. All analytics in this app are client-side. Server-side event tracking (e.g., from Supabase Edge Functions) is out of scope for v1.4. If needed later, it would run in a Supabase Edge Function, not in the React Native app.

### DO NOT add: posthog-react-native-session-replay

**Why not:** Session replay is explicitly out of scope for v1.4. This package adds native iOS/Android dependencies and requires `posthog-react-native-session-replay >= 1.3.0`. Adding it prematurely increases build times and app size. Can be added in a future milestone if needed.

### DO NOT add: @react-native-async-storage/async-storage

**Why not:** PostHog uses `expo-file-system` (already installed) for persistent storage on iOS/Android. Adding async-storage would be redundant. The storage resolution in `native-deps.js` tries `expo-file-system` first and only falls back to async-storage if file system is unavailable (e.g., web/macOS targets, which KKB does not target).

### DO NOT add: react-native-svg

**Why not:** Only needed for PostHog's in-app surveys UI rendering. Surveys are out of scope for v1.4.

### DO NOT add: posthog-js (web SDK)

**Why not:** `posthog-js` is the web/browser SDK. `posthog-react-native` is the correct SDK for React Native. They are separate packages with different APIs. Do not confuse them.

### DO NOT add: Any analytics abstraction layer (Segment, RudderStack, etc.)

**Why not:** For a solo developer project with 5-10 testers, PostHog direct integration is the simplest path. Analytics abstraction layers add complexity (another SDK, another dashboard, data routing config) without providing value at this scale. PostHog's SDK is lightweight enough to integrate directly.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Analytics SDK | `posthog-react-native` | Mixpanel React Native | PostHog is open-source, generous free tier (1M events/mo), has product analytics + future feature flags in one platform |
| Analytics SDK | `posthog-react-native` | Amplitude React Native | Similar to Mixpanel; PostHog consolidates more tools |
| Analytics SDK | `posthog-react-native` | Firebase Analytics / `expo-insights` | Firebase requires Google account, less granular event analysis, `expo-insights` is basic |
| Storage backend | `expo-file-system` (default) | `@react-native-async-storage/async-storage` | Already have `expo-file-system`; adding async-storage is redundant |
| Screen tracking | Manual via `usePathname()` | Autocapture `captureScreens: true` | Autocapture does NOT work with Expo Router (verified, documented) |
| Provider pattern | `PostHogProvider` (Context) | Direct `new PostHog()` singleton | Provider pattern gives React hooks access (`usePostHog()`), easier to test, consistent with app's existing provider architecture |

## Installation Summary

```bash
# Nothing to install -- posthog-react-native and all peer dependencies already present
# Verify with:
npm ls posthog-react-native
# Should output: posthog-react-native@4.36.0
```

**Total new dependencies: 0 packages.** Everything is already installed.

## Version Compatibility Matrix

| Package | Version | Expo SDK 54 | React Native 0.81 | React 19.1 | Verified Via |
|---------|---------|-------------|-------------------|------------|-------------|
| `posthog-react-native` | 4.36.0 | Yes (fixed in 4.4.1+) | Yes | Yes | npm registry, installed source code |
| `expo-file-system` | 19.0.21 | Yes (SDK 54 native) | Yes | Yes | Already installed, working |
| `expo-application` | 7.0.8 | Yes (SDK 54 native) | Yes | Yes | Already installed, working |
| `expo-device` | 8.0.10 | Yes (SDK 54 native) | Yes | Yes | Already installed, working |
| `expo-localization` | 17.0.8 | Yes (SDK 54 native) | Yes | Yes | Already installed, working |

## Environment Variables / Configuration

Two values needed (store in your preferred config approach):

| Value | Where to Get It | Example |
|-------|-----------------|---------|
| PostHog API Key | PostHog Dashboard > Project Settings > Project API Key | `phc_abc123...` |
| PostHog Host | PostHog Dashboard (or use default) | `https://us.i.posthog.com` |

**Recommendation:** Store these in environment variables or a config file that is NOT committed to git. For Expo, use `app.config.js` with `process.env` or a `.env` file with `expo-constants`.

The project already uses `expo-constants` (installed), so the pattern would be:
```typescript
import Constants from 'expo-constants';
const POSTHOG_API_KEY = Constants.expoConfig?.extra?.posthogApiKey;
const POSTHOG_HOST = Constants.expoConfig?.extra?.posthogHost;
```

## Sources

- [posthog-react-native on npm](https://www.npmjs.com/package/posthog-react-native) -- version 4.36.0, publish date, peer dependencies
- [PostHog React Native SDK Docs](https://posthog.com/docs/libraries/react-native) -- official installation and configuration guide
- [PostHog/posthog-js#2229](https://github.com/PostHog/posthog-js/issues/2229) -- Expo SDK 54 `expo-file-system` compatibility issue and resolution (fixed in v4.4.1+)
- [PostHog/posthog-js#2740](https://github.com/PostHog/posthog-js/issues/2740) -- Expo Router `autocapture.captureScreens` incompatibility (closed as "not planned"; manual tracking recommended)
- [PostHog/posthog-js#2455](https://github.com/PostHog/posthog-js/issues/2455) -- React Navigation v7 `useNavigationState` error (closed; manual tracking recommended)
- [Expo Router Screen Tracking Guide](https://docs.expo.dev/router/reference/screen-tracking/) -- official `usePathname()` pattern for analytics
- [PostHog React Native Tutorial](https://posthog.com/tutorials/react-native-analytics) -- Expo setup walkthrough
- [PostHog GitHub install snippet](https://github.com/PostHog/posthog.com/blob/master/contents/docs/integrate/_snippets/install-react-native.mdx) -- official Expo install command
- Installed source code: `node_modules/posthog-react-native/dist/` -- type definitions (`posthog-rn.d.ts`, `types.d.ts`, `PostHogProvider.d.ts`) and runtime code (`native-deps.js`) verified directly

---
*Stack research for: PostHog Analytics in Expo/React Native*
*Researched: 2026-02-24*
