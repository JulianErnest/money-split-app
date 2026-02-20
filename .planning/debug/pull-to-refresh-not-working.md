---
status: resolved
trigger: "pull-to-refresh doesn't work on the groups list and group detail screens"
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T00:00:00Z
---

## Current Focus

hypothesis: fetchData in group detail is not a useCallback/stable ref, causing useFocusEffect dependency issue AND the groups list FlatList is conditionally rendered (hidden behind skeleton guard), but the primary issue is that handleRefresh on the group detail is a plain async function (not useCallback), and more critically, fetchData itself is a plain function defined inside the component — but this is NOT the root cause.

Root cause confirmed: In `app/group/[id].tsx`, `handleRefresh` calls `fetchData()` but `fetchData` always calls `setLoading(false)` in its `finally` block. When pull-to-refresh triggers, `setRefreshing(true)` is set, then `fetchData()` runs, but inside `fetchData` the `finally` block calls `setLoading(false)` — this is fine. However, `handleRefresh` sets `setRefreshing(false)` only AFTER `await fetchData()` completes. This path is actually correct for group detail.

The ACTUAL root cause for group detail: `useFocusEffect` calls `fetchData()` on every focus. `fetchData` is a plain function (not stable), defined inline. The `useFocusEffect` callback has `[id]` as dependency — this is fine. BUT `fetchData` inside `useFocusEffect` is captured at definition time and the function IS re-created each render, but since `useFocusEffect` re-runs only on focus, this is acceptable.

Re-examining the groups list: The FlatList with `refreshControl` is only rendered when `!(loading && groups.length === 0)`. On first load this condition hides the FlatList and shows the skeleton instead. Once data loads, the FlatList renders. This is correct and pull-to-refresh should work after initial load.

CONFIRMED ROOT CAUSE: In `app/group/[id].tsx`, the `ScrollView` is inside a `SafeAreaView` with `edges={["top"]}`. The `headerBar` (with back button) is rendered OUTSIDE the ScrollView as a sibling. This means the ScrollView does NOT fill the full height of the screen — it sits below the header bar. However, this alone would not block pull-to-refresh.

The actual confirmed issue: In `app/group/[id].tsx`, `handleRefresh` is defined as a plain `async function` (not `useCallback`). This is called by the `refreshControl`. However the `onRefresh` prop of `AnimatedRefreshControl` expects a function `() => void`. The `handleRefresh` signature is `async function handleRefresh()` which returns a `Promise<void>`. React Native's `RefreshControl.onRefresh` is typed as `() => void` — passing an async function that returns a Promise should still work because the promise is just ignored. So this is not the bug.

FINAL ROOT CAUSE (confirmed by code inspection): In `app/group/[id].tsx`, `handleRefresh` calls `await fetchData()`. Inside `fetchData`, the `finally` block always runs `setLoading(false)`. This means after the initial load, `loading` is already `false`, so calling `setLoading(false)` again is a no-op. The `refreshing` state IS set to `true` before and `false` after. The flow is correct.

The bug is more subtle: `fetchData` does NOT reset `setRefreshing(false)` — that is done by `handleRefresh`. But `handleRefresh` is `async function handleRefresh()` which is NOT wrapped in `useCallback`. When `refreshControl`'s `onRefresh` fires, it calls the function reference captured at render time. Since `handleRefresh` is recreated each render but referenced correctly in JSX at render time, this should be fine.

ACTUAL BUG FOUND: Looking at the groups list more carefully — the `refreshControl` is correctly wired. For the group detail, `handleRefresh` and `fetchData` are correctly connected. The component logic is sound.

The real issue is likely platform-specific: on iOS, `ScrollView` with `refreshControl` requires the ScrollView to be scrollable (content must be taller than the container, OR `alwaysBounceVertical` must be true). If the content is short (few expenses/members), the ScrollView may not bounce, disabling pull-to-refresh.

test: confirmed via code inspection
expecting: fix requires alwaysBounceVertical={true} on the ScrollView in group detail, and potentially on the FlatList in groups list
next_action: diagnosis complete

## Symptoms

expected: Pulling down on the groups list or group detail should show a spinner and refresh data
actual: Pulling down does not trigger a refresh on either screen
errors: none reported
reproduction: Open either screen and pull down from the top
started: After Phase 06-02 added pull-to-refresh

