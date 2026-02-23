# Feature Research: PostHog Analytics Integration

**Domain:** Mobile analytics for expense-splitting app (React Native / Expo)
**Researched:** 2026-02-24
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Must Have for Analytics Integration)

These are non-negotiable for a functioning analytics setup. Without them, the integration provides no value.

| Feature | Why Expected | Complexity | Touches |
|---------|--------------|------------|---------|
| PostHogProvider wrapper at app root | Required to make the PostHog client available via Context to all screens. Must wrap the entire app so `usePostHog()` works anywhere. | LOW | `app/_layout.tsx` -- wraps inside existing provider stack (AuthProvider > NetworkProvider > ToastProvider > BottomSheetModalProvider). PostHogProvider should go outside AuthProvider so auth events themselves are captured. |
| User identification on sign-in | Call `posthog.identify(userId)` when Supabase session is established. Links all anonymous pre-auth events to the identified user. Must call once per session, typically in `auth-context.tsx` when `onAuthStateChange` fires `SIGNED_IN`. | LOW | `lib/auth-context.tsx` -- the `onAuthStateChange` callback. Also `app/(auth)/profile-setup.tsx` for setting initial user properties after profile completion. |
| Person properties sync | Set `$set` properties on identify: `display_name`, `phone_number`, `group_count`. These enable filtering and breakdown in PostHog dashboards (e.g., "users with 3+ groups"). | LOW | `lib/auth-context.tsx` -- pass properties in `identify()` call. Update `group_count` after group creation/join events. |
| posthog.reset() on sign-out | Clears the identified user, super properties, and anonymous ID. Without this, the next user on the same device inherits the previous user's identity. | LOW | `app/(tabs)/profile.tsx` -- the sign-out handler. Call `posthog.reset()` before `supabase.auth.signOut()`. |
| Screen view tracking | Track every screen transition. In PostHog this creates `$screen` events with screen name. Critical for understanding which screens users visit and where they drop off. | MEDIUM | `app/_layout.tsx` -- use `usePathname()` + `useEffect()` pattern from Expo Router (NOT PostHog's built-in `captureScreens` autocapture, which has a known incompatibility with Expo Router that triggers `useNavigationState` errors). |
| Core action event: sign_in | Track successful Apple Sign-In. Properties: `method` (always "apple"), `is_new_user` (boolean). Measures auth funnel completion. | LOW | `app/(auth)/sign-in.tsx` -- after successful `signInWithIdToken`. |
| Core action event: profile_completed | Track profile setup completion (first-time users only). Properties: `has_apple_name` (whether Apple provided name). Measures onboarding funnel completion. | LOW | `app/(auth)/profile-setup.tsx` -- after successful profile save. |
| Core action event: group_created | Track group creation. Properties: `is_offline` (boolean -- queued vs immediate). Measures core engagement. | LOW | `app/(tabs)/index.tsx` -- in `handleCreateGroup` after success. |
| Core action event: expense_added | Track expense submission. Properties: `amount_centavos`, `split_type` ("equal" or "custom"), `member_count` (number of members in split), `is_offline`. This is the single most important event -- it represents the core value action. | LOW | `app/group/[id]/add-expense.tsx` -- in `handleSubmit` after success. |
| Core action event: settle_up | Track settlement recording. Properties: `amount_centavos`, `group_id`. Measures payment completion. | LOW | `components/settlements/SettleConfirmSheet.tsx` -- in `handleConfirmSettle` after success. |
| Core action event: invite_accepted | Track when user accepts a phone invite. Properties: `group_name`. | LOW | `app/(tabs)/index.tsx` -- in `handleAcceptInvite` after success. |
| Core action event: invite_declined | Track when user declines a phone invite. Properties: `group_name`. | LOW | `app/(tabs)/index.tsx` -- in `handleDeclineInvite` after success. |
| Core action event: group_joined_via_link | Track join-via-invite-link. Properties: `group_name`, `member_count`. | LOW | `app/join/[code].tsx` -- after successful `join_group_by_invite` RPC. |
| Core action event: invite_shared | Track when user taps Share to send invite link. Properties: `group_id`. Measures virality/growth behavior. | LOW | `app/group/[id].tsx` -- in `handleShare`. Note: cannot determine if share was actually completed (iOS Share sheet does not report this reliably). |
| SDK configuration: flushAt and flushInterval | PostHog batches events and sends them periodically (default: 20 events or 30 seconds). For a small beta with 5-10 users, defaults are fine. No tuning needed. | LOW | `app/_layout.tsx` -- PostHogProvider `options` prop. Use defaults. |
| Debug mode in development | Enable `debug: true` in PostHogProvider options during development (via `__DEV__` flag). Shows verbose SDK logs for verifying events fire correctly. Disable in production. | LOW | `app/_layout.tsx` -- `options={{ debug: __DEV__ }}`. |

### Differentiators (Advanced Analytics -- Competitive Advantage)

Features that provide deeper insight beyond basic event tracking. Not required for v1.4 launch but high-value additions.

| Feature | Value Proposition | Complexity | Touches |
|---------|-------------------|------------|---------|
| Funnel definition: onboarding | Define funnel: `sign_in` -> `profile_completed` -> `group_created` -> `expense_added`. Measures how many new users complete the full activation loop. Built entirely in PostHog dashboard -- zero code. | LOW (dashboard only) | No code changes. Configure in PostHog UI after events are flowing. |
| Funnel definition: core loop | Define funnel: `group_created` -> `invite_shared` -> `expense_added` -> `settle_up`. Measures the complete product loop. Dashboard-only. | LOW (dashboard only) | No code changes. |
| Super properties for session context | Set super properties that attach to every event: `app_version`, `is_offline`. Avoids repeating these on every `capture()` call. PostHog super properties persist across the session and are additive. | LOW | `app/_layout.tsx` or a dedicated analytics init hook. Call `posthog.register({ app_version, platform })` once on app start. |
| Offline event queuing awareness | Track `offline_sync_completed` event when the offline queue flushes. Properties: `queued_count`, `sync_duration_ms`. Measures reliability of offline-first architecture. | MEDIUM | `lib/sync-manager.ts` -- fire event after successful queue flush. |
| Cohort: power users | Define cohort in PostHog: users who added 5+ expenses in the last 7 days. Dashboard-only configuration. | LOW (dashboard only) | No code changes. |
| User property: last_active_at | Update `$set` property `last_active_at` on each app open. Enables retention analysis without custom events. | LOW | `app/_layout.tsx` -- set in identify or via `posthog.capture('$set', { $set: { last_active_at: new Date().toISOString() } })` on app focus. |
| Expense wizard step tracking | Track each step of the 3-step expense wizard: `expense_step_amount`, `expense_step_payer`, `expense_step_split`. Identifies where users abandon the expense flow. | MEDIUM | `app/group/[id]/add-expense.tsx` -- in `onPageSelected` callback of PagerView. Fire event with `step` property on each page change. |
| Error event tracking | Track `error_occurred` when RPC calls fail or network errors happen. Properties: `error_type`, `error_message`, `screen`. Surfaces reliability issues. | MEDIUM | Multiple files -- would need a centralized error tracking utility that wraps PostHog capture. |
| Group analytics (PostHog Groups) | Associate events with a PostHog "group" (the user's expense group). Enables group-level analytics: "which groups are most active?" This is a paid PostHog feature. | HIGH | Would need `posthog.group('group', groupId)` calls. Paid feature -- not appropriate for private beta on free tier. |

### Anti-Features (Deliberately NOT Building)

Things commonly requested or tempting to add that would be problematic for this project at this stage.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Session replay | Visual recording of user sessions. Tempting for debugging. | PostHog RN session replay requires additional native dependencies, increases bundle size, has performance overhead on mobile. The app has 5-10 testers -- just ask them directly. Also has privacy implications with financial data visible on screen. | Use `debug: true` in dev mode. Ask testers for direct feedback via Messenger/Viber. |
| Feature flags | Control feature rollout remotely. | Only 5-10 testers in private beta. No need for gradual rollout. Adds SDK complexity (feature flag polling, caching in AsyncStorage, request timeouts). Build this when preparing for public launch. | Ship features directly in builds. Use EAS Update for hotfixes if needed. |
| A/B experiments | Test UI variations. | Same as feature flags -- requires feature flag infrastructure. Statistically meaningless with 5-10 users. | Iterate based on direct qualitative feedback from testers. |
| Touch autocapture (`captureTouches: true`) | Tracks every tap/touch on the screen. "Free" data. | Generates enormous event volume. With financial UIs, most taps are on numpad digits -- noise, not signal. Makes PostHog dashboards cluttered. Hard to extract meaning. Also captures sensitive areas (amount inputs). Free tier has event limits. | Use targeted custom events on meaningful actions only. |
| Screen autocapture via PostHog SDK | The SDK's built-in `captureScreens: true` option. | Known incompatibility with Expo Router. PostHog's autocapture uses `useNavigationState` from `@react-navigation/native` which throws errors in Expo Router's file-based routing. See GitHub issue #2740 on posthog-js. | Manual screen tracking via `usePathname()` + `useEffect()` in root layout. More reliable, gives you control over screen names. |
| Revenue/monetary analytics | Track total money split, average expense amount as key metrics. | Amount data is available in event properties. No need for a dedicated revenue tracking feature. PostHog is not a financial analytics tool. Computing aggregates from event properties in PostHog is sufficient. | Include `amount_centavos` as a property on `expense_added` and `settle_up` events. Use PostHog's property aggregation in dashboards. |
| Anonymous event mode | Avoid creating person profiles to save on PostHog billing (anonymous events are up to 4x cheaper). | This app requires authentication. Every user who reaches the main app is identified. Anonymous-only mode would lose the ability to track user journeys, funnels, and retention per user -- the entire point of adding analytics. | Use the default `IDENTIFIED_ONLY` person profile mode. All events after `identify()` create person profiles. Pre-auth events stay anonymous automatically. |
| Custom dashboards in-app | Show analytics to the user inside the app (spending trends, usage stats). | This is a product feature, not an analytics integration task. Requires significant UI work, new Supabase queries, and data visualization components. Conflates analytics (for the developer) with features (for the user). | Keep analytics in PostHog dashboard (for developer). If user-facing analytics is wanted later, build it as a separate milestone using Supabase data directly. |
| Tracking every Supabase RPC call | Instrument every database interaction as an event. | Creates massive event volume for minimal insight. Most RPC calls (fetch groups, fetch balances) happen on every screen focus. Would dominate event counts and obscure meaningful actions. | Track only write operations that represent user intent: create, settle, join, accept, decline. Reads are covered by screen views. |

## Feature Dependencies

```
PostHogProvider setup
  |
  +-- SDK initialization (API key, host)
  |
  +-- Screen tracking (usePathname in root layout)
  |     |
  |     +-- Requires PostHogProvider to be ancestor
  |
  +-- User identification
  |     |
  |     +-- Depends on: AuthProvider session state
  |     +-- Triggers: Person properties sync
  |     +-- Triggers: Super properties registration
  |
  +-- Core action events (all independent, can be added in any order)
  |     |
  |     +-- sign_in (sign-in.tsx)
  |     +-- profile_completed (profile-setup.tsx)
  |     +-- group_created (index.tsx)
  |     +-- expense_added (add-expense.tsx)
  |     +-- settle_up (SettleConfirmSheet.tsx)
  |     +-- invite_accepted (index.tsx)
  |     +-- invite_declined (index.tsx)
  |     +-- group_joined_via_link (join/[code].tsx)
  |     +-- invite_shared (group/[id].tsx)
  |
  +-- posthog.reset() on sign-out (profile.tsx)
        |
        +-- Depends on: User identification working first

Dashboard configuration (funnels, cohorts) -- AFTER events are flowing
```

## MVP Definition

### Launch With (v1.4)

- [x] PostHogProvider wrapping app root with API key and host configuration
- [x] Manual screen view tracking via `usePathname()` + `useEffect()` pattern (NOT SDK autocapture)
- [x] User identification in auth-context `onAuthStateChange` with person properties (`display_name`, `phone_number`)
- [x] `posthog.reset()` on sign-out in profile screen
- [x] Debug mode gated on `__DEV__`
- [x] 9 core action events: `sign_in`, `profile_completed`, `group_created`, `expense_added`, `settle_up`, `invite_accepted`, `invite_declined`, `group_joined_via_link`, `invite_shared`
- [x] Each event with relevant properties (see Recommended Events table below)

**Rationale:** This gives full visibility into the onboarding funnel, core engagement loop, and growth mechanics. Zero features are blocked; no paid PostHog features required. All events use the free tier.

### Add After Validation (v1.5+)

- [ ] Super properties (`app_version`, `platform`) -- add once event naming is validated
- [ ] Expense wizard step tracking -- add if expense completion rate appears low in funnels
- [ ] Offline sync event tracking -- add if users report data loss or sync issues
- [ ] Error event tracking -- add if reliability problems surface
- [ ] Dashboard funnels and cohorts -- configure in PostHog UI once 1-2 weeks of data is collected

**Trigger:** After 1-2 weeks of data collection, review PostHog dashboards. If funnels show unexpected drop-offs, add more granular tracking at those points.

### Future Consideration (v2+)

- [ ] Session replay -- when preparing for public App Store launch and larger user base
- [ ] Feature flags -- when user base exceeds ~50 users and gradual rollout becomes valuable
- [ ] A/B experiments -- when user base is large enough for statistical significance (100+ users)
- [ ] PostHog Group analytics -- when paying for PostHog and need group-level insights
- [ ] User-facing spending analytics -- separate product milestone, not analytics infrastructure

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| PostHogProvider + SDK init | None (infra) | Very Low (30 min) | P0 -- Enables everything else |
| Screen tracking (manual) | None (infra) | Low (1 hour) | P0 -- Core navigation visibility |
| User identification | None (infra) | Low (30 min) | P0 -- Links events to people |
| posthog.reset() on sign-out | None (infra) | Very Low (5 min) | P0 -- Data integrity |
| sign_in event | HIGH (funnel top) | Very Low (10 min) | P0 |
| profile_completed event | HIGH (onboarding) | Very Low (10 min) | P0 |
| group_created event | HIGH (activation) | Very Low (10 min) | P0 |
| expense_added event | HIGHEST (core value) | Very Low (10 min) | P0 |
| settle_up event | HIGH (completion) | Very Low (10 min) | P0 |
| invite_accepted event | HIGH (growth) | Very Low (10 min) | P0 |
| invite_declined event | MEDIUM (churn signal) | Very Low (10 min) | P0 |
| group_joined_via_link event | HIGH (growth) | Very Low (10 min) | P0 |
| invite_shared event | HIGH (virality) | Very Low (10 min) | P0 |
| Debug mode toggle | None (DX) | Very Low (5 min) | P0 |
| Super properties | LOW (convenience) | Low (15 min) | P1 |
| Expense wizard steps | MEDIUM (funnel detail) | Medium (1 hour) | P2 |
| Offline sync tracking | LOW (reliability) | Medium (1 hour) | P2 |
| Error tracking | MEDIUM (reliability) | Medium (2 hours) | P2 |

## Recommended Events for Expense-Splitting App

### Event Naming Convention

Following PostHog best practices, use **snake_case** with **present-tense verbs**:

- All lowercase
- Snake case separators
- `[object]_[verb]` pattern (e.g., `expense_added`, `group_created`)
- Present tense for actions (not past tense -- PostHog convention is actually flexible here, but consistency matters)
- Properties use `snake_case` with `is_` prefix for booleans

**Allowed verbs:** `created`, `added`, `completed`, `accepted`, `declined`, `joined`, `shared`, `viewed`, `opened`, `failed`

### Authentication Events

| Event Name | Properties | When Fired | Screen |
|------------|------------|------------|--------|
| `sign_in` | `method: "apple"`, `is_new_user: boolean` | After successful `signInWithIdToken` (before navigation) | `app/(auth)/sign-in.tsx` |
| `sign_in_failed` | `method: "apple"`, `error: string` | After `signInWithIdToken` returns error (NOT user cancellation) | `app/(auth)/sign-in.tsx` |
| `profile_completed` | `has_apple_name: boolean`, `has_avatar: boolean` | After successful profile save in setup screen | `app/(auth)/profile-setup.tsx` |
| `sign_out` | (none) | Before `posthog.reset()` and `supabase.auth.signOut()` | `app/(tabs)/profile.tsx` |

### Core Flow Events

| Event Name | Properties | When Fired | Screen |
|------------|------------|------------|--------|
| `expense_added` | `amount_centavos: number`, `split_type: "equal" \| "custom"`, `member_count: number`, `is_offline: boolean`, `group_id: string` | After successful expense creation (RPC success or offline enqueue) | `app/group/[id]/add-expense.tsx` |
| `settle_up` | `amount_centavos: number`, `group_id: string` | After successful `record_settlement` RPC | `components/settlements/SettleConfirmSheet.tsx` |
| `settlement_deleted` | `amount_centavos: number`, `group_id: string` | After successful `delete_settlement` RPC | `app/group/[id].tsx` |

### Group Events

| Event Name | Properties | When Fired | Screen |
|------------|------------|------------|--------|
| `group_created` | `is_offline: boolean` | After successful group creation (RPC success or offline enqueue) | `app/(tabs)/index.tsx` |
| `invite_shared` | `group_id: string` | When user taps Share button (cannot confirm delivery) | `app/group/[id].tsx` |
| `group_joined_via_link` | `group_id: string`, `member_count: number` | After successful `join_group_by_invite` RPC | `app/join/[code].tsx` |
| `invite_accepted` | `group_id: string` | After successful `accept_invite` RPC | `app/(tabs)/index.tsx` |
| `invite_declined` | `group_id: string` | After user confirms decline in Alert dialog and RPC succeeds | `app/(tabs)/index.tsx` |
| `member_added` | `group_id: string`, `is_phone_invite: boolean` | After successfully adding a member via the AddMemberSheet | `app/group/[id].tsx` via `AddMemberSheet` |
| `member_removed` | `group_id: string` | After successful `remove_group_member` RPC | `app/group/[id].tsx` |

### Screen View Events

Screen views are tracked automatically via the `usePathname()` hook in the root layout. PostHog captures these as `$screen` events. The screen names map to Expo Router paths:

| Screen Path | Readable Name | Notes |
|-------------|---------------|-------|
| `/(auth)/sign-in` | Sign In | Pre-auth |
| `/(auth)/profile-setup` | Profile Setup | First-time only |
| `/(tabs)` or `/(tabs)/index` | Home | Main dashboard |
| `/(tabs)/add` | Add (tab) | Quick-add tab |
| `/(tabs)/profile` | Profile | Settings/sign-out |
| `/group/[id]` | Group Detail | Core engagement screen |
| `/group/[id]/add-expense` | Add Expense | 3-step wizard |
| `/group/[id]/expense/[expenseId]` | Expense Detail | View specific expense |
| `/group/[id]/balance/[memberId]` | Balance Detail | Drill-down on a balance |
| `/join/[code]` | Join Group | Deep link landing |
| `/activity` | Activity Feed | Recent activity |

### User Identification and Properties

| Method | When | Data |
|--------|------|------|
| `posthog.identify(userId)` | On `SIGNED_IN` auth state change | `userId` = Supabase `session.user.id` |
| `$set` properties on identify | Same time as identify | `display_name`, `phone_number`, `created_at` |
| `$set` property update | After group create/join | `group_count: number` (update incrementally or re-query) |
| `posthog.reset()` | On sign-out button press | Clears all stored identity and super properties |

## PostHog SDK Integration Pattern

### Expo Router Screen Tracking (Critical Detail)

Do NOT use PostHog's built-in `captureScreens: true` autocapture option. It relies on `useNavigationState` from `@react-navigation/native`, which is incompatible with Expo Router and throws the error: `"Couldn't get the navigation state. Is your component inside a navigator?"` (GitHub issue posthog-js #2740).

Instead, use the Expo Router-native pattern:

```
Root layout:
  1. usePathname() from expo-router
  2. useEffect() watching pathname changes
  3. posthog.screen(pathname) on each change
```

This is the pattern documented in Expo Router's official screen tracking guide and is the standard approach for integrating any analytics provider with Expo Router.

### Provider Placement

```
GestureHandlerRootView
  PostHogProvider          <-- NEW: outermost data provider
    AuthProvider
      NetworkProvider
        ToastProvider
          BottomSheetModalProvider
            ...app content
```

PostHogProvider goes outside AuthProvider so that auth-related events (sign-in attempts) are captured even before the user is identified.

### Event Capture Pattern

All events should follow the same capture pattern:

```
1. User action triggers handler
2. Async operation (RPC/enqueue) succeeds
3. posthog.capture('event_name', { properties })
4. UI feedback (toast, navigation, haptics)
```

Fire the event AFTER success, not before. This ensures we only track completed actions, not attempts. Exception: `sign_in_failed` fires on failure specifically to measure auth failure rates.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| PostHogProvider setup | HIGH | Official SDK docs, `posthog-react-native` already in package.json at v4.36.0 |
| Expo Router screen tracking workaround | HIGH | Documented in Expo Router official docs, confirmed by PostHog GitHub issue #2740 |
| Event naming convention | HIGH | PostHog official best practices docs, multiple sources agree |
| Specific events to track | HIGH | Derived directly from existing app screens and flows (all source files reviewed) |
| User identification pattern | HIGH | PostHog official docs, standard React Native pattern |
| Anti-features (session replay, feature flags) | HIGH | Scope explicitly limited by user; 5-10 tester base makes these pointless |
| PostHog free tier limits | MEDIUM | Free tier offers 1M events/month -- more than sufficient for 5-10 testers. Exact current limits should be verified on PostHog pricing page. |

## Sources

- [PostHog React Native SDK Documentation](https://posthog.com/docs/libraries/react-native) -- SDK setup, configuration, methods
- [PostHog React Native SDK Reference](https://posthog.com/docs/references/posthog-react-native) -- API reference for all methods
- [PostHog Event Tracking Guide](https://posthog.com/tutorials/event-tracking-guide) -- Naming conventions (`category:object_action`, snake_case)
- [PostHog Product Analytics Best Practices](https://posthog.com/docs/product-analytics/best-practices) -- What to track, naming, funnels
- [PostHog Capturing Events Docs](https://posthog.com/docs/product-analytics/capture-events) -- capture(), properties, frontend vs backend
- [PostHog Anonymous vs Identified Events](https://posthog.com/docs/data/anonymous-vs-identified-events) -- IDENTIFIED_ONLY mode, cost implications
- [Expo Router Screen Tracking Reference](https://docs.expo.dev/router/reference/screen-tracking/) -- usePathname() + useEffect() pattern
- [PostHog Expo Router Issue #2740](https://github.com/PostHog/posthog-js/issues/2740) -- Known autocapture incompatibility with Expo Router
- [PostHog React Native Expo Reference App](https://github.com/PostHog/support-rn-expo) -- Official example implementation
- [PostHog React Native Tutorial](https://posthog.com/tutorials/react-native-analytics) -- Step-by-step Expo setup guide

---
*Feature research for: PostHog Analytics Integration (v1.4 milestone)*
*Researched: 2026-02-24*
