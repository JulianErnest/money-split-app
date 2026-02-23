# Phase 16: PostHog Analytics Integration - Research

**Researched:** 2026-02-24
**Domain:** PostHog product analytics in Expo Router / React Native
**Confidence:** HIGH

## Summary

PostHog analytics integration for this Expo Router app is straightforward because the SDK and all peer dependencies are already installed (`posthog-react-native@4.36.0` is in package.json). Zero new packages need to be added. The project already has `expo-file-system`, `expo-application`, `expo-device`, and `expo-localization` which PostHog requires as optional peer dependencies for the Expo managed workflow.

The single most critical architectural decision is to **disable PostHog's built-in autocapture entirely** (both `captureScreens` and `captureTouches`). This is a hard requirement, not a preference. PostHog's screen autocapture uses `useNavigationState` from React Navigation, which crashes with Expo Router because Expo Router does not expose its `NavigationContainer`. Touch autocapture also fails (null `_targetInst`). Instead, manual screen tracking via Expo Router's `usePathname()` hook is the standard, documented approach. The implementation creates a standalone PostHog client instance in `lib/analytics.ts` (passed to `PostHogProvider` via `client` prop), adds a renderless `AnalyticsTracker` component for screen views and user identification, and instruments 9 core events across 6 screen files. Total scope is ~200 lines of code across 8 files (1 new, 7 modified).

Extensive project-level research already exists in `.planning/research/` (STACK.md, ARCHITECTURE.md, PITFALLS.md, FEATURES.md, SUMMARY.md) covering the full domain. This phase-level research synthesizes those findings into actionable guidance for the planner.

**Primary recommendation:** Create `lib/analytics.ts` with standalone PostHog client and typed event helpers, wrap app with `PostHogProvider` (autocapture disabled), add renderless `AnalyticsTracker` for screen tracking and identity management, then wire 9 capture calls into existing screen components.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `posthog-react-native` | 4.36.0 (installed) | PostHog SDK for React Native | Official PostHog SDK; already in package.json; latest version as of 2026-02-24 |
| `expo-router` | 6.0.23 (installed) | Screen tracking via `usePathname()` | Already used for routing; `usePathname()` hook provides reactive URL for manual screen tracking |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-file-system` | 19.0.21 | PostHog event queue persistence | Automatically used by PostHog SDK for storing queued events and anonymous ID |
| `expo-application` | 7.0.8 | App version/build auto-properties | Automatically used by PostHog to attach `$app_version`, `$app_build` to events |
| `expo-device` | 8.0.10 | Device info auto-properties | Automatically used by PostHog to attach `$device_name`, `$os_name`, `$os_version` |
| `expo-localization` | 17.0.8 | Locale/timezone auto-properties | Automatically used by PostHog to attach locale and timezone to events |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `posthog-react-native` | Mixpanel, Amplitude | PostHog is open-source, generous free tier (1M events/mo), consolidates analytics + future feature flags |
| Manual screen tracking | Autocapture `captureScreens: true` | Autocapture crashes with Expo Router (GitHub #2740, closed "not planned") |
| Standalone client + `PostHogProvider` | Provider-managed client only | Standalone allows non-React code (event helpers, callbacks) to access PostHog |
| `expo-file-system` persistence | `@react-native-async-storage/async-storage` | expo-file-system already installed; adding async-storage is redundant |

**Installation:**
```bash
# Nothing to install -- posthog-react-native@4.36.0 and all peer dependencies already present
# Verify with:
npm ls posthog-react-native
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
  analytics.ts             # NEW - PostHog client init, typed event helpers, screen name mapper

