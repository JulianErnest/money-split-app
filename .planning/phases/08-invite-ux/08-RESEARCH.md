# Phase 8: Invite UX - Research

**Researched:** 2026-02-20
**Domain:** React Native UI + Supabase RPC for invite accept/decline flows
**Confidence:** HIGH

## Summary

Phase 8 adds the user-facing invite experience on top of Phase 7's invite infrastructure. The core work is: (1) two new Supabase RPCs (`accept_invite` and `decline_invite`) with a new RLS policy on `pending_members`, (2) a "Pending Invites" section on the home screen that queries `pending_members WHERE user_id = auth.uid()`, and (3) inline accept/decline buttons on invite cards with toast feedback and navigation.

The existing codebase provides all the UI primitives needed -- `Card`, `Button`, `Text`, `Toast`, `EmptyState`, `Alert` for confirmations, and `FlatList` with `SectionList` patterns. No new libraries are required. The primary challenge is the RLS gap: the current `pending_members` SELECT policy only allows group members to view rows, but invited users are not group members yet. This must be solved with either a new RLS policy or a security definer RPC for fetching invites.

**Primary recommendation:** Create two security definer RPCs (`accept_invite`, `decline_invite`) in a new migration, add one new RLS policy for invite inbox SELECT, then build the UI using existing components. Convert the home screen `FlatList` to a `SectionList` with two sections: Pending Invites and My Groups.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Accept flow
- Single tap accept -- no confirmation dialog, no friction
- After accepting, navigate directly to the group detail screen
- Show a brief success toast ("You joined [Group Name]!") as the group opens
- All existing expense splits from when they were a pending member are visible immediately -- no special onboarding or welcome screen

#### Decline flow & warning
- Show a warning before declining -- user must confirm the action
- Warning tone is straightforward English (e.g., "Declining will remove you from all expense splits in this group.")
- After confirming decline, the invite disappears silently -- no additional toast
- Decline deletes all expense splits tied to the pending member record so balances recalculate

#### Invite placement & display
- Dedicated "Pending Invites" section at the top of the home screen groups list
- Section is always visible -- shows empty state message when no invites pending
- Each invite card shows: group name + who invited them (e.g., "Friday Dinners -- invited by Juan")
- Accept and decline buttons on each invite card

### Claude's Discretion
- Re-invite policy after decline (whether creator can re-send to same phone number)
- Invite card layout direction (horizontal scroll vs vertical stack) for multiple invites
- Empty state copy when no invites are pending
- Loading states and error handling for accept/decline actions

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native (SectionList) | 0.81.5 | Two-section list (invites + groups) | Built-in, replaces FlatList for multi-section layout |
| @supabase/supabase-js | ^2.96.0 | RPC calls for accept/decline, inbox query | Already used throughout app |
| expo-router | ~6.0.23 | Navigation to group detail after accept | Already used for all routing |
| expo-haptics | ~15.0.8 | Haptic feedback on accept/decline | Already used for all interactions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-native Alert | built-in | Decline confirmation dialog | For the "are you sure?" warning before decline |
| Toast (custom) | in-app | Success toast after accept | Existing `useToast()` hook from `@/components/ui/Toast` |
| moti (MotiView) | ^0.30.0 | Fade-in animation for invite cards | Already used on home screen for group card animations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SectionList | FlatList + ListHeaderComponent | SectionList is cleaner for always-visible section headers; FlatList header would work but is messier for empty states |
| Alert.alert for decline | Custom BottomSheet dialog | Alert is simpler and matches the existing remove-member pattern in `[id].tsx` |
| Direct table query for inbox | Security definer RPC | RPC is cleaner but adds one more function; direct query needs new RLS policy anyway, so both are needed |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Changes Structure

```
supabase/migrations/
  00020_invite_accept_decline.sql     # New RPCs + RLS policy

app/(tabs)/
  index.tsx                           # Convert FlatList -> SectionList, add invite section

lib/
  group-members.ts                    # Add fetchPendingInvites() function
  database.types.ts                   # Add accept_invite and decline_invite function types
```

