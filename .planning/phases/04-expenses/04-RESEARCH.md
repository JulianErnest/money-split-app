# Phase 4: Expenses - Research

**Researched:** 2026-02-18
**Domain:** Expense entry wizard, split calculations, Supabase atomic inserts, React Native swipe navigation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Add expense flow:** Multi-step wizard with swipe between steps (amount & description -> payer -> split type & members). Swipe navigation with dots indicator. Large display + numpad for amount input (GCash/PayMaya style). Free text only for description (no categories).
- **Split selection:** Live remaining counter for custom splits showing "Remaining: X" that updates in real-time, can't submit until 0. Equal split: user selects/deselects members from the group.
- **Payer selection:** Default payer is current user (pre-selected). Single payer only. Member list with radio buttons. Payer is included in the split by default.
- **Expense list display:** Rich cards in group detail screen. Essential info: description, total amount, who paid, date. Each card shows personal balance impact ("You owe X" or "You paid"). Tap to see full split breakdown.
- **Specific ideas:** Amount input should feel like a payment app (GCash/PayMaya). Amounts capped at 999,999. Currency is always Philippine Peso.

### Claude's Discretion
- Split type toggle UX (segmented control, tabs, or separate step)
- Default member selection for equal splits (all selected vs none)
- Custom split amount entry method (inline fields vs tap-to-edit)
- Expense detail view approach (bottom sheet, full screen, or expandable card)
- Exact wizard step count and transitions
- Loading and error states
- Exact spacing, typography, and card styling within design system

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

This phase adds the core expense functionality: a multi-step wizard for creating expenses with equal or custom splits, and an expense list view in the group detail screen. The database schema (expenses + expense_splits tables) and RLS policies already exist from Phase 1 migrations. The primary technical challenges are: (1) building a swipeable wizard with a custom numpad, (2) handling currency math correctly (equal split rounding), and (3) atomically inserting expense + splits via a Supabase RPC function.

The existing codebase uses Expo SDK 54, React Native 0.81, react-native-gesture-handler, and react-native-reanimated -- all prerequisites for the swipe wizard. The app already has a placeholder `app/(tabs)/add.tsx` screen and a `app/group/[id].tsx` group detail screen where the expense list will be integrated.

**Primary recommendation:** Use `react-native-pager-view` for the swipe wizard, build a custom numpad component (no library -- they are too limited), create a `create_expense` Supabase RPC function for atomic insert, and use integer centavo math for all split calculations to avoid floating-point errors.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo | ~54.0.33 | Framework | Already in project |
| expo-router | ~6.0.23 | Navigation/routing | Already in project |
| @supabase/supabase-js | ^2.96.0 | Backend client | Already in project |
| react-native-gesture-handler | ~2.28.0 | Gesture support | Already installed, needed by PagerView |
| react-native-reanimated | ~4.1.1 | Animations | Already installed |

### New Dependencies
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-pager-view | latest | Swipe wizard pages | Official Expo-supported library for swiping between views. Native ViewPager on Android, UIPageViewController on iOS. Much smoother than ScrollView-based paging. |

### Not Adding (build custom instead)
| Problem | Why Not a Library |
|---------|-------------------|
| Numpad | Existing numpad libraries (react-native-numeric-pad, react-native-numpad) are too limited in customization. The GCash/PayMaya-style numpad with large display is a simple grid of Pressables -- 20 lines of layout code. Building custom gives full control over styling to match the dark theme and design system. |
| Bottom sheet (for expense detail) | @gorhom/bottom-sheet is excellent but adds a heavyweight dependency for a single use case. Use a simple `Modal` with animated slide-up (Reanimated is already installed) or a full-screen detail view. Revisit if bottom sheets are needed elsewhere. |

**Installation:**
```bash
npx expo install react-native-pager-view
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-native-pager-view | ScrollView with pagingEnabled | ScrollView paging is janky on Android, no native page change events. PagerView is the standard. |
| Custom numpad | react-native-numeric-pad | Library is limited in styling, last updated 2023, not worth the dependency for a 50-line component. |
| Custom slide-up detail | @gorhom/bottom-sheet | Great library but overkill for one modal. Can add later if needed in more places. |

## Architecture Patterns

### Recommended Project Structure
```
app/
  (tabs)/
    add.tsx                    # REPLACE: becomes group selector or redirect
  group/
    [id].tsx                   # MODIFY: add expenses section to group detail
    [id]/
      add-expense.tsx          # NEW: multi-step expense wizard
      expense/
        [expenseId].tsx        # NEW: expense detail view