app/
  _layout.tsx              # MODIFY - Add PostHogProvider wrapper + AnalyticsTracker component
  (auth)/sign-in.tsx       # MODIFY - Add trackSignIn() call
  (auth)/profile-setup.tsx # MODIFY - Add trackProfileCompleted() call
  (tabs)/index.tsx         # MODIFY - Add trackGroupCreated(), trackInviteAccepted(), trackInviteDeclined()
  (tabs)/profile.tsx       # MODIFY - Add posthog.reset() before sign-out
  group/[id].tsx           # MODIFY - Add trackInviteShared() call
  group/[id]/add-expense.tsx # MODIFY - Add trackExpenseAdded() call
  join/[code].tsx          # MODIFY - Add trackGroupJoinedViaLink() call

components/
  settlements/SettleConfirmSheet.tsx  # MODIFY - Add trackSettleUp() call
```

### Pattern 1: Standalone PostHog Client Instance
**What:** Create `new PostHog(apiKey, options)` in `lib/analytics.ts`, export it, and pass to `PostHogProvider` via the `client` prop.
**When to use:** Always. This is the pattern documented in the PostHog SDK's own type definitions (PostHogProvider.d.ts lines 67-80).
**Why:** Event tracking helpers need PostHog access outside React components (in event handlers, callbacks). A standalone instance can be imported anywhere. The `usePostHog()` hook still works inside components via the Provider.
**Example:**
```typescript
// Source: node_modules/posthog-react-native/dist/PostHogProvider.d.ts lines 67-80
// lib/analytics.ts
import PostHog from 'posthog-react-native';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY!;

export const posthogClient = new PostHog(POSTHOG_API_KEY, {
  host: 'https://us.i.posthog.com',
  debug: __DEV__,
});
```

### Pattern 2: PostHogProvider with Disabled Autocapture
**What:** Wrap the app tree with `PostHogProvider` using `client` prop and `autocapture={false}`.
**When to use:** In `app/_layout.tsx`, outermost data provider (inside `GestureHandlerRootView`, outside `AuthProvider`).
**Why:** PostHogProvider must be outside AuthProvider so analytics captures auth events. Autocapture MUST be disabled because `captureScreens` crashes with Expo Router and `captureTouches` produces null element data.
**Example:**
```typescript
// Source: node_modules/posthog-react-native/dist/types.d.ts lines 37-41
// app/_layout.tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  <PostHogProvider client={posthogClient} autocapture={false}>
    <AuthProvider>
      {/* ... rest of providers ... */}
    </AuthProvider>
  </PostHogProvider>
</GestureHandlerRootView>
```

### Pattern 3: Renderless AnalyticsTracker Component
**What:** A component that returns `null`, placed inside the provider tree, responsible for screen tracking and user identification.
**When to use:** In `app/_layout.tsx`, inside both PostHogProvider and AuthProvider so it has access to both `usePostHog()` and `useAuth()`.
**Why:** Mirrors the existing `SyncWatcher` pattern in the codebase. Needs access to Expo Router's `usePathname()`, auth state from `useAuth()`, and PostHog from `usePostHog()`.
**Example:**
```typescript
// Source: Expo Router docs https://docs.expo.dev/router/reference/screen-tracking/
function AnalyticsTracker() {
  const pathname = usePathname();
  const posthog = usePostHog();
  const { session, isNewUser } = useAuth();

  // Screen tracking
  useEffect(() => {
    if (posthog && pathname) {
      const screenName = normalizePathname(pathname);
      posthog.screen(screenName);
    }
  }, [pathname]);

  // User identification
  useEffect(() => {
    if (!posthog || !session?.user) return;
    if (!isNewUser) {
      posthog.identify(session.user.id, {
        $set: { display_name: /* from user data */ },
        $set_once: { signup_method: 'apple', first_sign_in_date: new Date().toISOString() },
      });
    }
  }, [session, isNewUser]);

  // Reset on sign-out
  useEffect(() => {
    if (!posthog) return;
    if (!session) {
      posthog.reset();
    }
  }, [session]);

  return null;
}
```

### Pattern 4: Typed Event Tracking Helpers
**What:** Export named functions from `lib/analytics.ts` for each tracked event. Components call these instead of `posthog.capture()` directly.
**When to use:** For all 9 core events.
**Why:** Type safety on event names and properties, single source of truth for event catalog, easy to refactor if analytics provider changes.
**Example:**
```typescript
// lib/analytics.ts
export function trackSignIn(method: 'apple') {
  posthogClient.capture('sign_in', { method });
}

