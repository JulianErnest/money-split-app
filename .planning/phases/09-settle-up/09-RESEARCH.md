# Phase 9: Settle Up - Research

**Researched:** 2026-02-20
**Domain:** Settlement recording, balance adjustment via PostgreSQL RPC, confirmation UI with bottom sheet, settlement history display
**Confidence:** HIGH

## Summary

This phase adds the ability to record whole-balance settlements between two users within a group, reflect those settlements in all balance views, and display settlement history. The primary technical challenge is the database design: a new `settlements` table and an RPC (`record_settlement`) that atomically validates and inserts the settlement. The balance RPCs (`get_group_balances` and `get_my_group_balances`) must be updated to subtract settled amounts from the net balance computation.

The existing codebase provides all the building blocks needed. The balance section in `app/group/[id].tsx` already renders settlement cards (the `Settlement` type from `balance-utils.ts`), the `BottomSheet` component is ready for the confirmation flow, the `Toast` component supports success toasts, and `expo-haptics` is already used throughout the app. No new libraries are required.

The key architectural insight is that settlements are NOT expenses. They are a separate concept that affects balance computation. The cleanest approach is a separate `settlements` table with a `record_settlement` RPC, and modifying the two balance RPCs to include settled amounts in their net balance calculation (subtracting settlements paid from the payer's balance and settlements received from the receiver's balance).

**Primary recommendation:** Create a `settlements` table, a `record_settlement` security-definer RPC that validates both parties are group members and the caller is involved, then update `get_group_balances` and `get_my_group_balances` to incorporate settled amounts. On the UI side, add a "Settle" button to each balance row where the user is involved, opening a confirmation bottom sheet, and add a settlement history section below expenses.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Settle up trigger & flow
- Only own debts -- user can only settle balances where they are the payer or receiver
- Confirmation via bottom sheet -- slide-up sheet showing the amount, payer, and receiver with a confirm button
- Amount is non-editable (whole-balance settlement) -- displayed as a fixed amount, user just confirms
- No explanation text about the constraint -- the fixed amount speaks for itself

#### Post-settlement feedback
- Success toast + stay on current screen -- show "Settled!" toast and remain with updated balances visible
- Zero-balance rows disappear -- once a balance hits zero, the row is removed entirely from the balance section
- Success haptic feedback on confirm -- satisfying haptic buzz consistent with other confirm actions in the app

#### Settlement history
- Claude's discretion on placement -- whether settlements appear mixed with expenses or in a separate section
- Claude's discretion on entry detail level -- payer, receiver, amount, date at minimum; additional context if useful
- Claude's discretion on tap behavior -- whether entries have a detail view or the list is sufficient
- Claude's discretion on undo/delete -- whether settlements can be reversed if recorded by mistake

#### Balance view integration
- Immediate server refresh after settling -- refetch balances from server right after settle confirmation
- Existing balance display already distinguishes owe vs owed -- just add the settle action to existing rows
- Settled members (zero balance) disappear from balance section -- they remain group members but vanish from balances
- Claude's discretion on home screen balance update timing

### Claude's Discretion