components/
  expenses/
    NumPad.tsx                 # Custom numpad grid
    AmountDisplay.tsx          # Large peso amount display
    MemberSelector.tsx         # Checkbox list for selecting split members
    PayerSelector.tsx          # Radio button list for selecting payer
    SplitTypeToggle.tsx        # Segmented control for equal/custom
    CustomSplitRow.tsx         # Single member's custom amount input
    ExpenseCard.tsx            # Card for expense list

lib/
  expense-utils.ts             # Split calculation helpers (pure functions)
```

### Pattern 1: Swipe Wizard with PagerView
**What:** Multi-step form using react-native-pager-view with controlled page index
**When to use:** The add expense flow
**Example:**
```typescript
// Source: Expo docs + react-native-pager-view API
import PagerView from 'react-native-pager-view';
import { useRef, useState } from 'react';

function AddExpenseWizard({ groupId, members }: Props) {
  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Form state lifted above PagerView
  const [amount, setAmount] = useState(0);         // stored in centavos
  const [description, setDescription] = useState('');
  const [payerId, setPayerId] = useState(currentUserId);
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});

  return (
    <View style={{ flex: 1 }}>
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
      >
        <View key="1">{/* Step 1: Amount + Description */}</View>
        <View key="2">{/* Step 2: Payer selection */}</View>
        <View key="3">{/* Step 3: Split type + Members */}</View>
      </PagerView>
      <DotIndicator current={currentPage} total={3} />
    </View>
  );
}
```

### Pattern 2: Centavo-Based Currency Math
**What:** Store and calculate all amounts in centavos (integer) to avoid floating-point errors
**When to use:** All expense amount handling
**Example:**
```typescript
// lib/expense-utils.ts

/** Convert display string "1,234.56" to centavos integer 123456 */
export function pesosTocentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

/** Convert centavos integer to display string */
export function formatPeso(centavos: number): string {
  const pesos = centavos / 100;
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos);
}

/**
 * Equal split with remainder distribution.
 * 1000 centavos / 3 people = 333 + 333 + 334
 * Extra centavos go to first N members.
 */
export function calculateEqualSplit(
  totalCentavos: number,
  memberIds: string[]
): Record<string, number> {
  const count = memberIds.length;
  const base = Math.floor(totalCentavos / count);
  const remainder = totalCentavos - base * count;

  const splits: Record<string, number> = {};
  memberIds.forEach((id, i) => {
    splits[id] = base + (i < remainder ? 1 : 0);
  });
  return splits;
}

/**
 * Validate custom split: sum of all amounts must equal total.
 * Returns remaining centavos (0 = valid).
 */
export function customSplitRemaining(
  totalCentavos: number,
  amounts: Record<string, number>
): number {
  const sum = Object.values(amounts).reduce((a, b) => a + b, 0);
  return totalCentavos - sum;
}
```

### Pattern 3: Atomic Expense Insert via RPC
**What:** Supabase RPC function that inserts expense + all splits in one transaction
**When to use:** When submitting the expense form
**Example:**
```sql
-- supabase/migrations/00004_create_expense_rpc.sql
create or replace function public.create_expense(
  p_group_id uuid,
  p_description text,
  p_amount numeric(10,2),
  p_paid_by uuid,
  p_split_type text,
  p_splits jsonb  -- array of { user_id, amount }
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_expense_id uuid;
  current_user_id uuid := auth.uid();
  split_record jsonb;
  splits_total numeric(10,2) := 0;
begin
  -- Auth check
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Verify user is a group member
  if not exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = current_user_id
  ) then
    raise exception 'Not a member of this group';
  end if;

  -- Validate splits sum to total
  for split_record in select * from jsonb_array_elements(p_splits)
  loop
    splits_total := splits_total + (split_record->>'amount')::numeric;
  end loop;

  if splits_total != p_amount then
    raise exception 'Splits do not sum to total amount';
  end if;

  -- Insert expense
  insert into expenses (group_id, description, amount, paid_by, split_type, created_by)
  values (p_group_id, p_description, p_amount, p_paid_by, p_split_type, current_user_id)
  returning id into new_expense_id;

  -- Insert splits
  insert into expense_splits (expense_id, user_id, amount)
  select
    new_expense_id,
    (elem->>'user_id')::uuid,
    (elem->>'amount')::numeric
  from jsonb_array_elements(p_splits) as elem;

  return new_expense_id;
