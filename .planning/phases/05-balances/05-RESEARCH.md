# Phase 5: Balances - Research

**Researched:** 2026-02-18
**Domain:** Debt simplification algorithm, net balance computation, PostgreSQL aggregation, React Native balance UI
**Confidence:** HIGH

## Summary

This phase adds the core value proposition of the app: showing simplified "who owes who" balances that minimize the number of transactions needed to settle all debts. The primary technical challenge is the debt simplification algorithm, which computes net balances from raw expense/split data and then pairs debtors with creditors to produce a minimal set of settlement transactions. A secondary challenge is the balance drill-down (BLNC-03), which requires tracing a simplified balance back to the original expenses that contribute to it.

The existing data model (expenses, expense_splits with both user_id and pending_member_id) provides all the raw data needed. The algorithm itself is well-understood: compute net balances per member, then greedily match highest debtor to highest creditor. For a small group (5-15 members), the greedy approach produces optimal or near-optimal results in O(n) time. The NP-complete optimal solution is irrelevant at this scale.

The key architectural decision is **where to compute balances**: client-side in TypeScript (simpler, testable with Jest) vs. server-side in a PostgreSQL RPC function (single round-trip, no data transfer overhead). The recommendation is a **hybrid approach**: use a PostgreSQL RPC to compute net balances per member (aggregate query), then run the greedy simplification algorithm client-side in a pure TypeScript function (fully testable with the existing Jest + ts-jest setup, matching the TDD pattern from Phase 4).

**Primary recommendation:** Create a `get_group_balances` Supabase RPC that returns net balances per member, then implement a pure TypeScript `simplifyDebts()` function client-side that converts net balances into a minimal set of settlement transactions. TDD the algorithm with Jest.

## Standard Stack

### Core (already installed -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.96.0 | Backend client, RPC calls | Already in project |
| expo-router | ~6.0.23 | Navigation for balance screens | Already in project |
| react-native | 0.81 | UI components | Already in project |
| Jest + ts-jest | (installed) | TDD for algorithm | Established pattern from Phase 4 |

### New Dependencies
None. This phase requires no new libraries.

### Not Adding
| Problem | Why Not a Library |
|---------|-------------------|
| Debt simplification algorithm | No standard npm library exists for this. The algorithm is ~30 lines of TypeScript. Building custom is the correct approach. |
| Graph visualization | Not needed -- balances are displayed as a simple list, not a graph. |
| Currency formatting | Already have `formatPeso()` in `lib/expense-utils.ts` |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
  balance-utils.ts              # Pure functions: simplifyDebts(), computeNetBalances()
  __tests__/
    balance-utils.test.ts       # TDD tests for debt simplification
app/
  group/
    [id].tsx                    # Updated: add "Balances" section
    [id]/
      balance/
        [memberId].tsx          # Balance drill-down: expenses contributing to a debt
app/
  (tabs)/
    index.tsx                   # Updated: show net balance summary per group
```

### Pattern 1: Hybrid Compute (Server Aggregation + Client Simplification)
**What:** PostgreSQL does the heavy lifting (aggregating thousands of expense_splits into net balances per member). TypeScript does the lightweight transformation (converting N net balances into M settlement transactions).
**When to use:** When raw data aggregation is expensive but the algorithm is simple and benefits from client-side testing.
**Example:**
```typescript
// Step 1: Server-side RPC returns net balances
// { user_id: 'abc', net_balance: 150.00 }  -- is owed 150
// { user_id: 'def', net_balance: -100.00 } -- owes 100
// { user_id: 'ghi', net_balance: -50.00 }  -- owes 50

// Step 2: Client-side simplification
interface Settlement {
  from: string;    // debtor member id
  to: string;      // creditor member id
  amount: number;  // centavos
}

