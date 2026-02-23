# Domain Pitfalls: PostHog Analytics in Expo/React Native

**Domain:** PostHog analytics integration in Expo managed workflow (SDK 54, Expo Router v6, Supabase auth)
**Researched:** 2026-02-24
**Overall confidence:** HIGH (verified against installed SDK v4.36.0 type definitions, PostHog GitHub issues, official docs, and project codebase)

---

## Critical Pitfalls

Mistakes that cause broken analytics, app crashes, or data corruption that requires starting over in PostHog.

---

### Pitfall 1: Autocapture Screen Tracking Crashes with Expo Router

**What goes wrong:** Enabling `autocapture={{ captureScreens: true }}` on `PostHogProvider` when using Expo Router causes the app to crash with the error: `[Error: Couldn't get the navigation state. Is your component inside a navigator?]`. The PostHogProvider attempts to use `useNavigationState` from React Navigation to detect screen changes, but Expo Router's architecture does not expose a `NavigationContainer` that PostHog can hook into. The crash happens immediately on app start.

**Why it happens:** Expo Router wraps React Navigation internally and does not allow consumer code to inject a `NavigationContainer`. PostHog's autocapture screen tracking was designed for raw `@react-navigation/native` where you control the `NavigationContainer` and place `PostHogProvider` as a child of it. With Expo Router, the `Stack` component requires its direct children to be `<Stack.Screen>` only, and there is no user-accessible navigation container to wrap. This is a documented incompatibility -- PostHog's own team member (marandaneto) confirmed in [GitHub issue #2740](https://github.com/PostHog/posthog-js/issues/2740) that `autocapture.captureScreens` should NOT be used with Expo Router.

**Consequences:**
- App crashes on startup with a navigation state error
- If caught by error boundary, the app loads but no screens are tracked and error noise fills logs
- Developers waste hours debugging what looks like a navigation setup problem

**Warning signs:**
- `useNavigationState` error in console immediately after adding PostHogProvider
- App white-screens on launch after adding PostHog

**How to avoid:**
1. Set `autocapture={{ captureScreens: false, captureTouches: false }}` (or omit autocapture entirely)
2. Implement manual screen tracking using Expo Router's `usePathname()` and `useGlobalSearchParams()` hooks
3. Create a `<ScreenTracker />` component that calls `posthog.screen(pathname)` inside a `useEffect` that depends on the pathname
4. Place the `<ScreenTracker />` component inside the root layout, AFTER the navigator

**Phase to address:** SDK setup phase (initial PostHogProvider configuration).

**Confidence:** HIGH -- verified via [PostHog GitHub issue #2740](https://github.com/PostHog/posthog-js/issues/2740) (closed as "not planned", official guidance to disable captureScreens), [PostHog GitHub issue #2455](https://github.com/PostHog/posthog-js/issues/2455), and PostHog changelog v4.1.4-4.2.0 documenting navigation tracking fixes.

---

### Pitfall 2: Touch Autocapture Does Not Work with Expo Router

**What goes wrong:** Enabling `autocapture={{ captureTouches: true }}` with Expo Router results in touch events never being captured, or being captured with null/undefined element data. The `e._targetInst` is consistently null during touch event processing, making the captured events useless (no information about which element was tapped).

**Why it happens:** PostHog's touch autocapture was built for React Navigation's component tree structure. Expo Router's file-based routing creates a different component hierarchy that PostHog's touch event introspection cannot traverse. This is an open issue ([PostHog/posthog-js-lite #171](https://github.com/PostHog/posthog-js-lite/issues/171)) labeled "help wanted" -- meaning the PostHog team has not yet solved it.

**Consequences:**
- Touch events captured with no useful data (no element name, no screen context)
- Noisy event stream in PostHog dashboard with unhelpful autocapture events
- Wasted event quota on garbage data

**Warning signs:**
- Autocapture events in PostHog dashboard have empty `$elements` arrays
- Touch events show up but with no meaningful element hierarchy

**How to avoid:**
1. Disable touch autocapture: `autocapture={{ captureScreens: false, captureTouches: false }}`
2. Use explicit `posthog.capture('button_tapped', { button: 'create_group' })` calls on important interactions
3. This is actually better for a focused analytics strategy -- you track intentional events rather than noisy autocapture

**Phase to address:** SDK setup phase (initial PostHogProvider configuration).

**Confidence:** HIGH -- verified via [PostHog/posthog-js-lite issue #171](https://github.com/PostHog/posthog-js-lite/issues/171) (open, unresolved).

---

### Pitfall 3: Calling `identify()` at Wrong Time Creates Orphaned or Merged Persons

**What goes wrong:** If `identify()` is called too late (after events have been captured), PostHog creates an anonymous person, captures events against it, then merges the anonymous person into the identified person when `identify()` is finally called. This is the intended behavior. However, if `identify()` is called with the WRONG distinct_id (e.g., passing `undefined`, `null`, `"null"`, `""`, or a generic placeholder), PostHog merges ALL those anonymous sessions into a single garbage person record. This is irreversible -- the merged person data cannot be unmerged.

**Why it happens:** In this app, the Supabase auth state is loaded asynchronously. If PostHog initializes before the auth state is restored, events fire against an anonymous user. If the developer then calls `identify()` inside a useEffect that runs before `session` is populated (while `isLoading` is still true), the distinct_id is `undefined` or `null`. PostHog's SDK will either skip the identify (if undefined) or identify with a garbage string like `"null"`.

**Consequences:**
- Multiple real users merged into one person record (if they all identified as `"null"` or `""`)
- Historical data permanently corrupted -- no way to unmerge persons in PostHog
- Analytics dashboards show one "super user" with all events
- Funnels and retention metrics are meaningless

**Warning signs:**
- PostHog dashboard shows far fewer persons than expected
- One person has an impossibly high event count
- Distinct ID in PostHog shows as `"null"`, `"undefined"`, or empty string

**How to avoid:**
1. Guard `identify()` behind the auth state: only call when `session?.user?.id` is truthy
2. Place the identify call in the auth context effect that fires AFTER session is restored
3. Add a runtime check: `if (!userId || userId === 'null') return;` before calling identify
4. Use `personProfiles: 'identified_only'` so anonymous events are cheaper and don't create person profiles until identify is called
5. Test by checking PostHog dashboard after first sign-in -- verify the distinct_id matches the Supabase user ID

**Phase to address:** User identification implementation phase.

**Confidence:** HIGH -- verified via [PostHog identify docs](https://posthog.com/docs/product-analytics/identify) and SDK type definitions showing `identify(distinctId?: string)` accepts undefined.

---

### Pitfall 4: Missing `reset()` on Sign-Out Leaks User Identity Across Sessions

**What goes wrong:** When a user signs out, if `posthog.reset()` is not called, the PostHog SDK retains the previous user's distinct_id. If a different user signs in on the same device (or the same user signs out and back in), all events are attributed to the PREVIOUS user's identity until `identify()` is called for the new user. For events captured between sign-out and sign-in, they will be permanently attributed to the wrong person.

**Why it happens:** PostHog persists the distinct_id to file storage (via `expo-file-system`). It survives app restarts. Without an explicit `reset()` call, the SDK does not know the user has changed.

**Consequences:**
- Events attributed to wrong user
- Person profiles contaminated with another user's behavior
- Privacy violation -- one user's activity visible on another user's profile
- Especially problematic during beta testing when testers share devices

**Warning signs:**
- After sign-out/sign-in cycle, PostHog dashboard shows events from User B under User A's profile
- Person profile has impossible behavior (events from two different geographic locations simultaneously)

**How to avoid:**
1. Call `posthog.reset()` immediately when the user signs out, BEFORE navigating to the sign-in screen
2. In the auth context, listen for the `SIGNED_OUT` auth state change event and call reset there
3. Pattern: `supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') posthog.reset() })`
4. Note: `reset()` clears ALL persisted state including super properties, anonymous ID, feature flags. This is the correct behavior for sign-out.

**Phase to address:** User identification implementation phase.

**Confidence:** HIGH -- verified via SDK type definitions (`reset()` method documented to clear all persisted properties) and [PostHog identify docs](https://posthog.com/docs/getting-started/identify-users).

---

## Moderate Pitfalls

Mistakes that cause unreliable data, wasted quota, or technical debt.

---

### Pitfall 5: Event Naming Inconsistency Makes Analytics Unusable Over Time

**What goes wrong:** Without an upfront naming convention, different parts of the codebase emit differently named events for similar actions: `createGroup`, `group_created`, `Create Group`, `create-group`. PostHog treats each as a separate event. Over time, the event list becomes polluted with duplicates and variations. Funnels break because they reference one variant while the app emits another. This is extremely difficult to fix retroactively because PostHog does not support renaming historical events.

**Why it happens:** Solo developer or small team adds events incrementally without a central reference. Each screen or feature uses whatever naming felt natural at the time.

**Consequences:**
- Duplicate events in PostHog dashboard (e.g., `add_expense` and `expense_added`)
- Funnels and insights reference the wrong event name
- Cleaning up requires finding and updating every `posthog.capture()` call in the codebase
- Historical data for the wrong-named events is lost (cannot be renamed)

**Warning signs:**
- PostHog event list shows similar-sounding events with low counts each
- Building a funnel requires guessing which event name variant is "the right one"

**How to avoid:**
1. Define an event naming convention BEFORE writing any tracking code
2. Recommended format for this app: `snake_case` with `object_action` pattern (e.g., `group_created`, `expense_added`, `invite_accepted`, `settlement_recorded`)
3. Create a single TypeScript constants file (e.g., `lib/analytics-events.ts`) that exports all event names
4. Never use string literals for event names -- always import from the constants file
5. PostHog's taxonomy plugin can enforce naming conventions server-side as a safety net

**Phase to address:** Event tracking design phase (before any capture calls are written).

**Confidence:** HIGH -- verified via [PostHog best practices](https://posthog.com/docs/product-analytics/best-practices) and [PostHog naming conventions guide](https://posthog.com/questions/best-practices-naming-convention-for-event-names-and-properties).

---

### Pitfall 6: `useEffect` Re-render Loop Fires Hundreds of Duplicate Events

**What goes wrong:** A `posthog.capture()` call inside a `useEffect` with incorrect or missing dependency management causes the effect to re-run on every render, firing the same event hundreds of times in seconds. One documented case sent 600 identical events in a few seconds because a non-memoized callback was in the dependency array.

**Why it happens:** React's `useEffect` runs when its dependencies change. If a dependency is a function that is not memoized with `useCallback`, or an object created inline, it changes on every render, causing an infinite loop. With PostHog capture inside, this means infinite events.

**Consequences:**
- Event quota burned through rapidly
- PostHog dashboard shows meaningless spike of identical events
- Battery drain on user's device (network requests for each event batch)
- Difficult to diagnose because the event IS correct -- it's just firing too many times

**Warning signs:**
- PostHog live events view shows rapid-fire identical events
- Device battery drains faster than expected
- Event counts are orders of magnitude higher than user counts

**How to avoid:**
1. Never put `posthog.capture()` in a `useEffect` without carefully auditing the dependency array
2. For screen view events, depend only on `pathname` (a string, stable reference)
3. For action events (button taps), fire on the event handler, not in a useEffect
4. Use `useRef` to track whether an event has already been fired for a given screen/action
5. In development, enable PostHog debug mode (`debug: true`) to see every event in the console

**Phase to address:** Event tracking implementation phase.

**Confidence:** HIGH -- verified via [first-hand developer account](https://medium.com/@svetlintanyi/implementing-posthog-analytics-in-a-react-native-app-a-first-time-developers-guide-cf4c8ef939f6) documenting 600 duplicate events from this exact mistake.

---

### Pitfall 7: PostHogProvider Placement Outside NavigationContainer (Layout Order Matters)

**What goes wrong:** In the existing `app/_layout.tsx`, the provider hierarchy is: `GestureHandlerRootView > AuthProvider > NetworkProvider > ToastProvider > BottomSheetModalProvider > RootNavigator`. The `PostHogProvider` must be placed carefully. If placed ABOVE the Expo Router's implicit NavigationContainer (i.e., wrapping the `<Stack>` component), certain PostHog hooks may fail. But if placed as a child of the `<Stack>`, it won't wrap all screens.

**Why it happens:** Expo Router's `<Stack>` is the NavigationContainer equivalent. PostHog documentation says "PostHogProvider must be a child of NavigationContainer" -- but with Expo Router, there IS no explicit NavigationContainer. This creates confusion about placement.

**Consequences:**
- Navigation-related PostHog hooks throw errors
- PostHog initializes but screen tracking fails silently
- Events are captured but without screen context

**Warning signs:**
- `useNavigationState` errors in console (even with captureScreens disabled, some internal hooks may fire)
- Screen name missing from events in PostHog dashboard

**How to avoid:**
1. Place `PostHogProvider` in `app/_layout.tsx` wrapping the `<Stack>` component but BELOW the `GestureHandlerRootView`
2. Disable ALL autocapture: `autocapture={false}` -- this prevents PostHog from trying to hook into navigation
3. Use the non-provider initialization pattern instead: create a PostHog instance in a separate file (`lib/posthog.ts`) and import it directly where needed, using `PostHogProvider` only for the React context (not autocapture)
4. Pattern for this app's layout:
   ```
   GestureHandlerRootView
     AuthProvider
       PostHogProvider (autocapture={false})
         NetworkProvider
           ... rest of providers ...
             RootNavigator (Stack)
   ```

**Phase to address:** SDK setup phase (PostHogProvider placement in root layout).

**Confidence:** HIGH -- verified via [PostHog issue #2740](https://github.com/PostHog/posthog-js/issues/2740), [PostHog issue #11880](https://github.com/PostHog/posthog/issues/11880), and examination of existing `app/_layout.tsx`.

---

### Pitfall 8: Events Lost During Offline/Poor Connectivity (Philippine Internet)

**What goes wrong:** PostHog's React Native SDK queues events in memory and flushes them to the server periodically. However, if the app is closed (killed) while events are still in the queue and the device is offline, those events are lost. The queue is persisted to file storage, but only configuration and user data are reliably persisted -- the event queue persistence has limitations. For Philippine users on unreliable internet (the project explicitly notes "PH internet can be unreliable"), events captured during connectivity gaps may never reach PostHog.

**Why it happens:** The SDK's queue persistence relies on `expo-file-system` writes completing before the app is terminated. If the OS kills the app (memory pressure, user swipe-to-close), pending writes may not complete. Additionally, the default `maxQueueSize` is 1000 events -- if a user is offline for an extended period, older events are dropped when the queue fills.

**Consequences:**
- Analytics data has gaps during poor connectivity periods
- Funnel analysis shows artificially lower completion rates
- Events from power users (who use the app frequently even offline) are disproportionately lost

**Warning signs:**
- Event counts are significantly lower than expected given user activity
- Users in areas with poor connectivity show fewer events than users with good connectivity
- Funnels show drop-offs at steps that don't correspond to real user behavior

**How to avoid:**
1. Accept that some event loss is inevitable for mobile analytics -- do not over-optimize
2. Keep `flushAt` at the default (20) -- lowering it to 1 wastes battery without improving reliability
3. For critical events (sign_up, first_expense_added), consider calling `posthog.flush()` immediately after capture to force a send attempt
4. Do NOT build a custom offline queue on top of PostHog -- this adds complexity disproportionate to the 5-10 user beta
5. Monitor event volumes in PostHog dashboard and compare against known user activity to detect systemic data loss

**Phase to address:** SDK configuration phase.

**Confidence:** MEDIUM -- verified via [PostHog GitHub issue #1583](https://github.com/PostHog/posthog-js/issues/1583) (offline queue limitation), but exact behavior with `expo-file-system` persistence in v4.36.0 not independently verified.

---

### Pitfall 9: `personProfiles: 'always'` Costs 4x More Than Necessary

**What goes wrong:** If `personProfiles` is not explicitly set (or set to `'always'`), every event -- including anonymous events before the user signs in -- creates a full person profile in PostHog. Identified events cost up to 4x more than anonymous events in PostHog's pricing model. For this app, where ALL users must sign in (there is no anonymous usage), using `'always'` means even the brief moments between app launch and identify() completion generate expensive identified events unnecessarily.

**Why it happens:** Developers use the default configuration without understanding the pricing implications. The `personProfiles` option is easy to overlook.

**Consequences:**
- Higher PostHog bill (4x on anonymous events that didn't need profiles)
- For a 5-10 user beta this is negligible, but becomes significant at scale
- Harder to change later: once set, changing `personProfiles` only applies to users who update their app (mobile SDKs are bundled)

**Warning signs:**
- PostHog billing shows more "identified events" than expected
- Person profiles exist for anonymous sessions that were never identified

**How to avoid:**
1. Set `personProfiles: 'identified_only'` in the PostHog configuration
2. This means events before `identify()` are captured as anonymous (cheap) and events after `identify()` are identified (creates person profile)
3. Call `identify()` as soon as the Supabase session is restored -- this maximizes the ratio of identified to anonymous events
4. For this app (all users authenticate), almost all events will be identified anyway

**Phase to address:** SDK setup phase (PostHog initialization configuration).

**Confidence:** HIGH -- verified via [PostHog anonymous vs identified events docs](https://posthog.com/docs/data/anonymous-vs-identified-events) and SDK type definitions confirming `personProfiles?: 'always' | 'identified_only' | 'never'`.

---

### Pitfall 10: Screen Names Expose Dynamic Route Parameters (PII in Analytics)

**What goes wrong:** When manually tracking screens with Expo Router's `usePathname()`, the pathname includes dynamic segments like `/group/abc123-def456` or `/group/abc123/balance/user-id-here`. If these are sent as-is to PostHog as screen names, every unique group ID and user ID creates a separate "screen" in PostHog. This both fragments screen analytics (100 groups = 100 different "screens") AND may leak user IDs or group IDs into analytics where they become hard to delete.

**Why it happens:** `usePathname()` returns the full resolved path including dynamic parameters. Developers pass this directly to `posthog.screen()` without normalizing.

**Consequences:**
- PostHog screen list has thousands of entries instead of ~10 distinct screens
- Cannot aggregate "how many users viewed a group detail screen" because each group has its own screen name
- User IDs in screen names create GDPR/DPA compliance risk (Philippine Data Privacy Act requires ability to delete personal data)
- Screen analytics dashboard is unusable

**Warning signs:**
- PostHog screen list shows paths like `/group/uuid-here` instead of `/group/[id]`
- Screen view counts are all 1 or 2 instead of meaningful aggregates

**How to avoid:**
1. Normalize pathnames before sending to PostHog: replace dynamic segments with their parameter names
2. Map actual paths to template paths: `/group/abc123` becomes `/group/[id]`, `/group/abc123/balance/user456` becomes `/group/[id]/balance/[memberId]`
3. Implementation pattern: use `useSegments()` from Expo Router to get the route segment array (which includes parameter names like `[id]`) instead of `usePathname()` which returns resolved values
4. If group or user IDs are needed for analysis, pass them as event properties (which can be filtered/deleted), not in the screen name

**Phase to address:** Screen tracking implementation phase.

**Confidence:** HIGH -- verified by examining the app's route structure (`app/group/[id].tsx`, `app/group/[id]/balance/[memberId].tsx`) and understanding of `usePathname()` vs `useSegments()` behavior.

---

## Minor Pitfalls

Mistakes that cause annoyance or minor data quality issues but are quickly fixable.

---

### Pitfall 11: Debug Mode Left Enabled in Production Build

**What goes wrong:** Setting `debug: true` in PostHog options causes verbose logging of every captured event, identify call, and flush operation to the console. If left enabled in a production EAS build, it creates console noise, slightly impacts performance (string serialization of every event), and may expose PostHog API keys or user data in device logs that could be read by other apps or crash reporters.

**How to avoid:**
1. Use environment-based configuration: `debug: __DEV__`
2. Alternatively: `debug: process.env.EXPO_PUBLIC_POSTHOG_DEBUG === 'true'`
3. Verify by checking console output in a production build before distributing

**Phase to address:** SDK setup phase.

**Confidence:** HIGH -- verified via SDK type definitions and PostHog documentation.

---

### Pitfall 12: `$set` vs `$set_once` Confusion Overwrites First-Touch Properties

**What goes wrong:** Using `$set` (or the default behavior of `identify()` with properties) for properties that should only be set once (like `first_sign_in_date`, `signup_method`, or `initial_app_version`) means these values get overwritten every time `identify()` is called. If you track `signup_method: 'apple'` with `$set` and later call identify with `signup_method: undefined`, the property is overwritten.

**How to avoid:**
1. Use `$set_once` for properties that should never change: `posthog.identify(userId, { $set_once: { first_sign_in_date: new Date().toISOString(), signup_method: 'apple' } })`
2. Use `$set` for properties that update: `posthog.identify(userId, { $set: { display_name: name, group_count: 3 } })`
3. Rule of thumb: if a property describes when/how the user FIRST did something, use `$set_once`. If it describes the user's CURRENT state, use `$set`.

**Phase to address:** User identification implementation phase.

**Confidence:** HIGH -- verified via SDK type definitions showing `identify()` accepts `$set` and `$set_once` in properties.

---

### Pitfall 13: PostHog API Key Hardcoded Instead of Using Environment Variables

**What goes wrong:** The PostHog project API key is hardcoded directly in the source file (e.g., `app/_layout.tsx`). While PostHog project API keys are designed to be public (they can only ingest events, not read data), hardcoding makes it impossible to use different PostHog projects for development vs production without code changes. This leads to development events polluting production analytics.

**How to avoid:**
1. Use Expo's environment variables: `EXPO_PUBLIC_POSTHOG_KEY` and `EXPO_PUBLIC_POSTHOG_HOST`
2. Access via `process.env.EXPO_PUBLIC_POSTHOG_KEY` (Expo SDK 54 supports this natively)
3. Create separate PostHog projects for development and production
4. For the beta (5-10 users), a single project is fine -- but set up the env var pattern now to avoid migration later
5. Add `.env` to `.gitignore` and use `.env.example` for documentation

**Phase to address:** SDK setup phase.

**Confidence:** HIGH -- standard practice, verified via Expo environment variables documentation.

---

### Pitfall 14: Forgetting to Flush on App Background Loses Recent Events

**What goes wrong:** The default `flushAt` is 20, meaning PostHog waits until 20 events are queued before sending. If a user performs 5 actions and then backgrounds/closes the app, those 5 events may not have been flushed. The periodic `flushInterval` timer may also not have fired. These events are persisted to file storage but only sent on next app open.

**How to avoid:**
1. Enable `captureAppLifecycleEvents: true` -- this captures `Application Backgrounded` events which trigger a flush
2. Optionally, add an AppState listener that calls `posthog.flush()` when the app transitions to `background` or `inactive`
3. For the beta, this is low risk -- events will be sent on next app open. Only matters if analyzing real-time behavior.

**Phase to address:** SDK configuration phase.

**Confidence:** MEDIUM -- SDK type definitions confirm `captureAppLifecycleEvents` option exists (default false). Exact flush-on-background behavior not independently verified in v4.36.0.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| String literals for event names | Faster to write | Inconsistent naming, hard to refactor | Never -- always use constants file |
| Skip `reset()` on sign-out | One less thing to implement | Identity leakage across users | Never -- always implement reset |
| Use `personProfiles: 'always'` | Simpler config | 4x higher cost on anonymous events | Acceptable for 5-10 user beta |
| Hardcode API key | No env setup needed | Dev events pollute production | Acceptable for beta if single project |
| Skip `before_send` filtering | Faster setup | PII in analytics, compliance risk | Acceptable if no sensitive data in event properties |
| Use `usePathname()` directly | Simple implementation | Fragmented screen analytics | Never -- normalize to route templates from day one |
| Skip `flush()` on background | No extra code | Some events delayed until next open | Acceptable for beta |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Expo Router + PostHog | Enable `autocapture.captureScreens` | Disable autocapture entirely; use manual `posthog.screen()` with `usePathname()`/`useSegments()` |
| Expo Router + PostHog | Enable `autocapture.captureTouches` | Disable; use explicit `posthog.capture()` on important interactions |
| Supabase Auth + PostHog identify | Call `identify()` on PostHog init | Wait for auth state to resolve; call `identify()` only when `session?.user?.id` is truthy |
| Supabase Auth + PostHog reset | Forget to call `reset()` on sign-out | Listen for `SIGNED_OUT` event in `onAuthStateChange` and call `posthog.reset()` |
| Expo SDK 54 + PostHog | Use outdated PostHog version | Ensure `posthog-react-native >= 4.4.1` for `expo-file-system` v19+ compatibility (this app has v4.36.0, which is fine) |
| React Native New Architecture + PostHog | Assume incompatibility | PostHog v4.x is pure JS using Expo libraries; works with New Architecture enabled (this app has `newArchEnabled: true`) |
| PostHog Provider + Auth Provider | Place PostHog above AuthProvider | Place PostHog below AuthProvider so identify/reset hooks have access to auth state |
| Dynamic routes + screen names | Pass resolved pathnames to `posthog.screen()` | Normalize dynamic segments to template paths (e.g., `/group/[id]`) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `flushAt: 1` (immediate send) | Battery drain, excessive network requests | Keep default `flushAt: 20` | Noticeable with frequent events (10+ per minute) |
| Capturing in useEffect without deps | 600+ duplicate events in seconds | Audit all useEffect dependency arrays; use event handlers instead | Immediately on affected screen |
| Enabling session replay (not in scope but tempting) | Significant battery/data usage | Don't enable for this milestone | Immediately on poor connections |
| Large event properties | Slow serialization, large payloads | Keep properties minimal; don't attach full objects, only IDs and counts | At scale (100+ events with large props) |
| Not disabling in development | Dev events count toward quota | Use `disabled: false` with env check or separate dev project | Only matters if quota is limited |

---

## Security/Privacy Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Sending phone numbers in event properties | PII in analytics; DPA compliance violation | Never include phone numbers in capture() properties; use anonymized user IDs only |
| Sending expense amounts as user properties | Financial data in analytics | Only send aggregate properties (e.g., `total_expenses_count: 5`), not individual amounts |
| Sending group names or member names in events | PII exposure | Use group IDs and member counts, not names |
| Not implementing opt-out mechanism | Philippine Data Privacy Act violation | Implement `posthog.optOut()` / `posthog.optIn()` toggle in profile settings; DPA requires consent for analytics |
| API key in public git repo | Low risk (project keys are ingest-only) but bad practice | Use environment variables; add `.env` to `.gitignore` |
| Not having a privacy policy | App Store rejection risk; DPA non-compliance | Create a privacy policy disclosing analytics collection before public launch |
| Logging PostHog events in production console | User data visible in device logs | Set `debug: __DEV__` to disable verbose logging in production |

### Philippine Data Privacy Act (RA 10173) Specific Considerations

The Philippine Data Privacy Act of 2012 (DPA) has requirements relevant to PostHog analytics:

1. **Consent requirement:** Analytics tracking (non-essential data processing) requires informed consent. For a private beta with friends, verbal/implicit consent is pragmatically sufficient, but for public launch, implement an opt-in/opt-out mechanism.
2. **Purpose limitation:** Data collected for analytics must only be used for analytics. PostHog's data stays within PostHog.
3. **Right to erasure:** Users can request deletion of their data. PostHog supports person deletion via the dashboard and API.
4. **Data minimization:** Only collect what you need. Don't track screen content, input values, or financial details in events.
5. **For the beta:** With 5-10 close friends as testers, DPA compliance is low risk. But set up the patterns (opt-out toggle, minimal data collection) now to avoid retrofitting later.

---

## "Looks Done But Isn't" Checklist

After implementing PostHog analytics, verify all of these:

- [ ] PostHog dashboard shows events from a real device (not just simulator/dev)
- [ ] Distinct IDs in PostHog match Supabase user IDs (not anonymous UUIDs)
- [ ] Screen names in PostHog are normalized (e.g., `/group/[id]` not `/group/abc123`)
- [ ] Sign-out followed by sign-in with different user shows separate persons in PostHog
- [ ] No phone numbers, names, or financial amounts appear in event properties
- [ ] Events fire exactly once per user action (no duplicate events from re-renders)
- [ ] `debug: true` is NOT set in production configuration
- [ ] PostHog API key is not hardcoded (uses environment variable)
- [ ] Event names follow consistent `snake_case` `object_action` convention
- [ ] `captureAppLifecycleEvents` is enabled (for app open/background tracking)
- [ ] `autocapture` is disabled (both `captureScreens` and `captureTouches` set to false)
- [ ] `personProfiles` is set to `'identified_only'`
- [ ] Funnel from sign-in to first expense can be constructed in PostHog dashboard
- [ ] Profile settings has a future-ready spot for analytics opt-out (even if not exposed in beta)

---

## Sources

- [PostHog React Native SDK Documentation](https://posthog.com/docs/libraries/react-native)
- [PostHog React Native SDK Reference](https://posthog.com/docs/references/posthog-react-native)
- [PostHog GitHub Issue #2740: Expo Router autocapture crash](https://github.com/PostHog/posthog-js/issues/2740) -- closed as "not planned", official guidance to disable captureScreens
- [PostHog GitHub Issue #2455: useNavigationState error](https://github.com/PostHog/posthog-js/issues/2455)
- [PostHog GitHub Issue #171: Expo Router touch events not supported](https://github.com/PostHog/posthog-js-lite/issues/171) -- open, "help wanted"
- [PostHog GitHub Issue #2229: Expo SDK 54 breaks PostHog](https://github.com/PostHog/posthog-js/issues/2229) -- fixed in v4.4.1+
- [PostHog GitHub Issue #1583: Offline event queue limitations](https://github.com/PostHog/posthog-js/issues/1583)
- [PostHog Identifying Users Documentation](https://posthog.com/docs/product-analytics/identify)
- [PostHog Anonymous vs Identified Events](https://posthog.com/docs/data/anonymous-vs-identified-events)
- [PostHog Event Naming Best Practices](https://posthog.com/docs/product-analytics/best-practices)
- [PostHog Naming Conventions Discussion](https://posthog.com/questions/best-practices-naming-convention-for-event-names-and-properties)
- [PostHog Privacy/Data Collection Controls](https://posthog.com/docs/privacy/data-collection)
- [PostHog React Native Changelog](https://github.com/PostHog/posthog-js-lite/blob/main/posthog-react-native/CHANGELOG.md)
- [PostHog Expo Example Repository](https://github.com/PostHog/support-rn-expo)
- [Philippine Data Privacy Act (RA 10173)](https://privacy.gov.ph/data-privacy-act/)
- [IAPP Summary: Philippines Data Privacy Act](https://iapp.org/news/a/summary-philippines-data-protection-act-and-implementing-regulations)
- [Medium: PostHog React Native First-Time Guide](https://medium.com/@svetlintanyi/implementing-posthog-analytics-in-a-react-native-app-a-first-time-developers-guide-cf4c8ef939f6) -- documents the 600-duplicate-events bug
- Installed SDK: `posthog-react-native@4.36.0` type definitions (direct inspection)
- Project codebase: `app/_layout.tsx`, `lib/auth-context.tsx`, `app.json`, `package.json`

---

*Pitfalls research for: PostHog analytics in Expo/React Native (HatianApp v1.4)*
*Researched: 2026-02-24*
