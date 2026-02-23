# Architecture Research

**Domain:** PostHog analytics integration in Expo Router app
**Researched:** 2026-02-24
**Confidence:** HIGH

Confidence is HIGH because all findings are based on the installed SDK source code (posthog-react-native v4.36.0 type definitions in node_modules), official PostHog GitHub issue resolutions, and Expo Router official documentation -- not training data or blog posts.

## System Overview

```
+-----------------------------------------------------------+
|  app/_layout.tsx (RootLayout)                             |
|                                                            |
|  GestureHandlerRootView                                   |
|    +-- PostHogProvider  <-- NEW (outermost data provider) |
|    |     client={posthogClient}                            |
|    |     autocapture={{ captureTouches, !captureScreens }} |
|    |                                                       |
|    +-- AuthProvider  (existing)                            |
|    |     session, user, isLoading, isNewUser               |
|    |                                                       |
|    +-- NetworkProvider  (existing)                         |
|    |                                                       |
|    +-- ToastProvider  (existing)                           |
|    |                                                       |
|    +-- BottomSheetModalProvider  (existing)                |
|    |                                                       |
|    +-- AnalyticsTracker  <-- NEW (screen + identify)      |
|    |     usePathname() -> posthog.screen()                 |
|    |     useAuth() -> posthog.identify() / reset()         |
|    |                                                       |
|    +-- SyncWatcher  (existing)                             |
|    +-- RootNavigator  (existing)                           |
|    +-- OfflineBanner  (existing)                           |
|    +-- StatusBar  (existing)                               |
+-----------------------------------------------------------+

Event Flow:
  User taps "Add Expense" button
    -> Screen component calls analytics.trackExpenseCreated(data)
    -> analytics helper calls posthogClient.capture('expense_created', {...})
    -> PostHog SDK queues event internally (flushAt=20 default)
    -> SDK flushes batch to PostHog cloud (us.i.posthog.com)

Identification Flow:
  Supabase auth state changes (onAuthStateChange)
    -> AuthProvider updates session/user state
    -> AnalyticsTracker detects auth change via useAuth()
    -> If signed in + profile complete: posthog.identify(user.id, {name, ...})
    -> If signed out: posthog.reset()
```

## Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `PostHogProvider` | Initialize PostHog SDK, provide client context, enable touch autocapture | Wraps app tree in `app/_layout.tsx`, configured with `client` prop |
| `AnalyticsTracker` | Auto-track screen views on route change, identify/reset user on auth change | Renderless component using `usePathname()`, `useAuth()`, `usePostHog()` |
| `lib/analytics.ts` | PostHog client instance, typed event capture helpers | Exports typed functions like `trackExpenseCreated()` that call `posthogClient.capture()` |
| `usePostHog()` hook | Access PostHog client instance from any component | Provided by `posthog-react-native`, available inside `PostHogProvider` |

## Recommended Project Structure

```
app/
  _layout.tsx              # MODIFY - Add PostHogProvider + AnalyticsTracker

lib/
  analytics.ts             # NEW - PostHog client init + event tracking helpers

(No new context file needed - PostHogProvider handles context.
 Event tracking calls are added to existing screen components
 as the milestone progresses.)
```

### File-by-file breakdown of new code