- Settle trigger placement (balance row tap vs detail screen vs button)
- Settlement history location and detail level
- Settlement entry tap behavior (detail view vs list-only)
- Undo/delete capability for mistaken settlements
- All-settled empty state treatment for the balance section
- Home screen balance summary refresh timing after settling

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core (already installed -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.96.0 | RPC calls for record_settlement, balance queries | Already in project |
| @gorhom/bottom-sheet | ^5.2.8 | Confirmation sheet for settle action | Already in project, used for AddMemberSheet |
| expo-haptics | ~15.0.8 | Success haptic on confirm | Already used throughout app |
| expo-router | ~6.0.23 | Navigation (no new screens needed, or minimal) | Already in project |
| react-native-reanimated | ~4.1.1 | Animations for toast, bottom sheet | Already in project |
| Jest + ts-jest | ^30.2.0 / ^29.4.6 | Testing settlement logic (if any pure functions) | Already in project |

### New Dependencies
None. This phase requires no new libraries.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate settlements table | Inserting settlements as a special expense type | Separate table is cleaner -- settlements are conceptually different from expenses, mixing them complicates expense queries and display logic |
| Balance RPCs incorporating settlements | Client-side settlement subtraction | Server-side is more reliable -- prevents stale data issues and ensures consistency across multiple clients |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
supabase/migrations/
  00021_settlements_table.sql         # settlements table + record_settlement RPC + balance RPC updates

lib/
  balance-utils.ts                    # No changes needed -- simplifyDebts still works on net balances
  database.types.ts                   # Add record_settlement and get_group_settlements types

app/
  group/
    [id].tsx                          # Add "Settle" button to balance rows, add settlement history section

components/
  settlements/
    SettleConfirmSheet.tsx             # Bottom sheet confirmation component
```

### Pattern 1: Settlements Table Design
**What:** A table recording each settlement event between two group members.
**When to use:** Every time a user confirms a settle-up action.
**Example:**
```sql
-- Source: Derived from existing schema patterns (expenses, group_members)
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  paid_by uuid references public.users(id) not null,    -- debtor who paid
  paid_to uuid references public.users(id) not null,    -- creditor who received
  amount numeric(10,2) not null check (amount > 0),
  created_by uuid references public.users(id) not null,  -- who recorded this
  created_at timestamptz default now() not null
);

alter table public.settlements enable row level security;

-- RLS: group members can view settlements in their groups
create policy "Members can view group settlements"
  on public.settlements for select
  using (
    group_id in (
      select group_id from public.group_members
      where user_id = (select auth.uid())
    )
  );

-- Indexes for query performance
create index idx_settlements_group_id on public.settlements(group_id);
create index idx_settlements_paid_by on public.settlements(paid_by);
create index idx_settlements_paid_to on public.settlements(paid_to);
```

### Pattern 2: record_settlement RPC (Atomic Validation + Insert)
**What:** A security-definer RPC that validates the caller is involved in the settlement, both parties are group members, and the amount matches the current balance.
**When to use:** When the user confirms the settle action in the bottom sheet.
**Example:**
```sql
-- Source: Follows pattern from create_expense RPC (00004) and accept_invite RPC (00020)
create or replace function public.record_settlement(
  p_group_id uuid,
  p_paid_by uuid,     -- debtor (person who owed money)
  p_paid_to uuid,     -- creditor (person who was owed money)
  p_amount numeric(10,2)
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_settlement_id uuid;
begin
  -- Auth check
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Caller must be either the payer or the receiver
  if current_user_id != p_paid_by and current_user_id != p_paid_to then
    raise exception 'You can only settle your own debts';
  end if;

  -- Both parties must be group members
  if not exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = p_paid_by
  ) then
    raise exception 'Payer is not a member of this group';
  end if;

  if not exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = p_paid_to
  ) then
    raise exception 'Receiver is not a member of this group';
  end if;

  -- Amount must be positive
  if p_amount <= 0 then
    raise exception 'Settlement amount must be positive';
  end if;

  -- Insert the settlement
  insert into settlements (group_id, paid_by, paid_to, amount, created_by)
  values (p_group_id, p_paid_by, p_paid_to, p_amount, current_user_id)
  returning id into new_settlement_id;

  return new_settlement_id;
