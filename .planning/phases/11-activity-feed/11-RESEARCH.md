# Phase 11: Activity Feed - Research

**Researched:** 2026-02-21
**Domain:** React Native activity feed, Supabase cross-table queries, FlatList pagination
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Relative timestamps ("2h ago", "Yesterday") -- not absolute dates
- Flat chronological list on dashboard -- no day headers for the 5-item preview
- Skeleton row loading -- shimmer placeholders while data loads, matching existing app patterns
- Time-limited: only show items from the last 30 days; if nothing recent, show empty state
- Separate screen -- dedicated Activity History screen with back navigation
- No filtering -- just a chronological list, no group or type filters
- Infinite scroll for loading more items
- Day headers on the full history screen ("Today", "Yesterday", "Feb 20") -- helps scan longer lists

### Claude's Discretion
- Activity item visual design (icons, colors, avatars, info hierarchy)
- Dashboard section ordering optimization
- Section header design
- Empty state design
- What qualifies as "activity" (scope of items shown)
- Navigation target on item tap

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

This phase replaces the "Coming soon" activity placeholder on the home screen dashboard with a real activity feed showing the 5 most recent expenses and settlements merged chronologically across all of the user's groups. It also adds a dedicated "Activity History" screen accessible via a "See all" link, with infinite scroll and day headers.

The core challenge is querying two separate Supabase tables (`expenses` and `settlements`) and merging them into a single chronological feed. Since the Supabase JavaScript client does not support UNION queries, the best approach is a **Supabase RPC (PostgreSQL function)** that performs a `UNION ALL` of both tables, returning a unified activity row type. This follows the same pattern used throughout the app (e.g., `get_my_group_balances`, `get_group_balances`). For the "See all" screen with infinite scroll, the RPC accepts offset/limit parameters for cursor-free pagination.

The existing codebase provides all the UI building blocks needed: `Card`, `Text` (with all variant/color props), `Avatar`, `Skeleton` (shimmer patterns from moti), `EmptyState`, and the dashboard's `ListHeaderComponent` pattern from Phase 10. The activity section replaces the placeholder in the existing `dashboardHeader` useMemo block. The new Activity History screen follows the existing screen pattern (SafeAreaView + back button + ScrollView/FlatList).

**Primary recommendation:** Create a Supabase RPC `get_recent_activity` that UNIONs expenses and settlements with group names and payer names, returning a unified activity type. Render activity items in the existing dashboard header, and add a new `/activity` route for the full history screen with FlatList infinite scroll.

## Standard Stack

This phase uses ONLY existing project dependencies plus one new Supabase migration. No new npm packages required.

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native | 0.81.5 | Core framework, FlatList for infinite scroll | Already in project |
| expo-router | ~6.0.23 | Navigation to activity history screen | Already in project |
| @supabase/supabase-js | ^2.96.0 | RPC calls for activity data | Already in project |
| moti | ^0.30.0 | Skeleton shimmer placeholders | Already used for skeletons throughout |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-haptics | ~15.0.8 | Haptic feedback on tap | Activity item press |
| react-native-safe-area-context | ~5.6.0 | Safe area on history screen | Already used in all screens |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase RPC (UNION) | Two separate queries merged client-side | RPC is cleaner, handles sorting/pagination server-side, single network call |
| Database View | RPC function | View would work but RPC gives more control over parameters (limit, offset, date filter) |
| Cursor-based pagination | Offset/limit pagination | Cursor is better for real-time feeds, but offset/limit is simpler and sufficient for historical data that rarely changes mid-scroll |

**Installation:**
```bash
# No new packages needed
# One new Supabase migration file required
```

## Architecture Patterns

### Data Architecture: Unified Activity Type

The RPC returns a unified row type that covers both expenses and settlements:

```typescript
interface ActivityItem {
  id: string;           // expense.id or settlement.id
  type: "expense" | "settlement";
  description: string;  // expense description or "Settlement"
  amount: number;       // pesos (numeric from DB)
  payer_name: string;   // who paid
  payer_id: string;     // for navigation
  group_name: string;   // which group
  group_id: string;     // for navigation
  expense_id: string | null;  // non-null for expenses (for detail navigation)
  created_at: string;   // ISO timestamp
}
```