end;
$$;
```

**Client call:**
```typescript
const { data, error } = await supabase.rpc('create_expense', {
  p_group_id: groupId,
  p_description: description,
  p_amount: amount / 100, // convert centavos back to pesos for DB
  p_paid_by: payerId,
  p_split_type: splitType,
  p_splits: splits.map(({ userId, amount }) => ({
    user_id: userId,
    amount: amount / 100, // centavos to pesos
  })),
});
```

### Pattern 4: Expense Card with Balance Impact
**What:** Calculate "You owe X" or "You paid" from expense data
**When to use:** Expense list cards
**Example:**
```typescript
function getBalanceImpact(
  expense: Expense,
  splits: ExpenseSplit[],
  currentUserId: string
): { text: string; type: 'owe' | 'paid' | 'not_involved' } {
  const userSplit = splits.find(s => s.user_id === currentUserId);
  const isPayer = expense.paid_by === currentUserId;

  if (!userSplit) {
    return { text: 'Not involved', type: 'not_involved' };
  }

  if (isPayer) {
    // Payer is owed (total - their own share)
    const owedToYou = expense.amount - userSplit.amount;
    if (owedToYou === 0) return { text: 'You paid your share', type: 'paid' };
    return { text: `You lent ${formatPeso(owedToYou * 100)}`, type: 'paid' };
  } else {
    return { text: `You owe ${formatPeso(userSplit.amount * 100)}`, type: 'owe' };
  }
}
```

### Anti-Patterns to Avoid
- **Separate API calls for expense + splits:** Never insert expense then splits in two calls. If the second fails, you have orphaned data. Always use the RPC function.
- **Floating-point arithmetic for money:** Never do `amount / memberCount` with floats. Always convert to centavos (integers) first, distribute remainder.
- **TextInput for amount:** Don't use a keyboard TextInput for the amount. Build a custom numpad that prevents invalid input at the source (no letters, no double decimals, enforces max).
- **Storing wizard state in navigation params:** Don't pass form data between screens via route params. Lift state above PagerView or use a context/ref.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swipeable page container | Custom ScrollView paging | react-native-pager-view | Native performance, proper page snapping, page change events |
| Atomic multi-table insert | Sequential Supabase client calls | PostgreSQL RPC function | Guarantees atomicity -- if splits fail, expense rolls back |
| Equal split rounding | Naive division | Integer math with remainder distribution | Prevents lost centavos. 100.00 / 3 = 33.33 + 33.33 + 33.34, not 33.33 * 3 = 99.99 |
| Peso formatting | Manual string concatenation | Intl.NumberFormat('en-PH') | Handles thousands separators, decimal places correctly |

**Key insight:** The two most error-prone parts of expense splitting apps are (1) floating-point money math and (2) non-atomic database writes. Both have standard solutions that must be used -- not approximated.

## Common Pitfalls

### Pitfall 1: Floating-Point Split Rounding
**What goes wrong:** `100.00 / 3` produces `33.333...`, and 3 * 33.33 = 99.99, losing 0.01.
**Why it happens:** JavaScript uses IEEE 754 doubles. Division of currency amounts rarely produces clean decimals.
**How to avoid:** Convert all amounts to centavos (multiply by 100, round to integer) before any division. Use `Math.floor` for base amount, distribute remainder centavos to first N members.
**Warning signs:** Total of splits does not equal original amount in database.

### Pitfall 2: Race Condition on Expense Submit
**What goes wrong:** User double-taps submit, creating duplicate expenses.
**Why it happens:** No submit debounce or loading state guard.
**How to avoid:** Disable submit button immediately on press, show loading state, re-enable only on error. Use a `submitting` ref or state.
**Warning signs:** Duplicate expenses appearing in list.

### Pitfall 3: PagerView Children Must Be Direct Views
**What goes wrong:** PagerView pages don't render or crash.
**Why it happens:** PagerView requires direct children to be `View` components with `key` props. Wrapping in fragments or non-View components breaks it.
**How to avoid:** Each page must be `<View key="N">...</View>` as a direct child of PagerView.
**Warning signs:** Blank pages, missing content, or crash on Android.

### Pitfall 4: Numpad Decimal Edge Cases
**What goes wrong:** User enters "100." or "100.0" or "0.005" or "999999.99" and then another digit.
**Why it happens:** Numpad logic doesn't properly handle decimal state transitions.
**How to avoid:** Track decimal state explicitly: hasDecimal flag, decimalPlaces counter. Reject input when decimalPlaces >= 2 or when total would exceed 999,999.
**Warning signs:** Amounts like "100.001" or "1000000" appearing.

### Pitfall 5: Empty Member Selection on Submit
**What goes wrong:** User submits with 0 members selected for equal split.
**Why it happens:** User deselects all members but validation doesn't catch it.
**How to avoid:** Disable submit unless at least 1 member is selected. For custom split, require all amounts > 0 and sum = total.
**Warning signs:** Division by zero in split calculation.

### Pitfall 6: Database Type Mismatch for JSONB Parameter
**What goes wrong:** RPC call fails with type error when passing splits array.
**Why it happens:** Supabase client may not properly serialize nested objects to JSONB.
**How to avoid:** Pass splits as a JSON-stringified string if needed, or ensure the TypeScript types in `database.types.ts` are updated to include the new RPC function signature.
**Warning signs:** "invalid input syntax for type jsonb" error.

## Code Examples

### Custom NumPad Component
```typescript
// components/expenses/NumPad.tsx
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, spacing, radius } from '@/theme';