function simplifyDebts(netBalances: Map<string, number>): Settlement[] {
  const debtors: Array<{ id: string; amount: number }> = [];
  const creditors: Array<{ id: string; amount: number }> = [];

  for (const [id, balance] of netBalances) {
    if (balance < 0) debtors.push({ id, amount: -balance });
    else if (balance > 0) creditors.push({ id, amount: balance });
  }

  // Sort descending by amount for greedy matching
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);
    settlements.push({
      from: debtors[i].id,
      to: creditors[j].id,
      amount: transfer,
    });
    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }

  return settlements;
}
```

### Pattern 2: Net Balance SQL Aggregation
**What:** A PostgreSQL function that computes each member's net balance from expenses and splits in a single query.
**When to use:** To avoid transferring all expense rows to the client.
**Example:**
```sql
-- For each member: (total they paid) - (total they owe via splits) = net balance
-- Positive = owed money, Negative = owes money
create or replace function public.get_group_balances(p_group_id uuid)
returns table (
  member_id uuid,
  display_name text,
  avatar_url text,
  is_pending boolean,
  net_balance numeric(10,2)
)
language sql
security definer
set search_path = public
as $$
  with paid as (
    -- How much each user paid for the group
    select paid_by as user_id, sum(amount) as total_paid
    from expenses
    where group_id = p_group_id
    group by paid_by
  ),
  owed as (
    -- How much each member owes (from their splits)
    select
      coalesce(es.user_id, es.pending_member_id) as member_id,
      case when es.user_id is not null then false else true end as is_pending,
      sum(es.amount) as total_owed
    from expense_splits es
    join expenses e on e.id = es.expense_id
    where e.group_id = p_group_id
    group by coalesce(es.user_id, es.pending_member_id),
             case when es.user_id is not null then false else true end
  )
  select
    o.member_id,
    case
      when o.is_pending then (select pm.phone_number from pending_members pm where pm.id = o.member_id)
      else (select u.display_name from users u where u.id = o.member_id)
    end as display_name,
    case
      when o.is_pending then null
      else (select u.avatar_url from users u where u.id = o.member_id)
    end as avatar_url,
    o.is_pending,
    coalesce(p.total_paid, 0) - o.total_owed as net_balance
  from owed o
  left join paid p on p.user_id = o.member_id and not o.is_pending;
$$;
```

### Pattern 3: Balance Drill-Down Query
**What:** Given two members (debtor and creditor) in a group, find all expenses that contribute to the debt between them.
**When to use:** For BLNC-03 -- tapping a balance entry to see contributing expenses.
**Example:**
```sql
-- Expenses where creditor paid AND debtor has a split
-- These are the expenses that create the debt relationship
select e.id, e.description, e.amount, e.created_at,
       es.amount as debtor_share
from expenses e
join expense_splits es on es.expense_id = e.id
where e.group_id = p_group_id
  and e.paid_by = p_creditor_id
  and (es.user_id = p_debtor_id or es.pending_member_id = p_debtor_id)
order by e.created_at desc;
```

### Pattern 4: Per-Group Net Balance Summary (for Groups List)
**What:** Compute the current user's net position in each group for the group list screen.
**When to use:** For BLNC-02 -- showing "You owe 350" or "You are owed 200" on each group card.
**Example:**
```sql
-- For the current user in a specific group:
-- net = (what I paid for the group) - (my share of all expenses)
-- Positive = others owe me, Negative = I owe others
create or replace function public.get_my_group_balance(p_group_id uuid)
returns numeric(10,2)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(
      (select sum(amount) from expenses
       where group_id = p_group_id and paid_by = auth.uid()),
      0
    )
    -
    coalesce(
      (select sum(es.amount) from expense_splits es
       join expenses e on e.id = es.expense_id
       where e.group_id = p_group_id and es.user_id = auth.uid()),
      0
    );