### RPC Design: `get_recent_activity`

```sql
-- Returns recent activity across all user's groups
-- UNION ALL of expenses and settlements, ordered by created_at DESC
-- Accepts p_limit and p_offset for pagination
-- Accepts p_since (timestamptz) for 30-day filtering
create or replace function public.get_recent_activity(
  p_limit integer default 5,
  p_offset integer default 0,
  p_since timestamptz default (now() - interval '30 days')
)
returns table(
  id uuid,
  type text,
  description text,
  amount numeric(10,2),
  payer_name text,
  payer_id uuid,
  group_name text,
  group_id uuid,
  expense_id uuid,
  created_at timestamptz
)
```

The RPC:
1. Finds all groups the user is a member of (via `group_members`)
2. SELECTs expenses from those groups with `created_at >= p_since`
3. UNION ALLs with settlements from those groups with `created_at >= p_since`
4. Orders by `created_at DESC`
5. Applies `LIMIT p_limit OFFSET p_offset`

### Pattern 1: Dashboard Activity Section (replacing placeholder)

**What:** Replace the "Coming soon" placeholder in the existing `dashboardHeader` useMemo with real activity items
**When to use:** Home screen dashboard, showing top 5 items

The existing dashboard header in `app/(tabs)/index.tsx` (line 613-644) has:
```typescript
const dashboardHeader = useMemo(() => (
  <View>
    <BalanceSummaryHeader ... />
    {groups.length > 0 && (
      <>
        <View style={styles.sectionDivider} />
        <View style={styles.activitySection}>
          <Text variant="label" color="textSecondary">Recent Activity</Text>
          <Text variant="caption" color="textTertiary" style={styles.activityPlaceholder}>
            Coming soon
          </Text>
        </View>
        <View style={styles.sectionDivider} />
      </>
    )}
  </View>
), [netBalance, groups.length]);
```

This gets replaced with actual activity items (fetched via the new RPC) plus a "See all" link.

### Pattern 2: Activity History Screen (new route)

**What:** New screen at `app/activity.tsx` using FlatList with `onEndReached` for infinite scroll
**When to use:** "See all" navigation target

```
app/
  activity.tsx          # New: Activity History screen
```

This screen:
- Uses FlatList (not SectionList) with data grouped by day for rendering headers
- Implements `onEndReached` + `onEndReachedThreshold` for infinite scroll
- Calls the same RPC with increasing offset
- Shows day headers ("Today", "Yesterday", "Feb 20") via section-like rendering

### Pattern 3: Relative Timestamp Formatting

**What:** Convert ISO timestamps to relative strings ("2h ago", "Yesterday", "3d ago")
**When to use:** Dashboard activity items (5-item preview)