### Pattern 1: SectionList for Two-Section Home Screen

**What:** Replace the current `FlatList` in `index.tsx` with a `SectionList` that has two sections: "Pending Invites" at the top, "My Groups" below.

**When to use:** When the home screen needs a persistent section header that shows even when empty.

**How it integrates with existing code:**
- The existing `groups` state and `renderItem` callback stay mostly the same for the "My Groups" section
- A new `pendingInvites` state array is fetched alongside groups
- The `SectionList` `renderSectionHeader` shows section titles
- Each section can have its own empty component via conditional rendering
- The existing pull-to-refresh, cached data, and sync-complete patterns extend naturally

**Key detail:** `SectionList` requires data shaped as `{ title: string, data: T[] }[]`. The invite section uses a different `renderItem` for invite cards with accept/decline buttons, while the group section reuses the existing `renderItem`.

### Pattern 2: Security Definer RPCs for Accept/Decline

**What:** Two new PostgreSQL functions that atomically handle accept and decline operations.

**Why security definer:** The accept flow needs to: (1) verify the pending_members row belongs to the caller, (2) insert into group_members, (3) transfer expense splits from pending_member_id to user_id, (4) delete the pending_members row. This crosses multiple tables with RLS that would block direct client operations. The decline flow similarly needs to delete expense_splits and the pending_members row.

**accept_invite(p_pending_member_id uuid) returns uuid:**
1. Verify `auth.uid()` matches `pending_members.user_id`
2. Verify `invite_status = 'pending'`
3. Insert into `group_members` (group_id, user_id)
4. Transfer expense_splits: `SET user_id = caller, pending_member_id = NULL WHERE pending_member_id = p_pending_member_id`
5. Delete the pending_members row
6. Return the group_id (for navigation)

**decline_invite(p_pending_member_id uuid) returns void:**
1. Verify `auth.uid()` matches `pending_members.user_id`
2. Verify `invite_status = 'pending'`
3. Delete expense_splits where `pending_member_id = p_pending_member_id`
4. Delete the pending_members row (or mark as 'declined' -- see re-invite policy below)

### Pattern 3: Invite Inbox Query

**What:** A client-side function that fetches the current user's pending invites with group and inviter info.

**Critical RLS gap:** The current `pending_members` SELECT policy uses `get_user_group_ids()` which checks `group_members`. An invited user is NOT in `group_members` yet, so they cannot see their own pending_members rows.

**Solution -- new RLS policy:**
```sql
create policy "Users can view their own pending invites"
  on public.pending_members for select
  using (user_id = (select auth.uid()));
```

This allows a user to see pending_members rows where they are the invited user (`user_id` column), regardless of whether they are in `group_members`. This is secure because `user_id` is set by the server-side `add_pending_member` RPC and the auto-link trigger -- the client cannot set it.

**Client query pattern:**
```typescript
const { data } = await supabase
  .from("pending_members")
  .select(`
    id,
    group_id,
    invite_status,
    groups (id, name),
    users!pending_members_added_by_fkey (display_name)
  `)
  .eq("user_id", user.id)
  .eq("invite_status", "pending");
```

**Important:** This query joins to `groups` and `users` tables. The `groups` RLS policy only allows SELECT for group members (via `get_user_group_ids()`). Since the invited user is NOT a group member, this join will fail silently -- the `groups` data will be null. **Solution:** Either (a) use a security definer RPC to fetch invites, or (b) add another RLS policy on `groups` to allow SELECT when the user has a pending invite. **Recommendation:** Use a security definer RPC (`get_my_pending_invites`) that returns denormalized data. This is the cleanest approach and avoids cascading RLS policy changes.

### Pattern 4: Optimistic UI for Accept/Decline

**What:** Immediately remove the invite card from the UI when the user taps accept or decline, then handle the server response.

**Accept flow:**
1. User taps Accept
2. Set loading state on the specific invite card button
3. Call `accept_invite` RPC
4. On success: remove invite from local state, show toast, navigate to group
5. On error: restore invite card, show error toast