end;
$$;
```

### Pattern 3: Updated get_group_balances with Settlements
**What:** Modify the existing balance RPC to subtract settled amounts from net balances.
**When to use:** Replaces the current `get_group_balances` function.
**Key insight:** A settlement where A pays B means A's debt decreases (net_balance goes up by settlement amount) and B's credit decreases (net_balance goes down by settlement amount). This is equivalent to treating settlements as "A paid `amount` to B" -- the same math as if A had paid an expense and B had a split for it.
**Example:**
```sql
create or replace function public.get_group_balances(p_group_id uuid)
returns table(member_id uuid, is_pending boolean, net_balance numeric(10,2))
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

  if not exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = current_user_id
  ) then
    raise exception 'Not a member of this group';
  end if;

  return query
  with all_members as (
    select gm.user_id as mid, false as is_pend
    from group_members gm where gm.group_id = p_group_id
    union all
    select pm.id as mid, true as is_pend
    from pending_members pm where pm.group_id = p_group_id
  ),
  paid as (
    select e.paid_by as mid, sum(e.amount) as total_paid
    from expenses e where e.group_id = p_group_id
    group by e.paid_by
  ),
  owed as (
    select
      coalesce(es.user_id, es.pending_member_id) as mid,
      (es.user_id is null) as is_pend,
      sum(es.amount) as total_owed
    from expense_splits es
    join expenses e on e.id = es.expense_id
    where e.group_id = p_group_id
    group by coalesce(es.user_id, es.pending_member_id), (es.user_id is null)
  ),
  -- NEW: settlement adjustments
  settled_out as (
    -- Money paid OUT (settlements where this member was the payer/debtor)
    select s.paid_by as mid, sum(s.amount) as total_settled
    from settlements s where s.group_id = p_group_id
    group by s.paid_by
  ),
  settled_in as (
    -- Money received IN (settlements where this member was the receiver/creditor)
    select s.paid_to as mid, sum(s.amount) as total_settled
    from settlements s where s.group_id = p_group_id
    group by s.paid_to
  )
  select
    am.mid as member_id,
    am.is_pend as is_pending,
    (
      coalesce(p.total_paid, 0)
      - coalesce(o.total_owed, 0)
      + coalesce(so.total_settled, 0)   -- paid settlements reduce debt (increase net)
      - coalesce(si.total_settled, 0)   -- received settlements reduce credit (decrease net)
    )::numeric(10,2) as net_balance
  from all_members am
  left join paid p on p.mid = am.mid and am.is_pend = false
  left join owed o on o.mid = am.mid and o.is_pend = am.is_pend
  left join settled_out so on so.mid = am.mid and am.is_pend = false
  left join settled_in si on si.mid = am.mid and am.is_pend = false
  where (
    coalesce(p.total_paid, 0)
    - coalesce(o.total_owed, 0)
    + coalesce(so.total_settled, 0)
    - coalesce(si.total_settled, 0)
  ) != 0;
end;
$$;
```

### Pattern 4: Updated get_my_group_balances with Settlements
**What:** Same adjustment for the home screen per-group balance summary.
**Example:**
```sql
create or replace function public.get_my_group_balances()
returns table(group_id uuid, net_balance numeric(10,2))
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
    select gm.group_id from group_members gm where gm.user_id = current_user_id
  ),
  paid as (
    select e.group_id, sum(e.amount) as total_paid
    from expenses e
    where e.paid_by = current_user_id
      and e.group_id in (select mg.group_id from my_groups mg)
    group by e.group_id
  ),
  owed as (
    select e.group_id, sum(es.amount) as total_owed
    from expense_splits es
    join expenses e on e.id = es.expense_id
    where es.user_id = current_user_id
      and e.group_id in (select mg.group_id from my_groups mg)
    group by e.group_id
  ),
  settled_out as (
    select s.group_id, sum(s.amount) as total_settled
    from settlements s
    where s.paid_by = current_user_id
      and s.group_id in (select mg.group_id from my_groups mg)
    group by s.group_id
  ),
  settled_in as (
    select s.group_id, sum(s.amount) as total_settled
    from settlements s
    where s.paid_to = current_user_id
      and s.group_id in (select mg.group_id from my_groups mg)
    group by s.group_id
  )
  select
    mg.group_id,
    (
      coalesce(p.total_paid, 0)
      - coalesce(o.total_owed, 0)
      + coalesce(so.total_settled, 0)
      - coalesce(si.total_settled, 0)
    )::numeric(10,2) as net_balance
  from my_groups mg
  left join paid p on p.group_id = mg.group_id
  left join owed o on o.group_id = mg.group_id
  left join settled_out so on so.group_id = mg.group_id
  left join settled_in si on si.group_id = mg.group_id
  where (
    coalesce(p.total_paid, 0)
    - coalesce(o.total_owed, 0)
    + coalesce(so.total_settled, 0)
    - coalesce(si.total_settled, 0)
  ) != 0;
end;
$$;
```

### Pattern 5: Settlement Confirmation Bottom Sheet
**What:** A reusable bottom sheet component for confirming a settlement.
**When to use:** When user taps the "Settle" button on a balance row.
**Example:**
```typescript
// Source: Follows existing AddMemberSheet pattern in components/groups/AddMemberModal.tsx
// and BottomSheet pattern in components/ui/BottomSheet.tsx