```typescript
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

### Pattern 4: Day Header Grouping (full history screen)

**What:** Group activity items by day for the full history screen
**When to use:** Activity History screen with day headers

```typescript
function getDayKey(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDay.getTime() === today.getTime()) return "Today";
  if (itemDay.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

### Pattern 5: FlatList Infinite Scroll

**What:** Load more activity items when user scrolls near bottom
**When to use:** Activity History screen

```typescript
const PAGE_SIZE = 20;
const [activities, setActivities] = useState<ActivityItem[]>([]);
const [offset, setOffset] = useState(0);
const [hasMore, setHasMore] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);

async function loadMore() {
  if (loadingMore || !hasMore) return;
  setLoadingMore(true);
  const { data } = await supabase.rpc("get_recent_activity", {
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });
  if (data && data.length > 0) {
    setActivities(prev => [...prev, ...data]);
    setOffset(prev => prev + data.length);
    if (data.length < PAGE_SIZE) setHasMore(false);
  } else {
    setHasMore(false);
  }
  setLoadingMore(false);
}

<FlatList
  data={activities}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
  ListFooterComponent={loadingMore ? <ActivityIndicator /> : null}
/>
```

### Recommended File Structure
```
app/
  activity.tsx                    # NEW: Activity History screen
lib/
  activity.ts                     # NEW: ActivityItem type, fetch functions, formatting utils
components/
  ui/Skeleton.tsx                 # MODIFIED: Add ActivityItemSkeleton
app/(tabs)/
  index.tsx                       # MODIFIED: Replace activity placeholder with real feed
supabase/migrations/
  00022_activity_feed_rpc.sql     # NEW: get_recent_activity RPC
lib/
  database.types.ts               # MODIFIED: Add get_recent_activity function type
```

### Anti-Patterns to Avoid
- **Don't fetch all expenses + all settlements and merge client-side:** This does not scale and wastes bandwidth. Use a server-side UNION via RPC.
- **Don't use SectionList for the history screen:** The day headers change dynamically as data loads. Use FlatList with inline day header rendering (check if current item's day differs from previous item's day, render header if so).
- **Don't query without the 30-day filter on the dashboard:** Without a time filter, the RPC scans all historical data. The 30-day filter is a user decision and also a performance optimization.
- **Don't re-render the entire dashboard header on every activity change:** The `dashboardHeader` is wrapped in `useMemo`; make sure the activity data dependency is included but doesn't cause unnecessary re-renders.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Merging expenses + settlements | Client-side array merge + sort | Supabase RPC with UNION ALL | Single query, server-sorted, paginated |
| Relative time formatting | Import a library (timeago.js, date-fns) | Simple custom function (~15 lines) | Too simple to justify a dependency; only needs "Xm ago", "Xh ago", "Yesterday", "Xd ago" |
| Peso formatting | Custom number formatting | Existing `formatPeso()` from `lib/expense-utils.ts` | Already handles locale, commas, decimals |
| Skeleton loading | Custom shimmer implementation | Existing `moti/skeleton` + `Skeleton.Group` pattern from `components/ui/Skeleton.tsx` | Already used throughout the app |
| Empty state display | Custom empty message | Existing `EmptyState` component | Already accepts emoji, headline, subtext |
| Activity item card | New card component from scratch | Compose with existing `Card`, `Text`, `Avatar` components | Maintains design consistency |

**Key insight:** The only genuinely new code is the Supabase RPC (SQL), the activity lib module (TypeScript types + fetch functions + formatters), the ActivityItem component, and the Activity History screen. Everything else is composition of existing building blocks.

## Common Pitfalls

### Pitfall 1: N+1 Query Problem for Group/User Names
**What goes wrong:** Fetching activity items without joining group names and payer names, then making separate queries per item to resolve names.
**Why it happens:** The expenses and settlements tables store UUIDs, not display strings.
**How to avoid:** The RPC must JOIN `groups.name` and `users.display_name` in the SQL query itself. Return denormalized rows with `group_name` and `payer_name` included.
**Warning signs:** Multiple network calls when rendering the activity feed, or activity items showing UUIDs instead of names.

### Pitfall 2: Offset Pagination Drift
**What goes wrong:** New activity items are created while the user is scrolling the history, causing items to shift and some to be duplicated or skipped at page boundaries.
**Why it happens:** Offset-based pagination is not stable when data is inserted during pagination.
**How to avoid:** For this app, this is acceptable because:
1. The activity feed is read-only (no real-time inserts during viewing)
2. New items are added at the top, while pagination loads from the top down
3. The worst case is a duplicate item appearing, which is cosmetic
If this becomes a problem later, switch to cursor-based pagination (`WHERE created_at < :last_seen_at`).
**Warning signs:** Duplicate items appearing in the infinite scroll list.

### Pitfall 3: Settlement Amount Units (Pesos vs Centavos)
**What goes wrong:** Displaying settlement amounts incorrectly because the DB stores pesos (numeric) but the app uses centavos (integers) for math.
**Why it happens:** The existing codebase has `Math.round(amount * 100)` conversions scattered throughout (e.g., ExpenseCard, group detail). The RPC returns pesos.
**How to avoid:** In the ActivityItem component, always convert `amount * 100` to centavos before passing to `formatPeso()`. Or display directly using `formatPeso(Math.round(item.amount * 100))`.
**Warning signs:** Amounts showing as 1/100th of the correct value, or amounts showing with too many decimal places.

### Pitfall 4: Empty Activity Section Taking Up Space
**What goes wrong:** When no activity exists in the last 30 days, the activity section on the dashboard shows an empty state that wastes vertical space, pushing groups further down.
**Why it happens:** The user noted that pending invites already push groups lower. An empty activity section makes this worse.
**How to avoid:** When activity is empty AND there are no groups, hide the entire activity section. When activity is empty but groups exist, show a compact empty state (1-2 lines, no large emoji). Keep the section minimal when empty.
**Warning signs:** User must scroll excessively to see their groups.

### Pitfall 5: Navigation Target Ambiguity
**What goes wrong:** Tapping an expense activity item should navigate somewhere useful, but the expense detail screen requires `group_id` in the URL path (`/group/[id]/expense/[expenseId]`). Without the group_id, navigation fails.
**Why it happens:** The expense detail route is nested under the group route: `app/group/[id]/expense/[expenseId].tsx`.
**How to avoid:** The RPC must return `group_id` for every activity item. Navigation for expenses uses `router.push(/group/${groupId}/expense/${expenseId})`. For settlements, navigate to the group detail: `router.push(/group/${groupId})`.
**Warning signs:** Navigation crashes or goes to wrong screen when tapping activity items.

### Pitfall 6: Dashboard Section Ordering with Invites
**What goes wrong:** The user specifically noted that pending invites push groups lower on the dashboard. Adding the activity section between balance and groups makes this worse if invites also appear above groups.
**Why it happens:** Current section order: Balance Header > Activity Placeholder > Pending Invites Section > My Groups Section. Invites take significant vertical space.
**How to avoid:** Reorder sections to: Balance Header > Activity Section > My Groups Section > Pending Invites Section (at bottom). Or compress invites into a compact banner. This is Claude's discretion per CONTEXT.md.
**Warning signs:** Groups are below the fold on most devices.

## Code Examples

### Supabase RPC: get_recent_activity
```sql
-- Source: Custom for this project, following existing RPC patterns
create or replace function public.get_recent_activity(
  p_limit integer default 5,
  p_offset integer default 0,
  p_since timestamptz default (now() - interval '30 days')
)
returns table(
  id uuid,
  type text,
  description text,
  amount numeric(10,2),
  payer_name text,
  payer_id uuid,
  group_name text,
  group_id uuid,
  expense_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  with my_groups as (
    select gm.group_id
    from group_members gm
    where gm.user_id = current_user_id
  )
  -- Expenses
  select
    e.id,
    'expense'::text as type,
    e.description,
    e.amount,
    coalesce(u.display_name, 'Unknown') as payer_name,
    e.paid_by as payer_id,
    g.name as group_name,
    e.group_id,
    e.id as expense_id,
    e.created_at
  from expenses e
  join groups g on g.id = e.group_id
  join users u on u.id = e.paid_by
  where e.group_id in (select mg.group_id from my_groups mg)
    and e.created_at >= p_since

  union all

  -- Settlements
  select
    s.id,
    'settlement'::text as type,
    'Settlement'::text as description,
    s.amount,
    coalesce(u.display_name, 'Unknown') as payer_name,
    s.paid_by as payer_id,
    g.name as group_name,
    s.group_id,
    null::uuid as expense_id,
    s.created_at
  from settlements s
  join groups g on g.id = s.group_id
  join users u on u.id = s.paid_by
  where s.group_id in (select mg.group_id from my_groups mg)
    and s.created_at >= p_since

  order by created_at desc
  limit p_limit
  offset p_offset;
end;
$$;
```

### TypeScript Activity Types and Fetch
```typescript
// Source: New lib/activity.ts following existing patterns
import { supabase } from "@/lib/supabase";

export interface ActivityItem {
  id: string;
  type: "expense" | "settlement";
  description: string;
  amount: number; // pesos from DB
  payer_name: string;
  payer_id: string;
  group_name: string;
  group_id: string;
  expense_id: string | null;
  created_at: string;
}

export async function fetchRecentActivity(
  limit: number = 5,
  offset: number = 0,
): Promise<ActivityItem[]> {
  const { data, error } = await supabase.rpc("get_recent_activity", {
    p_limit: limit,
    p_offset: offset,
  });
  if (error || !data) return [];
  return data as ActivityItem[];
}
```

### Relative Timestamp Formatter
```typescript
// Source: New lib/activity.ts
export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

### Day Header Grouping for History Screen
```typescript
// Source: New lib/activity.ts
export function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDay.getTime() === today.getTime()) return "Today";
  if (itemDay.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

### Activity Item Skeleton
```typescript
// Source: Following existing Skeleton.tsx patterns (moti/skeleton)
export function ActivityItemSkeleton() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[2] }}>
      <Skeleton
        colorMode={COLOR_MODE}
        colors={[...SKELETON_COLORS]}
        radius="round"
        width={32}
        height={32}
      />
      <View style={{ flex: 1, gap: spacing[1] }}>
        <Skeleton colorMode={COLOR_MODE} colors={[...SKELETON_COLORS]} radius={radius.md} width="65%" height={14} />
        <Skeleton colorMode={COLOR_MODE} colors={[...SKELETON_COLORS]} radius={radius.md} width="40%" height={12} />
      </View>
      <Skeleton colorMode={COLOR_MODE} colors={[...SKELETON_COLORS]} radius={radius.md} width={60} height={14} />
    </View>
  );
}
```

### Updating database.types.ts
```typescript
// Source: Following existing pattern in lib/database.types.ts
// Add to Functions section:
get_recent_activity: {
  Args: {
    p_limit?: number;
    p_offset?: number;
    p_since?: string;
  };
  Returns: Array<{
    id: string;
    type: string;
    description: string;
    amount: number;
    payer_name: string;
    payer_id: string;
    group_name: string;
    group_id: string;
    expense_id: string | null;
    created_at: string;
  }>;
};
```

## Discretionary Recommendations

These are Claude's recommendations for items marked as "Claude's discretion" in CONTEXT.md.

### Activity Item Visual Design
**Recommendation:** Use a compact row layout with a small type icon on the left, description + group name in the middle, and amount on the right.

- **Expense items:** Show a receipt-style indicator (text "E" in accent circle, or use the expense description as the primary text)
- **Settlement items:** Show a handshake-style indicator (text "S" in a different color circle)
- **Info hierarchy:** Description/type (bodyMedium) > group name + relative time (caption, textSecondary) > amount (bodyMedium, right-aligned)
- **No payer avatars on dashboard:** Keep text-only for density since the 5-item preview should be compact. The payer name appears as secondary text.
- **Color differentiation:** Expense amounts in `textPrimary` (white), settlement amounts in `accent` (green)

### Dashboard Section Ordering
**Recommendation:** Reorder to: Balance Header > Activity Feed > My Groups > Pending Invites

This addresses the user's concern that invites push groups lower. Groups are more frequently accessed than the invites section, so they should be higher. Invites move to the bottom as a "notification" area.

Implementation: Move the invites SectionList section below the groups section in the `sections` useMemo array.

### Section Header Design
**Recommendation:** "Recent Activity" label (label variant, uppercase, textSecondary) with "See all" as a pressable caption aligned to the right of the same row. This matches a common mobile dashboard pattern and is compact.

### Empty State Design
**Recommendation:** When no activity in last 30 days, show a compact single-line message inside the activity section: "No recent activity" in caption/textTertiary. Do NOT use the full EmptyState component (too tall, wastes space). Save the full EmptyState for the Activity History screen when it's empty.

### What Qualifies as "Activity"
**Recommendation:** Show ALL group activity visible to the user, not just their own actions. This means:
- All expenses in groups the user belongs to
- All settlements in groups the user belongs to
This is more useful because users want to know what happened in their groups, not just what they did.

### Navigation Target on Item Tap
**Recommendation:**
- **Expense items:** Navigate to the expense detail screen (`/group/${groupId}/expense/${expenseId}`)
- **Settlement items:** Navigate to the group detail screen (`/group/${groupId}`)

Expense items have a meaningful detail screen. Settlements do not have their own detail screen in the app, so the group detail (which shows settlement history) is the best target.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "Coming soon" placeholder | Real activity feed with 5 items | This phase | Dashboard becomes a true activity hub |
| Navigate to group to see expenses | Cross-group activity visible on home | This phase | Reduces navigation steps |
| No settlement visibility on home | Settlements appear in activity feed | This phase | Complete financial picture on home screen |

**Not changing:**
- SectionList-based dashboard structure -- proven in Phase 10
- Pull-to-refresh pattern -- already wired
- Balance summary header -- completed in Phase 10
- Navigation patterns (router.push) -- established throughout app

## Open Questions

1. **Should the Activity History screen be a Stack screen or a Tab screen?**
   - What we know: The user said "dedicated screen with back navigation", which implies a Stack screen (like group detail). The `_layout.tsx` root Stack would need a new `Stack.Screen` entry.
   - What's unclear: Whether it should be a sibling to the existing routes or nested under tabs.
   - Recommendation: Add as a root Stack screen at `app/activity.tsx` with `<Stack.Screen name="activity" />` in the root layout. This matches how `group/[id]` works -- a full-screen experience with back button.

2. **Performance of the UNION ALL RPC with many groups/expenses**
   - What we know: The 30-day filter and LIMIT/OFFSET keep query size bounded. Existing indexes on `expenses(group_id)` and `settlements(group_id)` help.
   - What's unclear: Whether a composite index on `(group_id, created_at)` would significantly improve performance for the ORDER BY + LIMIT pattern.
   - Recommendation: Start without additional indexes. Add `CREATE INDEX idx_expenses_group_created ON expenses(group_id, created_at DESC)` and similar for settlements only if performance is observed to be slow. For the expected data volume (a few groups, tens of expenses), the current indexes are sufficient.

3. **Cache strategy for activity data**
   - What we know: The app caches groups and group detail data using `setCachedData`. Activity data could follow the same pattern.
   - What's unclear: Whether caching activity is worth the complexity, since it changes frequently.
   - Recommendation: Cache the dashboard 5-item preview for instant display on mount (same as groups list). Do NOT cache the full history screen data (it changes too frequently and infinite scroll adds complexity). Show skeletons while loading on first mount, then stale-while-revalidate on subsequent focuses.

## Sources

### Primary (HIGH confidence)
- **Existing codebase** (`app/(tabs)/index.tsx`) -- Dashboard structure, SectionList, dashboardHeader useMemo with activity placeholder (lines 613-644)
- **Existing codebase** (`lib/database.types.ts`) -- Database schema: expenses, settlements tables, existing RPC patterns
- **Existing codebase** (`supabase/migrations/00021_settlements_table.sql`) -- Settlement table schema, RPC patterns (security definer, auth.uid(), CTE structure)
- **Existing codebase** (`supabase/migrations/00001_initial_schema.sql`) -- Expenses table schema, indexes, RLS policies
- **Existing codebase** (`components/expenses/ExpenseCard.tsx`) -- Existing expense display patterns, amount formatting
- **Existing codebase** (`components/ui/Skeleton.tsx`) -- Skeleton shimmer patterns using moti/skeleton
- **Existing codebase** (`app/group/[id].tsx`) -- Settlement history display, date formatting, screen structure patterns
- **Existing codebase** (`app/_layout.tsx`) -- Root Stack navigator, screen registration pattern

### Secondary (MEDIUM confidence)
- **Supabase docs** (range/pagination) -- `range(from, to)` for offset-based pagination, verified via official docs
- **React Native FlatList docs** -- `onEndReached`, `onEndReachedThreshold` for infinite scroll (well-documented, stable API)

### Tertiary (LOW confidence)
- None -- this phase primarily relies on existing codebase patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries needed, all existing
- Architecture: HIGH -- RPC UNION pattern follows established app patterns (get_my_group_balances, get_group_balances); UI composition uses existing components
- Pitfalls: HIGH -- Based on direct analysis of existing code, DB schema, and navigation structure

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable -- no external dependencies changing)