**Decline flow:**
1. User taps Decline
2. Show `Alert.alert` with warning message
3. If user confirms: set loading state, call `decline_invite` RPC
4. On success: remove invite from local state (no toast per user decision)
5. On error: restore invite card, show error toast

### Anti-Patterns to Avoid
- **Polling for invites:** Don't set up an interval to check for new invites. Use pull-to-refresh and `useFocusEffect` (already established pattern).
- **Complex invite state machine:** Don't track invite_status in local state. The pending_members row is either present (pending) or deleted (accepted/declined). Keep it simple.
- **Separate inbox screen:** User decided on dedicated section at top of home screen, not a separate screen/tab.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation dialog | Custom modal component | `Alert.alert` from react-native | Already used for member removal in `[id].tsx`; consistent UX |
| Success notification | Custom notification system | `useToast()` from `@/components/ui/Toast` | Already wired into `_layout.tsx` via `ToastProvider` |
| Loading state on button | Custom spinner | `Button` component's `loading` prop | Already supports `loading` and `disabled` state |
| Empty state display | Custom empty view | `EmptyState` component | Already used on home screen and group detail |
| Haptic feedback | Custom vibration | `expo-haptics` | Already used throughout for accept/error patterns |

**Key insight:** Every UI primitive needed for this phase already exists in the codebase. The work is composing them together, not building new components.

## Common Pitfalls

### Pitfall 1: RLS Blocking Invite Inbox Query
**What goes wrong:** The invited user queries `pending_members` but gets empty results because the current SELECT RLS policy requires them to be in `group_members`, which they aren't yet.
**Why it happens:** Phase 7 added the `user_id` column and index for inbox queries but did NOT add a corresponding RLS policy. The migration comment says "so Phase 8 can query: SELECT * FROM pending_members WHERE user_id = auth.uid()" but the RLS still blocks it.
**How to avoid:** Add a new SELECT policy: `using (user_id = (select auth.uid()))`. Or use a security definer RPC for fetching invites.
**Warning signs:** Invite section always shows empty state even when invites exist in the database.

### Pitfall 2: Joined Group Not Visible Immediately After Accept
**What goes wrong:** After accepting an invite and navigating to the group detail, the group doesn't show in the home screen groups list when the user goes back.
**Why it happens:** The `fetchGroups` function in `index.tsx` queries `group_members` for the current user. After `accept_invite` inserts into `group_members`, the data is fresh on the server but the client hasn't re-fetched. The `useFocusEffect` on group detail fetches group data, but the home screen `useFocusEffect` may have already cached old data.
**How to avoid:** After accepting, either (a) optimistically add the group to the local groups list, or (b) trigger `fetchGroups` when returning to the home screen. The existing `useFocusEffect` with `fetchBalances` already runs on every focus -- extend `fetchGroups` to also run on focus, or call it explicitly after accept navigation.
**Warning signs:** Group shows in detail view but not in home screen list until pull-to-refresh.

### Pitfall 3: Groups Table RLS Blocks Invite Card Info
**What goes wrong:** The invite card needs group name and inviter name. But the `groups` table RLS policy requires the user to be a group member. Since the invited user isn't a member, the join `pending_members -> groups` returns null.
**Why it happens:** RLS policies cascade through joins. Even if you can see the `pending_members` row, the joined `groups` data is filtered by its own policy.
**How to avoid:** Use a security definer RPC (`get_my_pending_invites`) that fetches from `pending_members` with joins to `groups` and `users`, bypassing RLS. This is the same pattern used by all other RPCs in the app.
**Warning signs:** Invite cards show null/empty group names.

### Pitfall 4: Expense Split Transfer on Accept Must Handle Constraint
**What goes wrong:** When accepting, transferring expense_splits from `pending_member_id` to `user_id` might violate the `expense_splits_member_check` constraint that requires exactly one of `user_id` or `pending_member_id` to be non-null.
**Why it happens:** The constraint is `check (num_nonnulls(user_id, pending_member_id) = 1)`. The update must set BOTH `user_id = X` AND `pending_member_id = NULL` in a single UPDATE statement.
**How to avoid:** Use `UPDATE expense_splits SET user_id = caller_id, pending_member_id = NULL WHERE pending_member_id = p_pending_member_id` -- a single statement that satisfies the constraint.
**Warning signs:** Constraint violation error during accept.