$$;
```

### Anti-Patterns to Avoid
- **Loading all expenses client-side to compute balances:** For groups with many expenses, this wastes bandwidth and battery. Let PostgreSQL aggregate.
- **Running the simplification algorithm on the server:** The greedy algorithm needs to be testable and debuggable. Keep it client-side as a pure function.
- **Using floating-point for balance math:** Continue the centavo-integer pattern from Phase 4's `expense-utils.ts`. The RPC returns numeric(10,2), convert to centavos immediately on the client.
- **Creating a separate "balances" database table:** Balances are derived data from expenses/splits. Storing them creates staleness and sync issues. Always compute from source data.
- **Fetching net balances one-by-one per group:** For the groups list (BLNC-02), fetch all group balances in one RPC call or batch query, not N separate calls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Peso formatting | Custom formatter | `formatPeso()` from `lib/expense-utils.ts` | Already exists, handles edge cases |
| Member display (name, avatar, pending) | New member type | `GroupMember` from `lib/group-members.ts` | Unified type already handles real + pending members |
| SQL aggregation for net balances | Client-side sum of all expenses | PostgreSQL RPC with SUM/GROUP BY | Database aggregation is orders of magnitude faster |

**Key insight:** The balance feature is primarily a computation + display feature. The data already exists in expenses/expense_splits. No new tables are needed -- only new queries (RPCs) and a client-side algorithm.

## Common Pitfalls

### Pitfall 1: Floating-Point Rounding in Balance Computation
**What goes wrong:** Net balances don't sum to zero due to floating-point arithmetic. A group shows a phantom debt of 0.01 pesos.
**Why it happens:** JavaScript floating-point math: 0.1 + 0.2 !== 0.3. If the RPC returns decimal amounts and they're added in JS without conversion to integers, rounding errors accumulate.
**How to avoid:** Convert all amounts from the RPC response to centavos (integers) immediately using `Math.round(amount * 100)`. Run the entire simplification algorithm in centavos. Convert back to pesos only for display using `formatPeso()`.
**Warning signs:** Tests where net balances don't sum to exactly zero. Balance entries showing tiny amounts like 0.01.

### Pitfall 2: Pending Members in Balance Computation
**What goes wrong:** Pending members who have splits but no user_id are excluded from balance calculations, causing balances to not add up.
**Why it happens:** The expense_splits table uses `pending_member_id` instead of `user_id` for pending members. Queries that only join on user_id miss these rows.
**How to avoid:** Use `COALESCE(es.user_id, es.pending_member_id)` as the member identifier in all balance queries. Include an `is_pending` flag to distinguish them in the UI.
**Warning signs:** Group total debts != total credits. Missing members in the balance view.

### Pitfall 3: Payer's Own Split Creating Self-Debt
**What goes wrong:** The payer of an expense also has a split row (their share of the cost). If not handled correctly, the balance calculation double-counts or shows the payer owing themselves.
**Why it happens:** In the data model, the payer pays the full amount AND has a split for their share. The net balance formula (paid - owed) handles this correctly, but only if both sides are included.
**How to avoid:** The formula `total_paid - total_owed_via_splits = net_balance` naturally handles this. If Alice pays 300 for a 3-way equal split, her net = 300 (paid) - 100 (her split) = +200 (others owe her 200). Verify with a test case.
**Warning signs:** Payer showing a negative balance on an expense they paid for.

### Pitfall 4: Empty Groups or Groups With No Expenses
**What goes wrong:** Division by zero, empty arrays, or confusing UI when a group has no expenses yet.
**Why it happens:** Balance queries return empty results for groups with no expenses.
**How to avoid:** Handle the empty case explicitly: show "All settled up" or "No expenses yet" in the UI. The simplification function should return an empty array for an empty input.
**Warning signs:** Loading spinner that never resolves, or "You owe NaN" text.

### Pitfall 5: N+1 Query Problem for Group List Balances
**What goes wrong:** The groups list screen makes one RPC call per group to get the user's net balance, causing 10+ API calls on mount.
**Why it happens:** The naive approach fetches balance per group inside a loop or map.
**How to avoid:** Create a single RPC `get_my_balances_all_groups()` that returns the current user's net balance for all their groups in one query. Or fetch group IDs first, then batch query.
**Warning signs:** Groups list screen is slow to load, network tab shows many sequential RPC calls.

### Pitfall 6: Stale Balances After Adding Expense
**What goes wrong:** User adds an expense, navigates back to group detail, but balances show old values.
**Why it happens:** Balance data is cached or not re-fetched on screen focus.
**How to avoid:** Use `useFocusEffect` (already the pattern in group detail screen) to re-fetch balances every time the screen is focused. This matches the existing refresh pattern.
**Warning signs:** Balance doesn't change after adding an expense until manual refresh.

## Code Examples

### TDD Test Cases for simplifyDebts()
```typescript
// lib/__tests__/balance-utils.test.ts
import { simplifyDebts, type Settlement } from '../balance-utils';