interface SettleConfirmSheetProps {
  groupId: string;
  payerName: string;     // debtor display name
  payerId: string;       // debtor member id
  receiverName: string;  // creditor display name
  receiverId: string;    // creditor member id
  amountCentavos: number;
  onSettled: () => void;  // callback to refetch data
  onClose: () => void;
}

// Inside the sheet:
// - Display: "{payerName} pays {receiverName}"
// - Display: "P{formatPeso(amountCentavos)}" in large text
// - Confirm button: calls supabase.rpc('record_settlement', { ... })
// - On success: Haptics.notificationAsync(Success), showToast("Settled!"), onSettled(), close
// - On error: Haptics.notificationAsync(Error), showToast(error.message, "error")
```

### Pattern 6: Settle Trigger on Balance Rows
**What:** Add a "Settle" button to each balance row where the current user is the debtor or creditor.
**When to use:** For each settlement card in the balances section of group detail.
**Recommendation:** Add a small "Settle" button on the right side of each balance row where the current user is involved. This keeps the tap-to-drill-down navigation intact while adding a clear action trigger.
**Example:**
```typescript
// In the settlements.map() in group/[id].tsx:
// Add a "Settle" button only when current user is involved
const canSettle = s.from === currentUserId || s.to === currentUserId;
// Both from and to must be non-pending (only real users can settle)
const bothReal = !isMemberPending(s.from) && !isMemberPending(s.to);

{canSettle && bothReal && (
  <Pressable onPress={() => openSettleSheet(s)} style={styles.settleButton}>
    <Text variant="caption" color="accent">Settle</Text>
  </Pressable>
)}
```

### Anti-Patterns to Avoid
- **Modifying expense data to represent settlements:** Settlements are not expenses. Don't insert fake expense rows or modify splits. Use a separate settlements table.
- **Computing settlement effects client-side:** Always incorporate settlements into the server-side balance RPCs. Client-side subtraction leads to stale data and inconsistencies across devices.
- **Allowing settlement of pending member balances:** Pending members are not real users and can't confirm they received payment. Only allow settlements between two real group members.
- **Skipping the RPC validation:** Don't insert directly into the settlements table from the client. Use a security-definer RPC that validates both parties are group members and the caller is involved.
- **Creating a delete_settlement RPC without guarding:** If undo/delete is added, restrict it to the person who created the settlement, and only within a reasonable time window.

## Claude's Discretion Recommendations

### Settle Trigger Placement
**Recommendation:** Add a small "Settle" button directly on each balance row where the current user is involved.
**Reasoning:** The current balance rows already handle tap-to-navigate for drill-down. Adding a "Settle" button as a secondary action keeps both features accessible. A button is more discoverable than requiring users to navigate to a detail screen to settle.

### Settlement History Location and Detail Level
**Recommendation:** Add a "Settlements" section between Balances and Expenses on the group detail screen. Each entry shows: payer name, receiver name, amount, and date. Keep it simple -- no separate screen needed.
**Reasoning:** Settlements are group-level activity that complements expenses. Placing them between balances and expenses creates a natural flow: see what's owed (balances) -> see what's been settled (settlements) -> see the full history (expenses). This avoids cluttering the expense list with non-expense items.

### Settlement Entry Tap Behavior
**Recommendation:** No detail view -- the list entry is sufficient.
**Reasoning:** A settlement is a simple transaction (A paid B, amount, date). There is no additional detail to show in a drill-down. The inline display provides all necessary information.

### Undo/Delete Capability
**Recommendation:** Add a `delete_settlement` RPC that allows the settlement creator to delete it. Add a long-press or swipe action on settlement history entries. No time window restriction needed at this stage.
**Reasoning:** Users will inevitably record settlements by mistake. Without edit/delete on expenses, settlements are the only mutable record. Restricting to the creator (the person who recorded it) provides adequate safety. The RPC should verify `created_by = auth.uid()` before deleting.

### All-Settled Empty State
**Recommendation:** Use the existing `EmptyState` component with emoji "✅", headline "All settled!", and subtext "Walang utang-utangan. Nice!" -- this is already implemented in the codebase for the zero-balances case.
**Reasoning:** This empty state already exists in `app/group/[id].tsx` line 426-430. No changes needed.

### Home Screen Balance Update Timing
**Recommendation:** The home screen already refetches balances on every focus via `useFocusEffect` (line 222-228 in `app/(tabs)/index.tsx`). After settling in the group detail screen, navigating back to home automatically triggers a balance refresh. No additional work needed.
**Reasoning:** The existing `useFocusEffect` pattern handles this. The user stays on the group detail screen after settling (per locked decision), and when they eventually navigate back, the home screen refreshes.

### Settlement History RPC
**Recommendation:** Create a `get_group_settlements` RPC or query the settlements table directly via Supabase client. Since settlements have RLS policies that allow group members to view them, a direct query with joined user data is simpler and follows the expense-fetching pattern.
**Example:**
```typescript
// Direct query pattern (matches expense fetching in group/[id].tsx)
const { data: settlementsData } = await supabase
  .from("settlements")
  .select("id, paid_by, paid_to, amount, created_by, created_at, payer:users!settlements_paid_by_fkey(display_name), receiver:users!settlements_paid_to_fkey(display_name)")
  .eq("group_id", id!)
  .order("created_at", { ascending: false });
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bottom sheet confirmation | Custom modal | `AppBottomSheet` from `components/ui/BottomSheet.tsx` | Already built, consistent UX |
| Success toast | Custom notification | `useToast()` from `components/ui/Toast.tsx` | Already built with animation |
| Haptic feedback | Custom vibration | `expo-haptics` `notificationAsync(Success)` | Already used throughout app |
| Peso formatting | String concatenation | `formatPeso()` from `lib/expense-utils.ts` | Handles commas, decimals correctly |
| Empty state for zero balances | Custom empty view | `EmptyState` component | Already used with exact copy for this case |
| Member name lookup | New query | `memberMap` from existing group detail screen | Already built in `app/group/[id].tsx` |