interface NumPadProps {
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onBackspace: () => void;
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'del'],
];

export function NumPad({ onDigit, onDecimal, onBackspace }: NumPadProps) {
  function handlePress(key: string) {
    if (key === '.') onDecimal();
    else if (key === 'del') onBackspace();
    else onDigit(key);
  }

  return (
    <View style={styles.container}>
      {KEYS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.key,
                pressed && styles.keyPressed,
              ]}
              onPress={() => handlePress(key)}
            >
              <Text variant="h2" color="textPrimary">
                {key === 'del' ? '<' : key}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing[2], paddingHorizontal: spacing[4] },
  row: { flexDirection: 'row', gap: spacing[2] },
  key: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  keyPressed: { backgroundColor: colors.surfacePressed },
});
```

### Amount State Management (Numpad Logic)
```typescript
// Hook for managing amount input from numpad
function useAmountInput(maxCentavos: number = 99999900) {
  const [display, setDisplay] = useState('0');

  function toCentavos(): number {
    return Math.round(parseFloat(display) * 100);
  }

  function onDigit(digit: string) {
    setDisplay(prev => {
      if (prev === '0' && digit !== '0') return digit;
      if (prev === '0' && digit === '0') return prev;

      const dotIndex = prev.indexOf('.');
      // Already has 2 decimal places
      if (dotIndex !== -1 && prev.length - dotIndex > 2) return prev;

      const next = prev + digit;
      // Check max
      if (parseFloat(next) * 100 > maxCentavos) return prev;
      return next;
    });
  }

  function onDecimal() {
    setDisplay(prev => {
      if (prev.includes('.')) return prev;
      return prev + '.';
    });
  }

  function onBackspace() {
    setDisplay(prev => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  }

  return { display, centavos: toCentavos(), onDigit, onDecimal, onBackspace };
}
```

### Fetching Expenses with Splits for List View
```typescript
// Fetch expenses for a group with split info for current user
async function fetchGroupExpenses(groupId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      id,
      description,
      amount,
      paid_by,
      split_type,
      created_at,
      users!expenses_paid_by_fkey (display_name, avatar_url),
      expense_splits (user_id, amount)
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  return { data, error };
}
```

### Dot Page Indicator
```typescript
// Simple dot indicator for wizard steps
function DotIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === current ? colors.accent : colors.surface,
          }}
        />
      ))}
    </View>
  );
}
```

## Discretionary Recommendations

For items marked as Claude's discretion:

### Split Type Toggle: Use Segmented Control
**Recommendation:** A segmented control (two buttons side by side: "Equal" | "Custom") at the top of step 3. This is the clearest UX -- user sees both options immediately. Place it above the member list.

### Default Member Selection: All Selected
**Recommendation:** Default all group members as selected for equal splits. Users typically split with everyone; deselecting is rarer. This reduces taps for the common case.

### Custom Split Entry: Inline Fields
**Recommendation:** Show each member as a row with their name and an amount field to the right. Tapping the amount field opens the numpad for that member. Show "Remaining: X" prominently at the top. This is more visible than tap-to-edit modals.

### Expense Detail View: Bottom Sheet (simple)
**Recommendation:** Use a simple `Modal` with `animationType="slide"` and `presentationStyle="pageSheet"` (iOS) for the expense detail view. This gives a native bottom sheet feel without adding @gorhom/bottom-sheet. On Android, it appears as a full modal which is acceptable. The detail view shows: description, amount, payer, date, split type, and a list of all members with their individual amounts.

### Wizard Steps: 3 Steps
**Recommendation:** Keep exactly 3 steps as described:
1. Amount + Description (numpad + text input)
2. Payer (radio list, pre-selected current user)
3. Split Type + Members (segmented control + member list with checkboxes/amounts)

Step 3 combines split type and member selection because they are tightly coupled -- switching from equal to custom changes the member interaction entirely.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate inserts + hope | RPC atomic functions | Always best practice | Prevents orphaned expenses without splits |
| Float math for money | Integer centavo math | Always best practice | Prevents rounding errors |
| ScrollView pagingEnabled | react-native-pager-view | Library matured ~2022 | Native perf, proper events |
| TextInput for amounts | Custom numpad | Common in fintech apps | Prevents invalid input at source |

## Open Questions

1. **Database types file update**
   - What we know: `database.types.ts` needs the new `create_expense` RPC function signature added
   - What's unclear: Whether to regenerate from Supabase CLI or manually add
   - Recommendation: Manually add the function type to keep it in sync without requiring a running Supabase instance

2. **Tab bar "add" button behavior**
   - What we know: There is currently an `app/(tabs)/add.tsx` placeholder. The expense wizard lives at `app/group/[id]/add-expense.tsx` (group-scoped).
   - What's unclear: What should the bottom tab "add" button do? It could show a group picker then navigate to add-expense, or the tab could be removed in favor of a FAB on the group detail screen.
   - Recommendation: Add an "Add Expense" button on the group detail screen (where context is clear). The tab "add" screen can either list recent groups to quick-add, or redirect. This is a UX decision for the planner.

3. **Expense list pagination**
   - What we know: The requirement says "chronological list, most recent first"
   - What's unclear: Whether to paginate or load all at once
   - Recommendation: For Stage 1, load all expenses for a group (unlikely to exceed hundreds). Add pagination later if needed. Use FlatList for the expense list (unlike member lists which use ScrollView, expense lists can grow large).

## Sources

### Primary (HIGH confidence)
- Expo docs: react-native-pager-view - https://docs.expo.dev/versions/latest/sdk/view-pager/
- Existing codebase: supabase/migrations/00001_initial_schema.sql (expenses + expense_splits tables, RLS policies)
- Existing codebase: supabase/migrations/00002_fix_rls_recursion.sql (get_user_group_ids pattern)
- Existing codebase: supabase/migrations/00003_group_rpc_functions.sql (RPC pattern with security definer)
- Existing codebase: lib/database.types.ts (typed Supabase client)
- Existing codebase: app/group/[id].tsx (group detail screen structure)

### Secondary (MEDIUM confidence)
- Supabase RPC atomicity pattern - https://openillumi.com/en/en-supabase-transaction-rpc-atomicity/
- Currency math in JavaScript - https://frontstuff.io/how-to-handle-monetary-values-in-javascript
- @gorhom/bottom-sheet docs - https://gorhom.dev/react-native-bottom-sheet/ (evaluated, not recommended for Stage 1)

### Tertiary (LOW confidence)
- react-native-numeric-pad GitHub - https://github.com/RidicZhi/react-native-numeric-pad (evaluated, building custom instead)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - only adding one well-known library (react-native-pager-view), rest exists
- Architecture: HIGH - follows established patterns from phases 1-3 (RPC functions, component structure)
- Pitfalls: HIGH - currency rounding and atomic inserts are well-documented domain problems
- Discretionary UX: MEDIUM - recommendations based on common fintech app patterns, not verified with user testing

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days - stable domain, no fast-moving dependencies)