### Pitfall 5: Duplicate Group Member on Accept
**What goes wrong:** If the user somehow already has a `group_members` row (e.g., they joined via invite link while the phone invite was pending), the `accept_invite` RPC's INSERT into `group_members` fails with a unique constraint violation.
**Why it happens:** The `group_members` table has `unique(group_id, user_id)`.
**How to avoid:** Use `ON CONFLICT (group_id, user_id) DO NOTHING` in the INSERT, matching the pattern in `join_group_by_invite`. Still proceed with expense split transfer and pending member cleanup.
**Warning signs:** "duplicate key value violates unique constraint" error.

### Pitfall 6: Re-invite After Decline
**What goes wrong:** After a user declines, the group creator tries to re-add them by phone. If the decline deletes the `pending_members` row entirely, the re-invite works fine. But if it only updates `invite_status = 'declined'` (soft delete), the `add_pending_member` RPC's duplicate check blocks re-adding.
**Why it happens:** The duplicate check is `SELECT 1 FROM pending_members WHERE group_id = X AND phone_number = Y`. A soft-deleted row still matches.
**How to avoid:** Hard delete on decline (delete the row entirely). This is simpler and aligns with the user's decision that "decline deletes all expense splits." If the row is gone, re-inviting naturally works.
**Warning signs:** "This phone number is already pending" error when trying to re-invite after decline.

## Code Examples

### Example 1: accept_invite RPC

```sql
-- Source: Modeled on existing join_group_by_invite (00003) and remove_group_member (00016)
create or replace function public.accept_invite(
  p_pending_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
  v_group_id uuid;
  v_user_id uuid;
  v_invite_status text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Fetch and validate the pending member row
  select group_id, user_id, invite_status
  into v_group_id, v_user_id, v_invite_status
  from pending_members
  where id = p_pending_member_id;

  if v_group_id is null then
    raise exception 'Invite not found';
  end if;

  if v_user_id != current_user_id then
    raise exception 'This invite is not for you';
  end if;

  if v_invite_status != 'pending' then
    raise exception 'This invite has already been %', v_invite_status;
  end if;

  -- Add to group (idempotent)
  insert into group_members (group_id, user_id)
  values (v_group_id, current_user_id)
  on conflict (group_id, user_id) do nothing;

  -- Transfer expense splits from pending to real user
  update expense_splits
  set user_id = current_user_id, pending_member_id = null
  where pending_member_id = p_pending_member_id;

  -- Remove pending member row
  delete from pending_members where id = p_pending_member_id;

  return v_group_id;
end;
$$;
```

### Example 2: decline_invite RPC

```sql
-- Source: Modeled on remove_group_member pending path (00016)
create or replace function public.decline_invite(
  p_pending_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
  v_user_id uuid;
  v_invite_status text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select user_id, invite_status
  into v_user_id, v_invite_status
  from pending_members
  where id = p_pending_member_id;

  if v_user_id is null then
    raise exception 'Invite not found';
  end if;

  if v_user_id != current_user_id then
    raise exception 'This invite is not for you';
  end if;

  if v_invite_status != 'pending' then
    raise exception 'This invite has already been %', v_invite_status;
  end if;

  -- Delete expense splits for this pending member
  delete from expense_splits
  where pending_member_id = p_pending_member_id;

  -- Delete the pending member row (hard delete, allows re-invite)
  delete from pending_members where id = p_pending_member_id;
end;
$$;
```

### Example 3: get_my_pending_invites RPC

```sql
-- Source: Custom RPC pattern matching get_my_group_balances (00009)
create or replace function public.get_my_pending_invites()
returns table(
  pending_member_id uuid,
  group_id uuid,
  group_name text,
  invited_by_name text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    pm.id as pending_member_id,
    pm.group_id,
    g.name as group_name,
    coalesce(u.display_name, 'Someone') as invited_by_name
  from pending_members pm
  join groups g on g.id = pm.group_id
  join users u on u.id = pm.added_by
  where pm.user_id = current_user_id
    and pm.invite_status = 'pending';
end;
$$;
```