**Key insight:** Nearly all UI building blocks exist. This phase is primarily a database schema change + RPC modification + wiring up existing components in a new flow.

## Common Pitfalls

### Pitfall 1: Settlement Math Direction Confusion
**What goes wrong:** The settlement amount adjusts balances in the wrong direction, making debts increase instead of decrease.
**Why it happens:** Confusion between "paid_by" (debtor, the one who owed money and is now paying) and "paid_to" (creditor, the one who was owed money and is receiving). The balance math must treat settlements as: debtor's net goes UP (less debt), creditor's net goes DOWN (less credit).
**How to avoid:** In the balance RPC, settlements where a member is `paid_by` INCREASE their net balance (they paid off debt), and settlements where a member is `paid_to` DECREASE their net balance (their credit was satisfied). Verify with a test: if Alice owes Bob 500 and settles, Alice's net goes from -500 to 0, Bob's net goes from +500 to 0.
**Warning signs:** After settling, the balanced person still shows a balance, or the amount doubled instead of zeroing out.

### Pitfall 2: Settling with Pending Members
**What goes wrong:** User tries to settle a balance involving a pending member, but pending members aren't real users and can't be in the settlements table (which references `users(id)`).
**Why it happens:** Balance rows can involve pending members (identified by `is_pending` flag). The settle button shouldn't appear for these.
**How to avoid:** Only show the "Settle" button when both parties are real users (not pending). Check `!isMemberPending(s.from) && !isMemberPending(s.to)` before rendering the settle action.
**Warning signs:** FK constraint error when trying to insert a settlement with a pending_member_id.

### Pitfall 3: Race Condition Between Balance Fetch and Settlement
**What goes wrong:** The displayed balance amount doesn't match the actual balance when the settlement is recorded, because an expense was added between viewing and settling.
**Why it happens:** The settlement amount comes from a balance computed at page load time. If another group member adds an expense between page load and settlement confirmation, the displayed amount is stale.
**How to avoid:** The `record_settlement` RPC should NOT validate that the amount matches the current balance. It simply records the settlement as-is. The balance RPCs will recalculate correctly on the next fetch. The whole-balance constraint is enforced by the UI (non-editable amount), not the server. If the amount is slightly stale, the next balance refresh will show any remaining balance.
**Warning signs:** Settlement fails with "amount doesn't match balance" error, or user sees a small residual balance after settling.