describe('simplifyDebts', () => {
  it('returns empty array when all balances are zero', () => {
    const balances = new Map<string, number>();
    expect(simplifyDebts(balances)).toEqual([]);
  });

  it('handles simple two-person debt', () => {
    // Alice paid 10000 centavos, split equally with Bob
    // Alice net: +5000, Bob net: -5000
    const balances = new Map([
      ['alice', 5000],
      ['bob', -5000],
    ]);
    const result = simplifyDebts(balances);
    expect(result).toEqual([
      { from: 'bob', to: 'alice', amount: 5000 },
    ]);
  });

  it('minimizes transactions for 3-person group', () => {
    // Alice: +200, Bob: -150, Charlie: -50
    const balances = new Map([
      ['alice', 20000],
      ['bob', -15000],
      ['charlie', -5000],
    ]);
    const result = simplifyDebts(balances);
    // Should produce 2 transactions, not 3
    expect(result.length).toBe(2);
    // Total transferred to Alice should equal 20000
    const totalToAlice = result
      .filter(s => s.to === 'alice')
      .reduce((sum, s) => sum + s.amount, 0);
    expect(totalToAlice).toBe(20000);
  });

  it('settlements always sum to zero', () => {
    const balances = new Map([
      ['a', 10000],
      ['b', -3000],
      ['c', -4000],
      ['d', -3000],
    ]);
    const result = simplifyDebts(balances);
    // Net flow for each person should equal their balance
    const flows = new Map<string, number>();
    for (const { from, to, amount } of result) {
      flows.set(from, (flows.get(from) || 0) - amount);
      flows.set(to, (flows.get(to) || 0) + amount);
    }
    for (const [id, balance] of balances) {
      expect(flows.get(id)).toBe(balance);
    }
  });

  it('ignores members with zero balance', () => {
    const balances = new Map([
      ['alice', 5000],
      ['bob', 0],
      ['charlie', -5000],
    ]);
    const result = simplifyDebts(balances);
    expect(result.length).toBe(1);
    expect(result[0]).toEqual({ from: 'charlie', to: 'alice', amount: 5000 });
  });
});
```

### PostgreSQL RPC for Group Net Balances
```sql
-- Returns net balance for each member in a group
-- Positive = owed money (creditor), Negative = owes money (debtor)
create or replace function public.get_group_balances(p_group_id uuid)
returns table (
  member_id uuid,
  is_pending boolean,
  net_balance numeric(10,2)
)
language sql
security definer
set search_path = public
as $$
  -- Verify caller is a member
  -- (security definer bypasses RLS, so we check manually)
  with auth_check as (
    select 1
    from group_members
    where group_id = p_group_id and user_id = auth.uid()
  ),
  paid as (
    select paid_by as user_id, sum(amount) as total_paid
    from expenses
    where group_id = p_group_id
    group by paid_by
  ),
  owed as (
    select
      coalesce(es.user_id, es.pending_member_id) as member_id,
      (es.user_id is null) as is_pending,
      sum(es.amount) as total_owed
    from expense_splits es
    join expenses e on e.id = es.expense_id
    where e.group_id = p_group_id
    group by coalesce(es.user_id, es.pending_member_id),
             (es.user_id is null)
  )
  select
    o.member_id,
    o.is_pending,
    coalesce(p.total_paid, 0) - o.total_owed as net_balance
  from owed o
  left join paid p on p.user_id = o.member_id and not o.is_pending
  where exists (select 1 from auth_check);
$$;
```

### Net Balance for Current User Across All Groups (Batch)
```sql
create or replace function public.get_my_group_balances()
returns table (
  group_id uuid,
  net_balance numeric(10,2)
)
language sql
security definer
set search_path = public
as $$
  with my_groups as (
    select group_id from group_members where user_id = auth.uid()
  ),
  paid as (
    select e.group_id, sum(e.amount) as total_paid
    from expenses e
    where e.paid_by = auth.uid()
      and e.group_id in (select group_id from my_groups)
    group by e.group_id
  ),
  owed as (
    select e.group_id, sum(es.amount) as total_owed
    from expense_splits es
    join expenses e on e.id = es.expense_id
    where es.user_id = auth.uid()
      and e.group_id in (select group_id from my_groups)
    group by e.group_id
  )
  select
    mg.group_id,
    coalesce(p.total_paid, 0) - coalesce(o.total_owed, 0) as net_balance
  from my_groups mg
  left join paid p on p.group_id = mg.group_id
  left join owed o on o.group_id = mg.group_id;