export function trackExpenseAdded(data: {
  groupId: string;
  amount: number;
  splitType: 'equal' | 'custom';
  memberCount: number;
}) {
  posthogClient.capture('expense_added', {
    group_id: data.groupId,
    amount: data.amount,
    split_type: data.splitType,
    member_count: data.memberCount,
  });
}
```

### Pattern 5: Dynamic Route Normalization
**What:** Replace dynamic segments in pathnames with template names before sending to PostHog.
**When to use:** In the `normalizePathname()` function called by AnalyticsTracker before every `posthog.screen()` call.
**Why:** Without normalization, `/group/abc123` creates separate screen entries for every group. Normalized to `/group/[id]`, all group detail views aggregate under one screen name.
**Example:**
```typescript
// lib/analytics.ts
export function normalizePathname(pathname: string): string {
  return pathname
    .replace(/\/group\/[^/]+/, '/group/[id]')
    .replace(/\/expense\/[^/]+/, '/expense/[expenseId]')
    .replace(/\/balance\/[^/]+/, '/balance/[memberId]')
    .replace(/\/join\/[^/]+/, '/join/[code]');
}
```

### Provider Hierarchy (Final)
```
GestureHandlerRootView
  PostHogProvider (NEW - client={posthogClient}, autocapture={false})
    AuthProvider
      NetworkProvider
        ToastProvider
          BottomSheetModalProvider
            AnalyticsTracker (NEW - renderless, screen tracking + identify/reset)
            SyncWatcher (existing)
            RootNavigator (existing)
            OfflineBanner (existing)
            StatusBar (existing)