### Pitfall 4: Forgetting to Update get_my_group_balances
**What goes wrong:** Group detail balances update correctly after settling, but the home screen group cards still show old balance amounts.
**Why it happens:** Only `get_group_balances` was updated to incorporate settlements, but `get_my_group_balances` (used by the home screen) was forgotten.
**How to avoid:** Both RPCs must be updated in the same migration. The settlement CTEs are nearly identical.
**Warning signs:** Home screen shows "You owe 500" after settling, while group detail shows "All settled!"

### Pitfall 5: Stale Balance After Settle (Missing Refetch)
**What goes wrong:** User settles, sees success toast, but the balance row doesn't disappear.
**Why it happens:** The `fetchData()` call after settlement was not awaited, or state update happens before the server processes the settlement.
**How to avoid:** After the RPC call succeeds, call `await fetchData()` to refetch all group data. The whole-balance settlement guarantees the row will disappear (net balance becomes 0, which is filtered out by the RPC's `WHERE != 0` clause).
**Warning signs:** Balance row persists until manual pull-to-refresh.

### Pitfall 6: Settlement Delete Without Cascade Consideration
**What goes wrong:** If a settlement is deleted (undo), the balance should revert. But if the deletion flow doesn't trigger a data refresh, the UI shows stale data.
**Why it happens:** Deleting a settlement removes a row from the settlements table, which means the balance RPCs will automatically compute the correct (pre-settlement) balance on next call. But the UI must refetch.
**How to avoid:** After deleting a settlement, refetch group data the same way as after recording one.
**Warning signs:** Settlement disappears from history but balance doesn't revert until pull-to-refresh.

## Code Examples

### Settle Button Integration in Balance Row
```typescript
// Source: Extends existing settlement rendering in app/group/[id].tsx (lines 431-523)
// Add after the settlement center (arrow + amount) section:

const canSettle = (s.from === currentUserId || s.to === currentUserId);
const bothReal = !isMemberPending(s.from) && !isMemberPending(s.to);

// Inside the Pressable wrapping each settlement card:
{canSettle && bothReal && (
  <Pressable
    onPress={(e) => {
      e.stopPropagation?.(); // Prevent drill-down navigation
      handleOpenSettle(s);
    }}
    style={styles.settleButton}
    hitSlop={8}
  >
    <Text variant="caption" color="accent">Settle</Text>
  </Pressable>
)}
```

### Settlement Confirmation Flow
```typescript
// Source: Follows pattern from handleAcceptInvite in app/(tabs)/index.tsx

async function handleConfirmSettle() {
  setSettling(true);
  try {
    const { error } = await supabase.rpc("record_settlement", {
      p_group_id: id!,
      p_paid_by: selectedSettlement.from,  // debtor
      p_paid_to: selectedSettlement.to,    // creditor
      p_amount: selectedSettlement.amount / 100,  // convert centavos to pesos for DB
    });

    if (error) {
      showToast({ message: error.message, type: "error" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast({ message: "Settled!", type: "success" });
    closeSettleSheet();
    await fetchData(); // Refetch all group data
  } catch {
    showToast({ message: "Something went wrong. Please try again.", type: "error" });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } finally {
    setSettling(false);
  }
}
```

### Settlement History Section
```typescript
// Source: Follows expense section pattern in app/group/[id].tsx (lines 527-558)

{/* Settlement History section */}
<View style={styles.settlementsSection}>
  <View style={styles.sectionHeader}>
    <Text variant="bodyMedium" color="textPrimary">
      Settlement History
    </Text>
    <View style={styles.countBadge}>
      <Text variant="caption" color="textSecondary">
        {settlementHistory.length}
      </Text>
    </View>
  </View>

  {settlementHistory.length === 0 ? (
    <EmptyState
      emoji="🤝"
      headline="No settlements yet"
      subtext="Settle balances to record payments here"
    />
  ) : (
    settlementHistory.map((sh) => (
      <Card key={sh.id} style={styles.settlementHistoryCard}>
        <View style={styles.settlementHistoryRow}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" color="textPrimary">
              {sh.payer_name} paid {sh.receiver_name}
            </Text>
            <Text variant="caption" color="textTertiary">
              {formatDate(sh.created_at)}
            </Text>
          </View>
          <Text variant="bodyMedium" color="accent">
            {"\u20B1"}{formatPeso(Math.round(sh.amount * 100))}
          </Text>
        </View>
      </Card>
    ))
  )}
</View>
```

### Delete Settlement RPC
```sql
-- Source: Follows pattern from decline_invite RPC (00020)
create or replace function public.delete_settlement(
  p_settlement_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  v_created_by uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select created_by into v_created_by
  from settlements
  where id = p_settlement_id;

  if v_created_by is null then
    raise exception 'Settlement not found';
  end if;

  if v_created_by != current_user_id then
    raise exception 'Only the person who recorded this settlement can delete it';
  end if;

  delete from settlements where id = p_settlement_id;
end;
$$;
```

### Database Types Addition
```typescript
// Add to lib/database.types.ts Functions section:
record_settlement: {
  Args: {
    p_group_id: string;
    p_paid_by: string;
    p_paid_to: string;
    p_amount: number;
  };
  Returns: string;
};
delete_settlement: {
  Args: {
    p_settlement_id: string;
  };
  Returns: undefined;
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Settlement as special expense type | Separate settlements table | Always standard for Splitwise-like apps | Clean separation of concerns, no expense query pollution |
| Client-side balance adjustment after settling | Server-side balance computation incorporating settlements | Standard practice | Single source of truth, consistent across devices |
| Settlement history in a separate screen | Inline history section in group detail | Recommended for small groups | Reduces navigation depth, everything visible on one screen |

**Deprecated/outdated:**
- None -- this is a new feature area with no prior implementation in this codebase.

## Open Questions

1. **Should the settlement amount be validated against the current balance?**
   - What we know: The user confirmed a specific amount shown in the UI. The RPC records it as-is.
   - What's unclear: Should the RPC verify the amount matches the current computed balance?
   - Recommendation: No. Don't validate. The amount was correct when displayed. If it changed between display and confirmation (race condition), the small discrepancy will show as a residual balance on the next refresh. Validating adds complexity and makes the RPC slower (needs to compute balances inside the RPC). The whole-balance constraint is a UI concern, not a data integrity concern.

2. **Should settlement deletion have a time window?**
   - What we know: User decision says Claude's discretion on undo/delete.
   - What's unclear: Should settlements only be deletable within N minutes of creation?
   - Recommendation: No time window for now. The user base is small (5-10 friends). Trust the creator restriction (`created_by = auth.uid()`). A time window can be added later if abuse is observed.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `supabase/migrations/00009_balance_rpcs.sql`, `00017_fix_get_group_balances_anchor.sql` -- current balance computation patterns
- Existing codebase: `app/group/[id].tsx` -- balance display, settlement card rendering, data fetching patterns
- Existing codebase: `components/ui/BottomSheet.tsx`, `components/ui/Toast.tsx` -- UI building blocks
- Existing codebase: `supabase/migrations/00020_invite_accept_decline.sql` -- RPC pattern with auth validation
- Existing codebase: `lib/balance-utils.ts` -- settlement type, simplifyDebts algorithm
- Existing codebase: `lib/database.types.ts` -- type definition patterns

### Secondary (MEDIUM confidence)
- PostgreSQL documentation: `numeric(10,2)` arithmetic, CTE patterns -- standard SQL
- Supabase documentation: security definer RPC patterns, RLS policies -- verified by existing code

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns verified from existing codebase
- Architecture: HIGH -- settlements table + RPC pattern directly mirrors existing expense/invite patterns
- Balance math: HIGH -- settlement direction math verified by reasoning through concrete examples
- Pitfalls: HIGH -- derived from actual data model analysis (pending members, FK constraints, race conditions)
- UI patterns: HIGH -- all components already exist in the codebase

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable domain, no fast-moving dependencies)