$$;
```

### Balance UI Display Pattern
```typescript
// Formatting helpers for balance display
function formatBalanceText(netBalanceCentavos: number, currentUserId: string, memberId: string): string {
  if (netBalanceCentavos === 0) return 'Settled up';
  const formatted = formatPeso(Math.abs(netBalanceCentavos));
  if (netBalanceCentavos > 0) return `You are owed ${formatted}`;
  return `You owe ${formatted}`;
}

// Color coding for balances
function getBalanceColor(netBalanceCentavos: number): string {
  if (netBalanceCentavos > 0) return colors.accent;    // green -- you're owed
  if (netBalanceCentavos < 0) return colors.error;      // red -- you owe
  return colors.textSecondary;                           // gray -- settled
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Compute balances from all expenses client-side | Server-side aggregation via SQL, client-side simplification | Standard practice | Scales to groups with 100s of expenses |
| Optimal NP-complete simplification | Greedy approach (max debtor pays max creditor) | Always standard for Splitwise-like apps | Near-optimal for small groups (<20 people), runs in O(n log n) |
| Separate balances table | Derived computation from expenses/splits | Standard practice | No staleness, no sync issues |

## Open Questions

1. **Should balance drill-down show simplified or raw debts?**
   - What we know: BLNC-03 says "tap a balance to see which expenses contribute to that debt." This means showing the original expenses where the creditor paid and the debtor has a split.
   - What's unclear: If a simplified balance combines multiple raw debts (e.g., Alice owes Bob from 3 expenses), should the drill-down show all 3, or just the net?
   - Recommendation: Show all contributing expenses with individual amounts. This is more transparent and matches Splitwise's behavior.

2. **Should the balances section replace or complement the expenses section in group detail?**
   - What we know: Group detail currently shows expenses list. Phase 5 adds balances.
   - What's unclear: Whether balances go above or below expenses, or in a separate tab.
   - Recommendation: Add a "Balances" section above the expenses section in the group detail screen. Balances are the primary actionable information ("who do I pay?"), while expenses are historical reference.

3. **How to handle pending members in the balance summary on the groups list?**
   - What we know: Pending members can have expense splits. Their balances are real.
   - What's unclear: Should the groups list balance summary include debts to/from pending members?
   - Recommendation: Yes, include them. The user's net position should reflect all debts, including to pending members. The balance text should show the user's overall net position.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `lib/expense-utils.ts`, `lib/group-members.ts`, all migration files (00001-00008)
- Existing codebase: `app/group/[id].tsx`, `app/(tabs)/index.tsx` -- established UI patterns
- [Terbium.io - Debt Simplification](https://terbium.io/2020/09/debt-simplification/) -- comprehensive analysis of all algorithmic approaches
- [GeeksforGeeks - Minimize Cash Flow](https://www.geeksforgeeks.org/dsa/minimize-cash-flow-among-given-set-friends-borrowed-money/) -- greedy algorithm pseudocode

### Secondary (MEDIUM confidence)
- [Algorithm Behind Splitwise's Debt Simplification Feature](https://medium.com/@mithunmk93/algorithm-behind-splitwises-debt-simplification-feature-8ac485e97688) -- Splitwise-specific implementation details
- [Supabase Database Functions Docs](https://supabase.com/docs/guides/database/functions) -- RPC function patterns
- [Splitwise Simplify Debts Algorithm](https://splitwise-simplify-debts.pages.dev/posts/splitwise-simplify-debts/) -- greedy algorithm walkthrough

### Tertiary (LOW confidence)
- [Splitwise is NP-Complete](https://www.alexirpan.com/2016/05/10/may-10.html) -- theoretical complexity analysis (confirms greedy is practical)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies needed, all patterns from existing codebase
- Architecture: HIGH -- hybrid server-aggregation + client-simplification is well-established
- Algorithm: HIGH -- greedy debt simplification is thoroughly documented, simple to implement, and fully testable
- Pitfalls: HIGH -- derived from actual data model analysis (pending members, floating-point, payer's own split)
- Balance drill-down: MEDIUM -- the SQL query pattern is straightforward but exact UX needs planner judgment

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable domain, no fast-moving dependencies)