### Example 4: SectionList Structure for Home Screen

```typescript
// Source: React Native SectionList pattern, adapting existing FlatList in index.tsx
interface InviteRow {
  pending_member_id: string;
  group_id: string;
  group_name: string;
  invited_by_name: string;
}

// State
const [pendingInvites, setPendingInvites] = useState<InviteRow[]>([]);

// Fetch invites (alongside fetchGroups)
const fetchInvites = useCallback(async () => {
  if (!user) return;
  const { data, error } = await supabase.rpc("get_my_pending_invites");
  if (!error && data) {
    setPendingInvites(data as InviteRow[]);
  }
}, [user]);

// SectionList sections
const sections = [
  { title: "Pending Invites", data: pendingInvites, type: "invite" as const },
  { title: "My Groups", data: groups, type: "group" as const },
];

// renderItem dispatches by section type
// renderSectionHeader shows section title
// renderSectionFooter shows empty state per section
```

### Example 5: Invite Card with Accept/Decline Buttons

```typescript
// Source: Adapting Card + Button patterns from existing components
function InviteCard({ invite, onAccept, onDecline }: {
  invite: InviteRow;
  onAccept: (invite: InviteRow) => void;
  onDecline: (invite: InviteRow) => void;
}) {
  const [accepting, setAccepting] = useState(false);

  return (
    <Card>
      <View style={styles.inviteRow}>
        <Avatar emoji={getGroupEmoji(invite.group_name)} size="md" />
        <View style={styles.inviteInfo}>
          <Text variant="bodyMedium" color="textPrimary">
            {invite.group_name}
          </Text>
          <Text variant="caption" color="textSecondary">
            Invited by {invite.invited_by_name}
          </Text>
        </View>
      </View>
      <View style={styles.inviteActions}>
        <Button
          label="Accept"
          variant="primary"
          onPress={() => onAccept(invite)}
          loading={accepting}
          style={styles.acceptButton}
        />
        <Button
          label="Decline"
          variant="ghost"
          onPress={() => onDecline(invite)}
          style={styles.declineButton}
        />
      </View>
    </Card>
  );
}
```

### Example 6: Accept Handler with Toast and Navigation

```typescript
// Source: Adapting joinGroup pattern from join/[code].tsx
async function handleAcceptInvite(invite: InviteRow) {
  try {
    const { data: groupId, error } = await supabase.rpc("accept_invite", {
      p_pending_member_id: invite.pending_member_id,
    });

    if (error) {
      showToast({ message: error.message, type: "error" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Remove from local state
    setPendingInvites(prev =>
      prev.filter(i => i.pending_member_id !== invite.pending_member_id)
    );

    // Show toast and navigate
    showToast({
      message: `You joined ${invite.group_name}!`,
      type: "success",
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push(`/group/${groupId}` as any);
  } catch {
    showToast({ message: "Something went wrong. Please try again.", type: "error" });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}
```

### Example 7: Decline Handler with Alert Confirmation

```typescript
// Source: Adapting handleRemoveMember pattern from group/[id].tsx
function handleDeclineInvite(invite: InviteRow) {
  Alert.alert(
    "Decline Invite",
    "Declining will remove you from all expense splits in this group.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.rpc("decline_invite", {
              p_pending_member_id: invite.pending_member_id,
            });
            if (error) {
              showToast({ message: error.message, type: "error" });
              return;
            }
            // Silently remove from list (no toast per user decision)
            setPendingInvites(prev =>
              prev.filter(i => i.pending_member_id !== invite.pending_member_id)
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            showToast({ message: "Something went wrong. Please try again.", type: "error" });
          }
        },
      },
    ]
  );
}
```

## Claude's Discretion Recommendations

### Re-invite Policy After Decline
**Recommendation: Allow re-invites (hard delete on decline).**
When a user declines, hard-delete the `pending_members` row entirely (along with its expense splits). This means the group creator can re-add the same phone number later with no special handling. The `add_pending_member` duplicate check naturally passes since the row is gone. This is the simplest approach and the most forgiving -- people change their minds.