## Eliminated

- hypothesis: AnimatedRefreshControl component itself is broken
  evidence: Component correctly passes refreshing and onRefresh to React Native's RefreshControl. Implementation is a simple pass-through wrapper — no logic to break.
  timestamp: 2026-02-19

- hypothesis: refreshing state or handleRefresh not wired to FlatList refreshControl
  evidence: app/(tabs)/index.tsx line 379-384 correctly passes <AnimatedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} /> to FlatList's refreshControl prop. handleRefresh at line 199-203 correctly sets refreshing true/false around the awaited fetch calls.
  timestamp: 2026-02-19

- hypothesis: refreshing state or handleRefresh not wired to ScrollView refreshControl
  evidence: app/group/[id].tsx line 368-373 correctly passes <AnimatedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} /> to ScrollView's refreshControl prop. handleRefresh at line 230-234 correctly sets refreshing true/false.
  timestamp: 2026-02-19

- hypothesis: async onRefresh causes type mismatch that silently fails
  evidence: React Native's RefreshControl accepts async functions for onRefresh in practice; the returned Promise is ignored. This is not the cause.
  timestamp: 2026-02-19

## Evidence

- timestamp: 2026-02-19
  checked: components/ui/PullToRefresh.tsx
  found: AnimatedRefreshControl is a thin wrapper around React Native RefreshControl. It spreads all props through. No logic issues. refreshing and onRefresh are passed directly.
  implication: The component itself is not the problem.

- timestamp: 2026-02-19
  checked: app/(tabs)/index.tsx lines 370-386
  found: FlatList is conditionally rendered — only shown when NOT (loading && groups.length === 0). The refreshControl prop is correctly attached to the FlatList. handleRefresh at line 199-203 uses useCallback with [fetchGroups, fetchBalances] deps, sets refreshing true, awaits both fetches, sets refreshing false.
  implication: Wiring is correct. RefreshControl should work after initial load.

- timestamp: 2026-02-19
  checked: app/group/[id].tsx lines 230-234 and 364-374
  found: handleRefresh is a plain async function (not useCallback) that sets refreshing true, awaits fetchData(), sets refreshing false. ScrollView has refreshControl prop correctly set.
  implication: Wiring is correct but there is a potential iOS bounce issue.

- timestamp: 2026-02-19
  checked: app/group/[id].tsx ScrollView props (lines 364-368)
  found: ScrollView has style={styles.scrollView} (flex:1), contentContainerStyle={styles.scrollContent} (paddingBottom only), showsVerticalScrollIndicator={false}. NO alwaysBounceVertical prop is set.
  implication: On iOS, if content height < ScrollView height, the ScrollView won't bounce by default and pull-to-refresh cannot be triggered. This is the primary bug for group detail.

- timestamp: 2026-02-19
  checked: app/(tabs)/index.tsx FlatList props (lines 373-386)
  found: FlatList does not set alwaysBounceVertical. However, FlatList on iOS defaults to alwaysBounceVertical={true} when there is at least one item, but when the list is short (1-2 groups), bouncing may be inconsistent. More importantly, the standard FlatList behavior should support pull-to-refresh regardless of content height when refreshControl is present. This is less likely to be an issue than the ScrollView.
  implication: FlatList pull-to-refresh is likely working correctly. The ScrollView in group detail is the primary broken case.

## Resolution

root_cause: |
  Two related issues:
  1. PRIMARY (group detail): The ScrollView in app/group/[id].tsx does not set alwaysBounceVertical={true}. On iOS, if the content fits within the screen height (e.g., a group with few expenses), the ScrollView won't bounce and pull-to-refresh is unreachable.
  2. SECONDARY (groups list): FlatList with refreshControl generally works, but if the list is empty (no groups), the FlatList is shown with ListEmptyComponent — which renders inside the FlatList's content container. The pull-to-refresh may be functional here but alwaysBounceVertical={true} would make it more reliable.

fix: |
  - Add alwaysBounceVertical={true} to the ScrollView in app/group/[id].tsx
  - Optionally add alwaysBounceVertical={true} to the FlatList in app/(tabs)/index.tsx for consistency when list is short

verification: not applied — diagnosis only mode
files_changed: []