```

### Anti-Patterns to Avoid
- **Enabling `captureScreens: true`:** Crashes immediately with Expo Router. Always disable.
- **Enabling `captureTouches: true`:** Captures empty element data with Expo Router. Disable. Use explicit `posthog.capture()` calls instead.
- **Calling `identify()` before auth state resolves:** Passing `undefined` or `null` as distinct_id corrupts person records irreversibly.
- **Placing PostHogProvider inside AuthProvider:** Auth events (sign-in) would not be captured because PostHog is not yet initialized.
- **Using string literals for event names:** Creates naming inconsistencies. Always import from typed helpers in `lib/analytics.ts`.
- **Passing resolved pathnames to `posthog.screen()`:** Creates thousands of "screens" in PostHog (one per group/expense/member ID).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event queuing/batching | Custom queue with expo-file-system | PostHog SDK built-in queue (flushAt=20, flushInterval=30s, maxQueueSize=1000) | SDK handles batching, retry (3 retries, 3s delay), persistence, and offline recovery |
| Anonymous-to-identified user merge | Custom merge logic | PostHog automatic person merge on `identify()` | PostHog retroactively attributes all anonymous events to the identified person |
| Device/app property collection | Manual collection from Expo APIs | PostHog auto-properties via expo-application, expo-device, expo-localization | SDK automatically attaches $app_version, $device_name, $os_name, etc. to every event |
| Screen name normalization | Complex route parser | Simple regex replacement in `normalizePathname()` | The app has only 4 dynamic route patterns to replace |
| Analytics opt-out toggle | Custom state management | PostHog `optOut()` / `optIn()` methods | SDK handles suppressing all events when opted out, persists opt-out state |

**Key insight:** PostHog's React Native SDK handles all the hard parts (queuing, persistence, batching, retry, device properties, person merge). The implementation is purely wiring -- connecting existing app events to PostHog capture calls.

## Common Pitfalls

### Pitfall 1: Autocapture Screen Tracking Crashes with Expo Router
**What goes wrong:** Enabling `captureScreens: true` causes immediate app crash with `"Couldn't get the navigation state. Is your component inside a navigator?"` error.
**Why it happens:** PostHog's autocapture uses `useNavigationState` from React Navigation, which requires being inside a `NavigationContainer`. Expo Router does not expose its `NavigationContainer`.
**How to avoid:** Set `autocapture={false}` (or `autocapture={{ captureScreens: false, captureTouches: false }}`). Use manual `posthog.screen()` with `usePathname()`.
**Warning signs:** White screen on app launch after adding PostHogProvider. `useNavigationState` error in console.
**Confidence:** HIGH -- verified via PostHog GitHub issue #2740 (closed "not planned"), SDK type definitions lines 37-41.

### Pitfall 2: Calling identify() with Null/Undefined Distinct ID
**What goes wrong:** If `identify()` is called before auth state resolves (while `session` is null), the distinct_id is `undefined`. PostHog either skips it or identifies with garbage string `"null"`. Multiple users can get merged into one person record. This is **irreversible**.
**Why it happens:** Auth state loads asynchronously. If the identify useEffect runs before session is populated, distinct_id is undefined.
**How to avoid:** Guard identify behind `session?.user?.id` being truthy AND `isNewUser === false`. The AnalyticsTracker pattern above handles this correctly.
**Warning signs:** PostHog shows fewer persons than expected. One person has impossibly high event count. Distinct ID shows as "null" or "undefined".
**Confidence:** HIGH -- verified via PostHog identify docs, SDK type definitions.

### Pitfall 3: Missing reset() on Sign-Out Leaks Identity
**What goes wrong:** Without `posthog.reset()` on sign-out, the next user on the same device inherits the previous user's distinct_id. Events between sign-out and next sign-in are attributed to the wrong person.
**Why it happens:** PostHog persists distinct_id to expo-file-system storage. It survives app restarts.
**How to avoid:** Call `posthog.reset()` when session becomes null. The AnalyticsTracker handles this via the session useEffect.
**Warning signs:** After sign-out/sign-in cycle, events from User B appear on User A's profile.
**Confidence:** HIGH -- verified via SDK source code (reset clears distinct_id, anonymous_id, super properties).

### Pitfall 4: Screen Names Expose Dynamic Route Parameters
**What goes wrong:** `usePathname()` returns `/group/abc123` not `/group/[id]`. Sending raw pathnames creates thousands of separate "screen" entries in PostHog.
**Why it happens:** `usePathname()` returns the resolved path including dynamic parameter values.
**How to avoid:** Normalize pathnames with regex before calling `posthog.screen()`. Map `/group/abc123` to `/group/[id]`.
**Warning signs:** PostHog screen list shows paths like `/group/uuid-here`. Screen view counts are all 1 or 2.
**Confidence:** HIGH -- verified by examining app route structure.

### Pitfall 5: useEffect Re-render Loop Fires Duplicate Events
**What goes wrong:** `posthog.capture()` inside a `useEffect` with incorrect dependencies fires hundreds of identical events in seconds.
**Why it happens:** Non-memoized objects or functions in dependency array change every render, causing infinite re-fires.
**How to avoid:** For screen tracking, depend only on `pathname` (a string, stable reference). For action events, fire in event handlers, not useEffects. Enable `debug: __DEV__` to see every event in console.
**Warning signs:** PostHog live events shows rapid-fire identical events. Event counts are orders of magnitude higher than user counts.
**Confidence:** HIGH -- documented in real-world PostHog React Native integration blog post.

### Pitfall 6: $set vs $set_once Confusion
**What goes wrong:** Using `$set` for properties that should only be set once (like `signup_method`, `first_sign_in_date`) means they get overwritten on every identify call.
**Why it happens:** Developer does not distinguish between mutable and immutable person properties.
**How to avoid:** Use `$set_once` for immutable first-touch properties. Use `$set` for mutable current-state properties (like `display_name`).
**Warning signs:** `first_sign_in_date` keeps updating to current date on every app open.
**Confidence:** HIGH -- verified via SDK type definitions.

### Pitfall 7: PostHog API Key Hardcoded
**What goes wrong:** API key hardcoded in source file makes it impossible to use different PostHog projects for dev vs production.
**Why it happens:** Developer skips environment variable setup.
**How to avoid:** Use `process.env.EXPO_PUBLIC_POSTHOG_API_KEY` following the same pattern as existing Supabase env vars in `lib/supabase.ts`.
**Warning signs:** Dev events pollute production analytics.
**Confidence:** HIGH -- standard practice, matches existing codebase pattern.

## Code Examples

Verified patterns from official sources and installed SDK type definitions:

### PostHog Client Initialization
```typescript
// Source: node_modules/posthog-react-native/dist/posthog-rn.d.ts line 112
// lib/analytics.ts
import PostHog from 'posthog-react-native';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY!;
const POSTHOG_HOST = 'https://us.i.posthog.com';