### Invite Card Layout Direction
**Recommendation: Vertical stack (not horizontal scroll).**
Vertical stacking is consistent with the existing groups list below it. Users typically have 0-3 pending invites -- a horizontal scrollable carousel adds complexity for little benefit. Each invite card is visually distinct from group cards (it has action buttons), so vertical stacking keeps the scanning pattern simple. The SectionList handles scrolling naturally.

### Empty State Copy
**Recommendation: "No pending invites" with subtext "When someone adds you to a group, it will show up here."**
Keep it brief and informative. Use a simple icon/emoji (e.g., envelope or mailbox). This matches the existing empty state pattern (`EmptyState` component with emoji + headline + subtext).

### Loading States and Error Handling
**Recommendation:**
- **Accept button:** Show `loading` spinner via `Button` component's `loading` prop. Disable both buttons while accepting.
- **Decline button:** No loading state needed since `Alert.alert` blocks interaction. After confirmation, the RPC is fast (just deletes).
- **Fetch errors:** If `get_my_pending_invites` fails, show nothing in the invites section (fail silently, same as balance fetch pattern). The section header still shows with the empty state.
- **Accept error:** Show error toast with the server message. Restore the invite card.
- **Decline error:** Show error toast. The invite card is already visible since we only remove it after success.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auto-join on phone add (pre-Phase 7) | Consent-based pending invite (Phase 7) | 2026-02-19 | Users must now explicitly accept invites; all existing code already updated |
| Auto-link trigger auto-joins groups | Auto-link trigger only links identity | 2026-02-19 | New signup users see invites in inbox, not auto-added to groups |

**Deprecated/outdated:**
- The old `add_pending_member` (pre-00019) auto-added existing users to groups. The current version always creates pending invites.
- The old auto-link trigger transferred expense splits and deleted pending members. The current version only sets `user_id`.

## Open Questions

1. **SectionList vs FlatList with ListHeaderComponent**
   - What we know: Both approaches work. SectionList is semantically cleaner for the always-visible section pattern. FlatList with a ListHeaderComponent is simpler if we don't need section headers.
   - What's unclear: Whether the visual design needs visible section headers ("Pending Invites" / "My Groups" as text labels) or if the invite cards are visually distinct enough without headers.
   - Recommendation: Use SectionList with visible section headers. The user explicitly asked for a "dedicated Pending Invites section" which implies visible separation. If section headers feel heavy, they can be styled subtly.

2. **Invite count on home screen**
   - What we know: The user wants invites at the top. No mention of badge counts or notification indicators.
   - What's unclear: Whether a badge/count should show on the tab bar icon.
   - Recommendation: Don't add tab bar badges. The section at the top of the home screen is sufficient. Keep scope minimal.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `app/(tabs)/index.tsx` -- current home screen FlatList implementation
- Codebase analysis: `app/group/[id].tsx` -- existing Alert.alert and member removal patterns
- Codebase analysis: `supabase/migrations/00019_invite_status_consent_flow.sql` -- Phase 7 schema
- Codebase analysis: `supabase/migrations/00016_remove_group_member.sql` -- expense split deletion pattern
- Codebase analysis: `supabase/migrations/00005_pending_members.sql` -- RLS policies on pending_members
- Codebase analysis: `components/ui/Toast.tsx` -- existing toast system with useToast() hook
- Codebase analysis: `components/ui/Button.tsx` -- existing button with loading state
- Codebase analysis: `lib/group-members.ts` -- GroupMember type with invite_status field
- Codebase analysis: `lib/database.types.ts` -- current type definitions

### Secondary (MEDIUM confidence)
- React Native SectionList documentation -- well-established API, stable across versions

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new deps needed
- Architecture: HIGH -- patterns directly modeled on existing codebase (RPCs, RLS, component composition)
- Pitfalls: HIGH -- identified through direct codebase analysis (RLS policies, constraint checks, join behavior)

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable -- no external dependencies, all based on existing codebase)