**`lib/analytics.ts`** -- Central analytics module (~80-100 lines):
- Creates a pre-configured PostHog instance via `new PostHog(apiKey, options)`
- Exports the instance as `posthogClient` (for the Provider's `client` prop and non-React usage)
- Exports typed event tracking functions (one per tracked event)
- Exports `pathnameToScreenName()` mapping function

**`app/_layout.tsx`** -- Modified root layout (~20 lines of changes):
- Import `PostHogProvider` from `posthog-react-native`
- Import `posthogClient` from `@/lib/analytics`
- Wrap provider tree with `PostHogProvider`
- Add `AnalyticsTracker` renderless component (can be defined inline in this file or extracted)

## Architectural Patterns

### Pattern 1: PostHog Provider Placement

**Where:** `app/_layout.tsx`, wrapping the entire provider tree as the outermost data provider (inside `GestureHandlerRootView` but outside `AuthProvider`).

**Why outermost:** PostHog needs to capture events from the moment the app loads, including auth events. If placed inside `AuthProvider`, the SDK would not be initialized during auth state transitions. The `GestureHandlerRootView` is a pure gesture wrapper and must remain outermost for `react-native-gesture-handler` to work.

**Implementation:**

```tsx
// app/_layout.tsx - RootLayout function (simplified)
import { PostHogProvider } from 'posthog-react-native';
import { posthogClient } from '@/lib/analytics';

export default function RootLayout() {
  // ... existing font loading ...

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PostHogProvider
        client={posthogClient}
        autocapture={{
          captureTouches: true,
          captureScreens: false,  // CRITICAL: must be false for Expo Router
        }}
      >
        <AuthProvider>
          <NetworkProvider>
            <ToastProvider>
              <BottomSheetModalProvider>
                <AnalyticsTracker />
                <SyncWatcher />
                <RootNavigator />
                <OfflineBanner />
                <StatusBar style="light" />
              </BottomSheetModalProvider>
            </ToastProvider>
          </NetworkProvider>
        </AuthProvider>
      </PostHogProvider>
    </GestureHandlerRootView>
  );
}
```

**Critical: `captureScreens: false` is mandatory.** The PostHog SDK's built-in screen tracking does NOT work with Expo Router. This is a confirmed, closed issue (PostHog/posthog-js#2740, closed as "not planned"). The SDK's internal `useNavigationTracker` hook calls `useNavigationState()` which requires being inside a `NavigationContainer` -- but Expo Router does not expose its `NavigationContainer`. Setting `captureScreens: true` causes a runtime crash:

```
Error: Couldn't get the navigation state. Is your component inside a navigator?
```

**Source (HIGH confidence):** SDK type definitions at `node_modules/posthog-react-native/dist/types.d.ts` lines 37-41 explicitly document this:

> "For expo-router, expo-router uses @react-navigation/native, but does not expose the NavigationContainer, you'll need to capture the screens manually and disable this option."

Also confirmed by GitHub issue PostHog/posthog-js#2740.

### Pattern 2: Screen Tracking with Expo Router

**Approach:** Manual screen tracking using Expo Router's `usePathname()` hook, calling `posthog.screen()` on pathname changes. This is the officially recommended pattern per both Expo docs and the PostHog SDK source code comments.

**Implementation -- AnalyticsTracker component:**

```tsx
// Can be defined in app/_layout.tsx or extracted to its own file

import { usePathname, useGlobalSearchParams } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useRef } from 'react';
import { pathnameToScreenName } from '@/lib/analytics';

function AnalyticsTracker() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const posthog = usePostHog();
  const { session, isNewUser } = useAuth();
  const identifiedRef = useRef(false);

  // Screen tracking: fires on every route change
  useEffect(() => {
    if (posthog && pathname) {
      const screenName = pathnameToScreenName(pathname);
      posthog.screen(screenName, {
        path: pathname,
        ...params,
      });
    }
  }, [pathname, params]);

  // User identification: fires on auth state change
  useEffect(() => {
    if (!posthog) return;

    if (session?.user && !isNewUser) {
      posthog.identify(session.user.id, {
        $set: {
          name: session.user.user_metadata?.full_name,
        },
      });
      identifiedRef.current = true;
    } else if (!session && identifiedRef.current) {
      posthog.reset();
      identifiedRef.current = false;
    }
  }, [session, isNewUser]);

  return null;  // Renderless component
}
```

**Screen name mapping:** Expo Router pathnames are URL-like (`/(tabs)`, `/(auth)/sign-in`, `/group/abc123`). These should be mapped to readable screen names for PostHog dashboards:

```tsx
// In lib/analytics.ts
export function pathnameToScreenName(pathname: string): string {
  const routes: Record<string, string> = {
    '/': 'Home',
    '/add': 'Add Tab',
    '/profile': 'Profile',
    '/sign-in': 'Sign In',
    '/profile-setup': 'Profile Setup',
    '/activity': 'Activity',
  };

  if (routes[pathname]) return routes[pathname];

  // Pattern matches for dynamic routes
  if (pathname.startsWith('/group/') && pathname.includes('/expense/'))
    return 'Expense Detail';
  if (pathname.startsWith('/group/') && pathname.includes('/balance/'))
    return 'Balance Detail';
  if (pathname.startsWith('/group/') && pathname.includes('/add-expense'))
    return 'Add Expense';
  if (pathname.startsWith('/group/'))
    return 'Group Detail';
  if (pathname.startsWith('/join/'))
    return 'Join Group';

  return pathname;  // Fallback to raw path
}
```

**Why `usePathname` over `useSegments`:** `usePathname()` returns the full path (e.g., `/group/abc123/add-expense`) which is simpler to work with and maps directly to the mental model of "pages." `useSegments()` returns an array of segments which is more useful for conditional routing logic (already used in `RootNavigator`), not screen naming.

**Source (HIGH confidence):** Expo Router docs at https://docs.expo.dev/router/reference/screen-tracking/ show this exact pattern with `usePathname()` + `useEffect`. The docs explicitly state: "Unlike React Navigation, Expo Router always has access to a URL. This means screen tracking is as easy as the web."

### Pattern 3: User Identification with Supabase

**When to identify:** After the user is fully set up (has session AND has completed profile setup, i.e., `!isNewUser`). NOT during the sign-in flow itself, because:
1. The user may be a first-time Apple Sign-In user who hasn't set up their profile yet
2. We want the PostHog person to have display_name from the start, not be identified with null properties

**Identification flow:**

```
Apple Sign-In
  -> Supabase creates session (user.id available)
  -> AuthProvider sets session, checks isNewUser
  -> If isNewUser=true: DO NOT identify yet (no profile data)
  -> User completes profile-setup (name + phone)
  -> AuthProvider.refreshProfile() called
  -> isNewUser becomes false
  -> AnalyticsTracker detects change via useEffect dependency
  -> posthog.identify(user.id, { $set: { name: displayName } })
```

**Distinct ID choice:** Use `session.user.id` (Supabase UUID) as the PostHog distinct ID. This is the stable, primary identifier in the database and the foreign key for all user data.

**Properties to set on identify:**

```tsx
posthog.identify(session.user.id, {
  $set: {
    name: displayName,          // From users table or user_metadata
  },
  $set_once: {
    initial_sign_in_date: new Date().toISOString(),
  },
});
```

**When to reset:** Call `posthog.reset()` when the user signs out. This clears the distinct ID, anonymous ID, and all super properties. The `AnalyticsTracker` watches for `session` becoming null.

**Anonymous-to-identified merge:** PostHog automatically merges events captured before `identify()` (under an anonymous ID) with the identified person. This means screen views during the sign-in and profile-setup flow are retroactively attributed to the person once identified. No extra code is needed for this -- it is built into PostHog's identification system.

**Updating person properties later:** When the user's group count changes or other properties update, use `posthog.setPersonProperties()` rather than re-calling `identify()`:

```tsx
posthogClient.setPersonProperties({ group_count: newCount });
```

**Source (HIGH confidence):** The `identify()` signature from `node_modules/posthog-react-native/dist/posthog-rn.d.ts` line 633 confirms support for `$set` and `$set_once` in the properties parameter. The `reset()` method on line 206 confirms it clears distinct ID, anonymous ID, and super properties. The `setPersonProperties()` method on lines 730-734 confirms it can update person properties independently.

### Pattern 4: Event Tracking Helpers

**Approach:** Create a typed analytics module (`lib/analytics.ts`) that exports named functions for each tracked event. Components import and call these functions rather than calling `posthog.capture()` directly.

**Why helpers instead of direct capture calls:**
1. **Type safety** -- event names and properties are defined in one place, preventing typos
2. **Refactorability** -- if you switch from PostHog to another provider, change one file
3. **Discoverability** -- `lib/analytics.ts` serves as a catalog of all tracked events
4. **Consistency** -- property names and shapes are standardized

**Implementation sketch:**

```tsx
// lib/analytics.ts
import PostHog from 'posthog-react-native';

export const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY!;
export const POSTHOG_HOST = 'https://us.i.posthog.com';

// Single PostHog instance shared by provider and helpers
export const posthogClient = new PostHog(POSTHOG_API_KEY, {
  host: POSTHOG_HOST,
});

// --- Typed event helpers ---

export function trackSignIn(method: 'apple') {
  posthogClient.capture('sign_in', { method });
}

export function trackProfileCompleted(hasAvatar: boolean) {
  posthogClient.capture('profile_completed', { has_avatar: hasAvatar });
}

export function trackGroupCreated(groupId: string) {
  posthogClient.capture('group_created', { group_id: groupId });
}

export function trackExpenseCreated(data: {
  groupId: string;
  amount: number;
  splitType: 'equal' | 'custom';
  memberCount: number;
}) {
  posthogClient.capture('expense_created', {
    group_id: data.groupId,
    amount: data.amount,
    split_type: data.splitType,
    member_count: data.memberCount,
  });
}

export function trackSettleUp(data: { groupId: string; amount: number }) {
  posthogClient.capture('settle_up', {
    group_id: data.groupId,
    amount: data.amount,
  });
}

export function trackInviteAccepted(groupId: string) {
  posthogClient.capture('invite_accepted', { group_id: groupId });
}

export function trackInviteDeclined(groupId: string) {
  posthogClient.capture('invite_declined', { group_id: groupId });
}

export function trackJoinedViaLink(groupId: string) {
  posthogClient.capture('joined_via_link', { group_id: groupId });
}

// --- Screen name mapping ---
export function pathnameToScreenName(pathname: string): string { ... }
```

### Pattern 5: Standalone Client Instance (not provider-managed)

**Architecture decision:** Create `new PostHog()` in `lib/analytics.ts`, pass to `PostHogProvider` via `client` prop, rather than letting the provider create its own instance.

The `PostHogProvider` supports two initialization modes (from `PostHogProviderProps` in the SDK):
1. `apiKey` + `options` -- provider creates and manages client internally
2. `client` -- you pass a pre-created `PostHog` instance

**Use mode 2 (standalone instance passed to provider).** Reason: event tracking helpers in `lib/analytics.ts` need access to the PostHog client outside of React components (e.g., in API callback functions, in the offline queue sync handler). A standalone instance can be imported anywhere. The provider still gets the instance via the `client` prop for autocapture and `usePostHog()` to work.

```tsx
// app/_layout.tsx
import { PostHogProvider } from 'posthog-react-native';
import { posthogClient } from '@/lib/analytics';

<PostHogProvider client={posthogClient} autocapture={...}>
  {/* app tree */}
</PostHogProvider>
```

This means `posthogClient` is the single source of truth, usable from:
- React components (via `usePostHog()` hook OR direct import)
- Non-React code (via direct import from `@/lib/analytics`)

**Source (HIGH confidence):** `PostHogProviderProps` interface in `node_modules/posthog-react-native/dist/PostHogProvider.d.ts` line 18 shows `client?: PostHog` prop. The JSDoc example on lines 67-80 demonstrates this exact pattern.

## Data Flow

### Event Flow

```
1. User performs action (e.g., taps "Add Expense" -> submits)
2. Screen component calls: trackExpenseCreated({ groupId, amount, ... })
3. analytics.ts function calls: posthogClient.capture('expense_created', props)
4. PostHog SDK internally:
   a. Enriches event with: distinct_id, $session_id, $screen_name,
      device info ($os_name, $device_name, $app_version),
      super properties, timestamp, UUID
   b. Adds to internal queue (in-memory + expo-file-system persistence)
   c. When queue reaches flushAt (default 20) OR flushInterval (default 30s):
      -> Batches events into single POST request
      -> Sends to https://us.i.posthog.com/batch/
   d. On success: events removed from queue
   e. On failure: events retained, retried (fetchRetryCount=3, fetchRetryDelay=3s)
5. Events appear in PostHog dashboard
```

**Queue and persistence details** (from `@posthog/core/dist/types.d.ts`):
- `flushAt`: 20 events triggers a flush (default)
- `flushInterval`: 30000ms between periodic flushes (default)
- `maxBatchSize`: max events per batch (must be >= flushAt)
- `maxQueueSize`: 1000 events max cached (default)
- `fetchRetryCount`: 3 retries on failure
- `fetchRetryDelay`: 3000ms between retries
- Persistence via `expo-file-system` (already installed in this project)

### Identification Flow

```
App Launch (cold start):
  1. PostHogProvider initializes with posthogClient
  2. SDK loads persisted distinct_id from expo-file-system storage
  3. If user was previously identified, SDK already has their distinct_id
  4. AuthProvider restores Supabase session from expo-sqlite/localStorage
  5. AnalyticsTracker detects session + !isNewUser
  6. Calls posthog.identify(user.id) -- no-op if already identified
     with the same ID (PostHog deduplicates)

First-time Sign-In:
  1. User taps Apple Sign-In on sign-in screen
  2. Supabase creates session, AuthProvider sets isNewUser=true
  3. AnalyticsTracker detects session but isNewUser=true -> skips identify
  4. Screen calls: trackSignIn('apple')  (captured under anonymous ID)
  5. User navigates to profile setup  ($screen event captured)
  6. User completes profile setup (name + phone)
  7. Profile-setup calls refreshProfile(), isNewUser becomes false
  8. Screen calls: trackProfileCompleted(hasAvatar)
  9. AnalyticsTracker detects !isNewUser -> posthog.identify(user.id, props)
  10. PostHog merges all anonymous events (steps 4-8) with identified person

Sign-Out:
  1. User signs out (supabase.auth.signOut())
  2. AuthProvider sets session=null
  3. AnalyticsTracker detects null session
  4. Calls posthog.reset()
  5. PostHog generates new anonymous ID for any subsequent events
```

### Screen Tracking Flow

```
User navigates from Home to Group Detail:
  1. Expo Router updates URL from "/" to "/group/abc123"
  2. usePathname() in AnalyticsTracker returns "/group/abc123"
  3. useEffect fires (pathname changed)
  4. pathnameToScreenName("/group/abc123") returns "Group Detail"
  5. posthog.screen("Group Detail", { path: "/group/abc123" })
  6. SDK captures "$screen" event with $screen_name = "Group Detail"
  7. SDK also sets "Group Detail" as a session property
     ($screen_name is automatically included in subsequent events)
```

## Integration Points

### Existing Files to Modify

| File | What to Add | Why |
|------|-------------|-----|
| `app/_layout.tsx` | Wrap with `PostHogProvider` using `client={posthogClient}`, add `<AnalyticsTracker />` renderless component | Provider must wrap app tree for autocapture + context; tracker handles screen views and identification |
| `app/(auth)/sign-in.tsx` | Call `trackSignIn('apple')` after successful Apple auth | Track sign-in funnel entry point |
| `app/(auth)/profile-setup.tsx` | Call `trackProfileCompleted()` after profile save succeeds | Track onboarding completion |
| `app/(tabs)/index.tsx` | Call `trackGroupCreated()` after group creation, `trackInviteAccepted/Declined()` on invite actions | Track core group management actions |
| `app/group/[id]/add-expense.tsx` | Call `trackExpenseCreated()` after expense submission succeeds | Track core expense action |
| `app/group/[id].tsx` | Call `trackSettleUp()` after settlement succeeds | Track settle-up action |
| `app/join/[code].tsx` | Call `trackJoinedViaLink()` after successful deep-link join | Track invite link conversion |

### New Files to Create

| File | Purpose |
|------|---------|
| `lib/analytics.ts` | PostHog client instance creation, API key/host constants, typed event tracking helper functions, `pathnameToScreenName()` utility |

### Environment Variables to Add

| Variable | Purpose | Where to Set |
|----------|---------|--------------|
| `EXPO_PUBLIC_POSTHOG_API_KEY` | PostHog project API key | `.env` file locally, EAS Secrets for builds |

## Suggested Build Order

The build order ensures each step produces a testable, verifiable result before the next step adds complexity. Steps 1-5 are the core integration; steps 6-8 add the event tracking.

1. **PostHog project setup + environment variable**
   - Create PostHog project at posthog.com (if not done)
   - Copy project API key
   - Add `EXPO_PUBLIC_POSTHOG_API_KEY` to `.env`
   - Verify the env var loads at runtime via `console.log`

2. **Create `lib/analytics.ts` with PostHog client instance**
   - Initialize `posthogClient = new PostHog(apiKey, { host })`
   - Export the client and config constants
   - Export `pathnameToScreenName()` function
   - No event helpers yet -- just the client and screen mapper
   - **Verify:** Import in `_layout.tsx`, log `posthogClient.getDistinctId()` to confirm SDK initializes

3. **Add PostHogProvider to `app/_layout.tsx`**
   - Import `PostHogProvider` from `posthog-react-native`
   - Wrap provider tree with `PostHogProvider client={posthogClient}`
   - Set `autocapture={{ captureTouches: true, captureScreens: false }}`
   - **Verify:** Open app, check PostHog Live Events for touch autocapture events

4. **Add AnalyticsTracker with screen tracking**
   - Implement `AnalyticsTracker` component with `usePathname()` + `posthog.screen()`
   - Place `<AnalyticsTracker />` inside the provider tree (after BottomSheetModalProvider, before SyncWatcher)
   - **Verify:** Navigate between tabs and screens, check PostHog Live Events for `$screen` events with correct names

5. **Add user identification to AnalyticsTracker**
   - Add `useAuth()` dependency, watch `session` and `isNewUser`
   - Call `posthog.identify(user.id, { $set: { name } })` when fully set up
   - Call `posthog.reset()` on sign-out
   - **Verify:** Sign in, check PostHog Persons tab shows identified person with correct Supabase UUID and name

6. **Add event tracking helpers to `lib/analytics.ts`**
   - Add typed functions for each tracked event (8 events total)
   - **Verify:** File compiles, functions have correct signatures

7. **Wire event tracking into screen components**
   - Add `trackSignIn()` to sign-in.tsx
   - Add `trackProfileCompleted()` to profile-setup.tsx
   - Add `trackGroupCreated()`, `trackInviteAccepted()`, `trackInviteDeclined()` to index.tsx
   - Add `trackExpenseCreated()` to add-expense.tsx
   - Add `trackSettleUp()` to group/[id].tsx
   - Add `trackJoinedViaLink()` to join/[code].tsx
   - **Verify:** Walk through each flow, confirm events appear in PostHog with correct properties

8. **Add user properties sync**
   - After identify, call `setPersonProperties` with group_count
   - Update group_count when groups are created/joined
   - **Verify:** Check PostHog person profile shows updated properties

## Key Architectural Decisions

### Decision 1: Standalone PostHog instance over provider-managed

**Choice:** Create `new PostHog()` in `lib/analytics.ts`, pass to `PostHogProvider` via `client` prop.

**Rationale:** The app has non-React code paths that need PostHog access (the event tracking helpers are pure functions, not hooks). A standalone instance is importable from any TypeScript file. The `PostHogProvider` documentation explicitly supports this pattern with the `client` prop.

**Trade-off:** Two ways to access PostHog in components (import `posthogClient` directly vs. `usePostHog()` hook). Convention: use `usePostHog()` in components, direct import in non-component code.

### Decision 2: Manual screen tracking (not autocapture)

**Choice:** `captureScreens: false` + manual `posthog.screen()` via `usePathname()`.

**Rationale:** This is a requirement, not a preference. PostHog's autocapture screen tracking crashes with Expo Router due to the `useNavigationState` error. Manual tracking via `usePathname()` is the officially recommended approach for Expo Router apps, documented both in the SDK source code and Expo's own screen tracking guide.

### Decision 3: AnalyticsTracker as renderless component

**Choice:** A `<AnalyticsTracker />` component that returns `null`, placed inside the provider tree in `_layout.tsx`.

**Rationale:** It needs access to both `usePostHog()` (from PostHogProvider context) and `useAuth()` (from AuthProvider context), plus Expo Router's `usePathname()`. As a component inside both providers, it naturally has access to all contexts. The existing `SyncWatcher` component uses the same renderless pattern.

### Decision 4: Identify after profile completion, not after sign-in

**Choice:** Wait for `isNewUser === false` before calling `posthog.identify()`.

**Rationale:** For first-time users, the Supabase session exists but the user profile (display_name) does not yet. If we identify immediately on session creation, the person in PostHog would have no meaningful properties. By waiting until profile setup completes, the first identify call includes the user's display name. PostHog's anonymous-to-identified merge ensures all pre-identification events (sign-in, profile setup screen views) are retroactively attributed to the identified person.

### Decision 5: Event names use snake_case, not camelCase

**Choice:** `expense_created` not `expenseCreated`.

**Rationale:** PostHog convention. PostHog's built-in events use `$screen`, `$autocapture`, `$identify`. Community convention follows snake_case for custom events. This also makes events readable in the PostHog dashboard without transformation.

## SDK Dependencies Already Installed

The project already has all required packages. No new installations needed:

| Package | Version | Status | Purpose |
|---------|---------|--------|---------|
| `posthog-react-native` | ^4.36.0 | Already in package.json | PostHog SDK |
| `expo-file-system` | ~19.0.21 | Already installed | Event persistence/storage |
| `expo-application` | ~7.0.8 | Already installed | App version/build info |
| `expo-device` | ~8.0.10 | Already installed | Device info |
| `expo-localization` | ~17.0.8 | Already installed | Locale/timezone |

**Source:** package.json already lists `posthog-react-native` and all its Expo peer dependencies.

## Sources

- PostHog React Native SDK type definitions (installed at `node_modules/posthog-react-native/dist/types.d.ts`) -- PostHogAutocaptureOptions interface, `captureScreens` documentation with Expo Router comments (lines 22-60)
- PostHog React Native SDK class definition (installed at `node_modules/posthog-react-native/dist/posthog-rn.d.ts`) -- `identify()` (line 633), `capture()` (inherited from core), `screen()` (line 534), `reset()` (line 206), `setPersonProperties()` (lines 730-734), `register()` (line 163)
- PostHog Provider definition (installed at `node_modules/posthog-react-native/dist/PostHogProvider.d.ts`) -- `PostHogProviderProps` interface, `client` prop (line 18), examples (lines 67-80)
- PostHog Core SDK types (installed at `node_modules/@posthog/core/dist/types.d.ts`) -- `PostHogCoreOptions` (flushAt, flushInterval, maxQueueSize, fetchRetryCount, etc.)
- [PostHog GitHub Issue #2740](https://github.com/PostHog/posthog-js/issues/2740) -- Expo Router autocapture crash, closed "not planned", recommends manual screen capture
- [Expo Router Screen Tracking Docs](https://docs.expo.dev/router/reference/screen-tracking/) -- Official `usePathname()` + `useEffect` pattern for analytics
- [PostHog React Native Install Snippet](https://github.com/PostHog/posthog.com/blob/master/contents/docs/integrate/_snippets/install-react-native.mdx) -- PostHogProvider setup examples, installation commands
- [posthog-react-native CHANGELOG](https://github.com/PostHog/posthog-js-lite/blob/main/posthog-react-native/CHANGELOG.md) -- v4.2.0 added captureScreens docs for expo-router, v4.1.5 fixed navigation ref for expo-router

---
*Architecture research for: PostHog in Expo/React Native*
*Researched: 2026-02-24*
