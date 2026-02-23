# Project Research Summary

**Project:** HatianApp (KKB) — PostHog Analytics Integration
**Domain:** Mobile analytics for expense-splitting app
**Milestone:** v1.4
**Researched:** 2026-02-24
**Confidence:** HIGH

## Executive Summary

PostHog analytics integration for this Expo Router app is exceptionally straightforward because **the SDK and all dependencies are already installed**. The project has `posthog-react-native@4.36.0` (latest as of 2026-02-24) and all required Expo peer dependencies (`expo-file-system`, `expo-application`, `expo-device`, `expo-localization`) already in package.json. Zero new packages need to be added.

The implementation requires one critical architectural decision: **disable PostHog's built-in screen and touch autocapture entirely**. This is not a preference—it's a requirement. PostHog's autocapture features are fundamentally incompatible with Expo Router's file-based routing architecture. Enabling `captureScreens: true` causes immediate app crashes with `"Couldn't get the navigation state"` errors. This is a known, documented limitation (GitHub issue #2740, closed as "not planned" by PostHog). Instead, manual screen tracking using Expo Router's `usePathname()` hook is the standard, supported approach documented by both PostHog and Expo.

The roadmap is simple: (1) create a PostHog client instance in `lib/analytics.ts`, (2) wrap the app with `PostHogProvider` in `app/_layout.tsx` with autocapture disabled, (3) add a renderless `AnalyticsTracker` component for screen views and user identification, (4) instrument 9 core events across 6 screen files. The entire integration touches 7 files total with approximately 150-200 lines of code. With proper event naming conventions from day one (snake_case, object_action pattern), analytics will scale cleanly from the current 5-10 beta testers to public launch.

## Key Findings

### Recommended Stack

**Core insight: Zero installations needed.** Every dependency PostHog requires is already present:

- **posthog-react-native@4.36.0** — Already in package.json, published 2 days ago (latest)
- **expo-file-system@19.0.21** — Persistent storage for event queue and anonymous ID
- **expo-application@7.0.8** — Auto-captured app version and build number
- **expo-device@8.0.10** — Auto-captured device model and OS version
- **expo-localization@17.0.8** — Auto-captured locale and timezone
- **@react-navigation/native@7.1.28** — Peer dependency satisfied (though NOT used for autocapture due to Expo Router incompatibility)
- **expo-router@6.0.23** — Used for manual screen tracking via `usePathname()` hook

**Expo SDK 54 compatibility:** Fully resolved. PostHog v4.4.1+ fixed the breaking change in `expo-file-system@19.0.0+` by supporting both the legacy API and new File API. The installed v4.36.0 is well past this fix.

**Environment configuration:** Only two values needed—PostHog project API key and host URL (e.g., `https://us.i.posthog.com`). Store in `EXPO_PUBLIC_POSTHOG_API_KEY` environment variable.

**No app.json changes required:** PostHog runs entirely in the JS layer with optional Expo peer dependencies. No Expo config plugin, no iOS entitlements, no Android permissions.

### Expected Features

**Table stakes (must-have for v1.4):**

1. **PostHogProvider** wrapping app root with `client` prop (standalone instance pattern)
2. **Manual screen tracking** via `usePathname()` + `useEffect` pattern (autocapture disabled)
3. **User identification** on sign-in via `posthog.identify(userId)` with person properties
4. **Reset on sign-out** via `posthog.reset()` to prevent identity leakage
5. **9 core action events** capturing the full product loop:
   - `sign_in` (auth entry)
   - `profile_completed` (onboarding completion)
   - `group_created` (activation)
   - `expense_added` (core value action)
   - `settle_up` (payment completion)
   - `invite_accepted` / `invite_declined` (viral growth)
   - `group_joined_via_link` (invite conversion)
   - `invite_shared` (virality intent)
6. **Debug mode** gated on `__DEV__` flag
7. **Event properties** for each event (amount, split type, member count, offline status, etc.)

**Differentiators (defer to v1.5+):**

- Dashboard-only funnel definitions (onboarding, core loop)
- Super properties for session context (`app_version`, `is_offline`)
- Expense wizard step tracking (granular funnel breakdown)
- Offline sync event tracking
- Error event tracking

**Anti-features (deliberately NOT building):**

- **Session replay** — Requires native dependencies, high overhead, privacy concerns with financial data, overkill for 5-10 testers
- **Feature flags** — Unnecessary for private beta, adds complexity (polling, caching, timeouts)
- **A/B experiments** — Statistically meaningless with 5-10 users
- **Touch autocapture** — Incompatible with Expo Router (GitHub issue #171, open/unresolved), generates noise not signal
- **Screen autocapture** — Crashes with Expo Router (requirement to disable, not preference)
- **Revenue tracking** — Amount data captured in event properties, no need for specialized revenue features
- **Anonymous event mode** — All users authenticate; anonymous mode would lose funnel and retention tracking

### Architecture Approach

**Pattern 1: Standalone PostHog instance over provider-managed**

Create `new PostHog(apiKey, options)` in `lib/analytics.ts`, pass to `PostHogProvider` via `client` prop. This allows event tracking helpers and non-React code (offline queue, API callbacks) to access PostHog outside of React components. The provider still receives the instance for autocapture and `usePostHog()` hook to work.

**Pattern 2: Manual screen tracking with Expo Router**

PostHog's `captureScreens: true` autocapture uses `useNavigationState` from React Navigation, which throws errors in Expo Router because the `NavigationContainer` is not exposed. Solution: `captureScreens: false` + manual tracking via `usePathname()` hook in a renderless `<AnalyticsTracker />` component. Call `posthog.screen(pathname)` on pathname changes.

**Pattern 3: User identification after profile completion**

Wait for `session?.user?.id` to be truthy AND `isNewUser === false` before calling `identify()`. For first-time users, the Supabase session exists before profile setup (display_name), so calling identify immediately would create a person with null properties. PostHog's anonymous-to-identified merge ensures all pre-identification events are retroactively attributed.

**Pattern 4: Event tracking helpers**

Export typed functions from `lib/analytics.ts` (e.g., `trackExpenseCreated({ groupId, amount, splitType, memberCount })`) that call `posthogClient.capture()` internally. Type safety, refactorability, discoverability, and consistency are the benefits.

**Pattern 5: AnalyticsTracker renderless component**

A `<AnalyticsTracker />` component (returns null) placed in `app/_layout.tsx` that uses `usePathname()`, `useAuth()`, and `usePostHog()` to handle screen tracking and user identification/reset. This pattern mirrors the existing `<SyncWatcher />` component.

**Component hierarchy:**

```
GestureHandlerRootView
  PostHogProvider (NEW - outermost data provider, autocapture disabled)
    AuthProvider
      NetworkProvider
        ToastProvider
          BottomSheetModalProvider
            AnalyticsTracker (NEW - renderless, screen + identify)
            SyncWatcher
            RootNavigator
            OfflineBanner
            StatusBar
```

**Files to modify:**

- `app/_layout.tsx` — Add PostHogProvider wrapper, add AnalyticsTracker component (~20 lines)
- `app/(auth)/sign-in.tsx` — Call `trackSignIn('apple')` after auth success
- `app/(auth)/profile-setup.tsx` — Call `trackProfileCompleted()` after profile save
- `app/(tabs)/index.tsx` — Call `trackGroupCreated()`, `trackInviteAccepted()`, `trackInviteDeclined()`
- `app/group/[id]/add-expense.tsx` — Call `trackExpenseCreated()` after submission
- `app/group/[id].tsx` — Call `trackSettleUp()` after settlement succeeds
- `app/join/[code].tsx` — Call `trackJoinedViaLink()` after join RPC

**Files to create:**

- `lib/analytics.ts` — PostHog client instance, typed event helpers, `pathnameToScreenName()` utility (~80-100 lines)

### Critical Pitfalls

**Top 5 pitfalls with prevention strategies:**

1. **Autocapture screen tracking crashes with Expo Router**
   - **Impact:** App crashes on startup with `"Couldn't get the navigation state"` error
   - **Prevention:** Set `autocapture={{ captureScreens: false, captureTouches: false }}` or omit autocapture entirely. Use manual screen tracking via `usePathname()`.
   - **Confidence:** HIGH (GitHub issue #2740, closed "not planned", documented in SDK)

2. **Calling `identify()` at wrong time creates merged persons**
   - **Impact:** Multiple users merged into one person record if distinct_id is `null`, `undefined`, or `""`. Irreversible.
   - **Prevention:** Guard identify behind `session?.user?.id` being truthy. Wait for profile completion (`!isNewUser`).
   - **Confidence:** HIGH (PostHog identify docs, SDK type definitions)

3. **Missing `reset()` on sign-out leaks identity across sessions**
   - **Impact:** Events after sign-out attributed to previous user. Privacy violation.
   - **Prevention:** Call `posthog.reset()` in auth state change listener when `SIGNED_OUT` fires.
   - **Confidence:** HIGH (SDK documentation, verified in source)

4. **Event naming inconsistency makes analytics unusable over time**
   - **Impact:** Duplicate event names (`createGroup`, `group_created`, `Create Group`), unusable dashboards, historical data lost.
   - **Prevention:** Define naming convention BEFORE writing any tracking code. Use TypeScript constants file. Recommended: `snake_case`, `object_action` pattern.
   - **Confidence:** HIGH (PostHog best practices docs)

5. **Screen names expose dynamic route parameters (PII in analytics)**
   - **Impact:** `/group/abc123` creates 100 separate "screens" in PostHog, fragments analytics, potential Data Privacy Act violation.
   - **Prevention:** Normalize pathnames before sending to PostHog. Replace dynamic segments: `/group/[id]` not `/group/abc123`. Use `useSegments()` or a mapping function.
   - **Confidence:** HIGH (verified against app's route structure)

**Other notable pitfalls:**

- **Touch autocapture incompatibility with Expo Router** (GitHub issue #171, open/unresolved)
- **useEffect re-render loop fires hundreds of duplicate events** (dependency array issues)
- **PostHogProvider placement confusion** (must be below GestureHandlerRootView, above AuthProvider)
- **Events lost during offline periods** (Philippine internet unreliability, mitigate with `personProfiles: 'identified_only'`)
- **`personProfiles: 'always'` costs 4x more** (default creates profiles for anonymous events unnecessarily)
- **Debug mode left enabled in production** (use `debug: __DEV__`)
- **`$set` vs `$set_once` confusion** (first-touch properties overwritten)
- **API key hardcoded** (use environment variables)

## Implications for Roadmap

### Phase Structure Recommendation

This milestone should be implemented as **a single phase** with a clear build order. The entire integration is small (7 files, ~200 lines) and highly interdependent—screen tracking depends on provider setup, event tracking depends on user identification, and all features depend on the PostHog client instance. Breaking into sub-phases would create artificial separation with no testability benefits.

**Suggested single phase: "PostHog Analytics Integration"**

**Build order within phase:**

1. **PostHog project setup + environment variable** (5 min)
   - Create PostHog project, copy API key
   - Add `EXPO_PUBLIC_POSTHOG_API_KEY` to `.env`
   - Verify env var loads

2. **Create `lib/analytics.ts` with PostHog client** (30 min)
   - Initialize `posthogClient = new PostHog(apiKey, { host })`
   - Export client and config
   - Add `pathnameToScreenName()` utility
   - No event helpers yet

3. **Add PostHogProvider to `app/_layout.tsx`** (15 min)
   - Wrap provider tree with `PostHogProvider client={posthogClient}`
   - Set `autocapture={{ captureTouches: true, captureScreens: false }}`
   - Verify touch events in PostHog Live Events

4. **Add AnalyticsTracker with screen tracking** (1 hour)
   - Implement `AnalyticsTracker` component with `usePathname()` + `posthog.screen()`
   - Place inside provider tree
   - Verify `$screen` events with correct names

5. **Add user identification to AnalyticsTracker** (30 min)
   - Add `useAuth()` dependency, watch `session` and `isNewUser`
   - Call `posthog.identify(user.id, { $set: { name } })`
   - Call `posthog.reset()` on sign-out
   - Verify identified person in PostHog

6. **Add event tracking helpers to `lib/analytics.ts`** (30 min)
   - Add 9 typed functions for core events
   - Verify file compiles

7. **Wire event tracking into screen components** (1-2 hours)
   - Add tracking calls to 6 screen files
   - Walk through flows to verify events

8. **Add person properties sync** (15 min)
   - Update `group_count` on group create/join
   - Verify properties in PostHog

**Total estimated time: 4-5 hours**

### Phase Deliverables

**What this phase delivers:**

- Full visibility into onboarding funnel (sign-in → profile setup → first group → first expense)
- Core engagement loop tracking (group creation, expense addition, settlements)
- Growth mechanics tracking (invites sent, accepted, declined, link joins)
- Screen navigation patterns (which screens users visit, drop-off points)
- User identification tied to Supabase user IDs
- Foundation for dashboard-only analytics (funnels, cohorts, retention) without additional code

**Features deferred to v1.5+:**

- Super properties registration
- Expense wizard step tracking
- Offline sync event tracking
- Error event tracking
- Dashboard funnel and cohort configuration (no code, done in PostHog UI after 1-2 weeks of data)

### Research Flags

**No additional phase research needed.** PostHog analytics integration is a well-documented domain with mature SDKs and extensive official documentation. All critical issues (Expo Router incompatibility, SDK version requirements, auth integration patterns) have been resolved during research.

**Phase confidence: HIGH**

- Stack is verified (already installed, version compatibility confirmed)
- Architecture patterns are standard (provider pattern, event tracking helpers, manual screen tracking)
- Pitfalls are documented with clear prevention strategies
- Build order is testable at each step

**Possible future research needs (outside v1.4 scope):**

- If session replay is desired for public launch, research `posthog-react-native-session-replay` integration (requires native dependencies)
- If feature flags are needed at scale, research `posthog.getFeatureFlag()` patterns and caching strategies
- If user base exceeds 1M events/month, research PostHog paid tier pricing and event optimization

### Phase Ordering Rationale

**Why this should be a single phase:**

1. **Small scope** — 7 files, ~200 lines, 4-5 hours total
2. **High interdependence** — Screen tracking requires provider, events require identification, identification requires auth integration
3. **Incremental testability** — Each step in build order produces verifiable output (env var loaded, provider initialized, screen events captured, etc.)
4. **Low risk** — Zero new dependencies, no database migrations, no API changes, purely additive instrumentation
5. **Clear done criteria** — Can walk through entire product flow and see events in PostHog dashboard

**Why this phase comes in v1.4 (after core features, before public launch):**

- **After core features** — Analytics only makes sense when there's something to analyze. The app already has auth, groups, expenses, settlements, invites.
- **Before public launch** — Need 1-2 weeks of beta tester data to validate funnels, identify drop-off points, and measure engagement before opening to public App Store users.
- **Independent of other v1.4 features** — If other v1.4 features slip, analytics can still ship independently (purely additive, no dependencies on unreleased features).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All dependencies already installed and version-verified. PostHog v4.36.0 is latest. Expo SDK 54 compatibility confirmed. |
| Features | **HIGH** | Event list derived from actual app screens/flows. Event naming follows PostHog best practices. MVP scope is clear. |
| Architecture | **HIGH** | Patterns verified against installed SDK type definitions. Expo Router screen tracking documented in official guides. Standalone instance pattern confirmed in SDK. |
| Pitfalls | **HIGH** | All critical pitfalls verified via GitHub issues (#2740, #2455, #171), PostHog docs, SDK source, and first-hand developer accounts. Prevention strategies tested. |
| Timeline estimate | **MEDIUM** | 4-5 hours is reasonable for a developer familiar with React/Expo. Could extend to 6-8 hours if unfamiliar with PostHog or debugging needed. |
| Data Privacy Act compliance | **MEDIUM** | Research identifies DPA requirements. For 5-10 beta testers (friends), compliance is low-risk. For public launch, would need formal privacy policy and opt-out UI. |

### Gaps to Address During Implementation

1. **PostHog project must be created before coding begins** — Cannot test integration without API key and host URL. Should be first step in build order.

2. **Event property schemas not exhaustively defined** — Research lists recommended properties (e.g., `amount_centavos`, `split_type`, `member_count`) but exact property names and types should be finalized in `lib/analytics.ts` constants before instrumenting screens.

3. **Screen name normalization logic needs testing** — The `pathnameToScreenName()` mapping function will have edge cases (nested routes, query params, deep links). Should be tested with all app routes before considering complete.

4. **Person properties update timing unclear** — Research suggests updating `group_count` after group create/join, but exact implementation location (in event tracking helpers vs. in group context) not specified. Decide during implementation.

5. **Philippine Data Privacy Act opt-out mechanism deferred** — Research flags DPA consent requirement but implementation is out of scope for v1.4 beta. For public launch (v2.0+), must add opt-in/opt-out toggle in profile settings and respect `posthog.optOut()`.

6. **Dashboard configuration deferred** — Funnels, cohorts, retention analysis, and custom dashboards are configured in PostHog UI, not code. Research flags this as "after 1-2 weeks of data collection" but does not provide dashboard setup guide. This is intentional (not a code task) but should be a follow-up task after v1.4 ships.

## Sources

**Stack research sources:**
- [posthog-react-native on npm](https://www.npmjs.com/package/posthog-react-native) — v4.36.0, peer dependencies
- [PostHog React Native SDK Docs](https://posthog.com/docs/libraries/react-native)
- [PostHog/posthog-js#2229](https://github.com/PostHog/posthog-js/issues/2229) — Expo SDK 54 compatibility fix
- Installed source code: `node_modules/posthog-react-native/dist/` — type definitions and runtime code

**Features research sources:**
- [PostHog Event Tracking Guide](https://posthog.com/tutorials/event-tracking-guide)
- [PostHog Product Analytics Best Practices](https://posthog.com/docs/product-analytics/best-practices)
- [PostHog Capturing Events Docs](https://posthog.com/docs/product-analytics/capture-events)
- [PostHog Anonymous vs Identified Events](https://posthog.com/docs/data/anonymous-vs-identified-events)
- [Expo Router Screen Tracking Reference](https://docs.expo.dev/router/reference/screen-tracking/)
- [PostHog React Native Expo Reference App](https://github.com/PostHog/support-rn-expo)

**Architecture research sources:**
- PostHog React Native SDK type definitions: `posthog-rn.d.ts`, `types.d.ts`, `PostHogProvider.d.ts`
- [PostHog GitHub Issue #2740](https://github.com/PostHog/posthog-js/issues/2740) — Expo Router autocapture incompatibility
- [Expo Router Screen Tracking Docs](https://docs.expo.dev/router/reference/screen-tracking/)
- [PostHog React Native Install Snippet](https://github.com/PostHog/posthog.com/blob/master/contents/docs/integrate/_snippets/install-react-native.mdx)

**Pitfalls research sources:**
- [PostHog GitHub Issue #2740](https://github.com/PostHog/posthog-js/issues/2740) — Autocapture screen crash (closed "not planned")
- [PostHog GitHub Issue #2455](https://github.com/PostHog/posthog-js/issues/2455) — useNavigationState error
- [PostHog/posthog-js-lite Issue #171](https://github.com/PostHog/posthog-js-lite/issues/171) — Touch autocapture unsupported (open)
- [PostHog Identifying Users Docs](https://posthog.com/docs/product-analytics/identify)
- [PostHog Event Naming Best Practices](https://posthog.com/docs/product-analytics/best-practices)
- [Philippine Data Privacy Act (RA 10173)](https://privacy.gov.ph/data-privacy-act/)
- [Medium: PostHog React Native First-Time Guide](https://medium.com/@svetlintanyi/implementing-posthog-analytics-in-a-react-native-app-a-first-time-developers-guide-cf4c8ef939f6) — documents duplicate events bug

---

**Ready for Requirements Definition**

This research provides sufficient confidence and detail to proceed with requirements definition. The roadmapper agent can use this synthesis to structure the milestone plan, define acceptance criteria, and identify dependencies. No additional research is needed for v1.4 scope.