export const posthogClient = new PostHog(POSTHOG_API_KEY, {
  host: POSTHOG_HOST,
  debug: __DEV__,
  // personProfiles: 'identified_only', // Optional: reduces cost for anonymous events
});
```

### PostHogProvider Wrapping App Root
```typescript
// Source: node_modules/posthog-react-native/dist/PostHogProvider.d.ts lines 69-79
// app/_layout.tsx
import { PostHogProvider } from 'posthog-react-native';
import { posthogClient } from '@/lib/analytics';

// Inside RootLayout return:
<GestureHandlerRootView style={{ flex: 1 }}>
  <PostHogProvider client={posthogClient} autocapture={false}>
    <AuthProvider>
      {/* existing providers */}
    </AuthProvider>
  </PostHogProvider>
</GestureHandlerRootView>
```

### Screen Tracking with usePathname
```typescript
// Source: https://docs.expo.dev/router/reference/screen-tracking/
// Inside AnalyticsTracker component
import { usePathname } from 'expo-router';
import { usePostHog } from 'posthog-react-native';

const pathname = usePathname();
const posthog = usePostHog();

useEffect(() => {
  if (posthog && pathname) {
    posthog.screen(normalizePathname(pathname));
  }
}, [pathname]);
```

### User Identification with Supabase Auth
```typescript
// Source: node_modules/posthog-react-native/dist/posthog-rn.d.ts line 633
posthog.identify(session.user.id, {
  $set: { display_name: displayName },
  $set_once: {
    signup_method: 'apple',
    first_sign_in_date: new Date().toISOString(),
  },
});
```

### Reset on Sign-Out
```typescript
// Source: node_modules/posthog-react-native/dist/posthog-rn.d.ts line 206
posthog.reset(); // Clears distinct_id, anonymous_id, super properties, feature flags
```

### Event Capture with Properties
```typescript
// Source: inherited from @posthog/core
posthogClient.capture('expense_added', {
  group_id: groupId,
  amount: centavos / 100,
  split_type: splitType,
  member_count: selectedMemberIds.length,
});
```

### Environment Variable Pattern (Matches Existing Codebase)
```typescript
// Source: lib/supabase.ts (existing pattern in codebase)
// The app already uses process.env.EXPO_PUBLIC_* for Supabase:
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
// PostHog follows the same pattern:
const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY!;
```

## Exact Event Insertion Points

Verified by reading the actual source code of each file:

| Event | File | Insertion Point | After What Succeeds |
|-------|------|----------------|---------------------|
| `sign_in` | `app/(auth)/sign-in.tsx` | In `handleSignIn()`, after `signInWithIdToken` succeeds (line ~87) and before fullName update | Supabase auth returns no error |
| `profile_completed` | `app/(auth)/profile-setup.tsx` | In `handleSubmit()`, after `refreshProfile()` succeeds (line ~121) | Profile upsert + invite linking succeed |
| `group_created` | `app/(tabs)/index.tsx` | In `handleCreateGroup()`, after `supabase.rpc("create_group")` succeeds (line ~512) | create_group RPC returns no error |
| `expense_added` | `app/group/[id]/add-expense.tsx` | In `handleSubmit()`, after `supabase.rpc("create_expense")` succeeds (line ~229) and before `router.back()` | create_expense RPC returns no error |
| `settle_up` | `components/settlements/SettleConfirmSheet.tsx` | In `handleConfirmSettle()`, after `record_settlement` RPC succeeds (line ~65) | record_settlement RPC returns no error |
| `invite_accepted` | `app/(tabs)/index.tsx` | In `handleAcceptInvite()`, after `accept_invite` RPC succeeds (line ~399) | accept_invite RPC returns groupId |
| `invite_declined` | `app/(tabs)/index.tsx` | In `handleDeclineInvite()`, after `decline_invite` RPC succeeds (line ~447) | decline_invite RPC returns no error |
| `group_joined_via_link` | `app/join/[code].tsx` | In `joinGroup()`, after `join_group_by_invite` RPC succeeds and group info fetched (line ~133) | join_group_by_invite RPC returns data |
| `invite_shared` | `app/group/[id].tsx` | In `handleShare()`, after `Share.share()` is called (line ~293). Note: cannot determine if share was completed | Share sheet presented (fire on intent, not delivery) |

## Event Naming Convention

All events use **snake_case** following PostHog convention. Event names and their properties:

| Event Name | Properties | Type Signature |
|------------|------------|----------------|
| `sign_in` | `{ method: 'apple' }` | `trackSignIn(method: 'apple')` |
| `profile_completed` | `{ has_avatar: boolean }` | `trackProfileCompleted(hasAvatar: boolean)` |
| `group_created` | `{ group_id: string }` | `trackGroupCreated(groupId: string)` |
| `expense_added` | `{ group_id: string, amount: number, split_type: 'equal' \| 'custom', member_count: number }` | `trackExpenseAdded(data)` |
| `settle_up` | `{ group_id: string, amount: number }` | `trackSettleUp(data)` |
| `invite_accepted` | `{ group_id: string }` | `trackInviteAccepted(groupId: string)` |
| `invite_declined` | `{ group_id: string }` | `trackInviteDeclined(groupId: string)` |
| `group_joined_via_link` | `{ group_id: string }` | `trackGroupJoinedViaLink(groupId: string)` |
| `invite_shared` | `{ group_id: string }` | `trackInviteShared(groupId: string)` |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `captureScreens: true` with React Navigation | Manual `posthog.screen()` with `usePathname()` | PostHog v4.1.4-4.2.0 (docs updated) | Must disable autocapture for Expo Router |
| `@react-native-async-storage` for persistence | `expo-file-system` (legacy + new API) | PostHog v4.4.1 | Fixed Expo SDK 54 compatibility |
| `navigationRef` prop for screen tracking | Deprecated; use manual screen capture | PostHog v4.x | `navigationRef` prop marked @deprecated in types |

**Deprecated/outdated:**
- `PostHogAutocaptureOptions.navigationRef`: Marked `@deprecated` in SDK types. Do not use.
- `captureScreens: true` with Expo Router: Crashes. Closed as "not planned" by PostHog team (issue #2740).
- `@react-native-async-storage/async-storage` for PostHog storage: Not needed when `expo-file-system` is installed.

## IDENT-03: Reset Placement Decision

The requirements state `posthog.reset()` should be called on sign-out "to clear identity before `supabase.auth.signOut()`". There are two valid patterns:

**Option A (Requirements specify):** Call `reset()` explicitly in the sign-out handler in `profile.tsx`, BEFORE `supabase.auth.signOut()`.

**Option B (AnalyticsTracker watches session):** Let AnalyticsTracker detect `session` becoming null and call `reset()` reactively.

**Recommendation:** Use Option A for the explicit reset (it fires synchronously before sign-out) AND keep the AnalyticsTracker session watcher as a safety net. This ensures reset happens even if the user is signed out by other means (token expiry, etc.).

## Open Questions

Things that could not be fully resolved:

1. **PostHog project API key and host must be obtained by the developer**
   - What we know: Requires a PostHog account and project
   - What's unclear: Whether the developer already has a PostHog project
   - Recommendation: The first task should create the PostHog project and add `EXPO_PUBLIC_POSTHOG_API_KEY` to `.env`. This is a manual step that cannot be automated.

2. **Exact `group_id` availability at group creation**
   - What we know: `create_group` RPC returns a result, but the exact return type needs verification
   - What's unclear: Whether the RPC returns the new group ID or just success/error
   - Recommendation: Check the `create_group` RPC return value during implementation. If it does not return group_id, either query for it or omit the property.

3. **SettleConfirmSheet is a component, not a screen**
   - What we know: `settle_up` event needs to fire inside `SettleConfirmSheet` which is in `components/`, not `app/`
   - What's unclear: Whether to import posthogClient directly or use usePostHog hook
   - Recommendation: Since SettleConfirmSheet is a React component inside the PostHogProvider tree, it can use `usePostHog()` hook. Alternatively, import `posthogClient` directly from `lib/analytics.ts` for consistency with the typed helper pattern.

## Sources

### Primary (HIGH confidence)
- `node_modules/posthog-react-native/dist/posthog-rn.d.ts` -- PostHog class constructor (line 112), identify (line 633), reset (line 206), screen (line 534)
- `node_modules/posthog-react-native/dist/PostHogProvider.d.ts` -- PostHogProviderProps interface (line 10-25), client prop pattern (lines 67-80)
- `node_modules/posthog-react-native/dist/types.d.ts` -- PostHogAutocaptureOptions (lines 13-60), captureScreens Expo Router docs (lines 37-41)
- `node_modules/posthog-react-native/dist/native-deps.js` -- Storage resolution order (expo-file-system/legacy -> expo-file-system -> async-storage)
- [PostHog GitHub Issue #2740](https://github.com/PostHog/posthog-js/issues/2740) -- Expo Router autocapture crash, closed "not planned"
- [Expo Router Screen Tracking Docs](https://docs.expo.dev/router/reference/screen-tracking/) -- usePathname() + useEffect pattern
- `.planning/research/STACK.md` -- Project-level stack research (verified SDK versions, peer dependencies)
- `.planning/research/ARCHITECTURE.md` -- Project-level architecture patterns (provider hierarchy, data flow)
- `.planning/research/PITFALLS.md` -- Project-level pitfalls catalog (14 pitfalls documented)
- `.planning/research/FEATURES.md` -- Project-level feature research (event catalog, anti-features)

### Secondary (MEDIUM confidence)
- [PostHog React Native SDK Docs](https://posthog.com/docs/libraries/react-native) -- Official installation and configuration guide
- [PostHog Identifying Users Docs](https://posthog.com/docs/product-analytics/identify) -- identify(), $set, $set_once patterns
- [PostHog Event Naming Best Practices](https://posthog.com/docs/product-analytics/best-practices) -- snake_case convention

### Tertiary (LOW confidence)
- None -- all findings verified against installed source code or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed and version-verified against installed node_modules
- Architecture: HIGH -- patterns verified against SDK type definitions and existing codebase structure
- Pitfalls: HIGH -- all critical pitfalls verified via GitHub issues, SDK source, and official documentation
- Event insertion points: HIGH -- verified by reading actual source code of each file to be modified

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable domain, PostHog SDK is mature)
