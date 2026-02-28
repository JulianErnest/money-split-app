# Phase 17: Partial Settlement Amount Entry - Research

**Researched:** 2026-02-28
**Domain:** React Native bottom sheet UI + amount input integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Amount entry interaction
- Full balance amount pre-filled when sheet opens
- User taps the amount to activate NumPad (not immediately editable)
- Tapping clears the amount to P0.00 -- user types desired amount from scratch
- "Full amount" button available to quickly reset back to the full balance
- Full balance visible somewhere while editing (Claude's discretion on placement -- e.g., subtitle or inside the reset button)

#### Validation feedback
- Disabled confirm button only -- no inline error messages
- Minimum settlement amount: P1.00
- If remaining balance after payment would be less than P1.00, force a full settlement (no dust balances)
- NumPad prevents typing digits that would exceed the balance -- additional digits ignored at the cap

#### Partial vs full visual distinction
- Confirm button shows dynamic text: "Settle PX.XX" with the exact amount
- Whether to differentiate full settle text (e.g., "Settle P1,250.00 (Full)") -- Claude's discretion
- Whether to show "Partial payment" label or remaining balance preview -- Claude's discretion
- Sheet title/header behavior when editing -- Claude's discretion

#### Post-settlement confirmation
- Success toast + sheet closes, balance view refreshes automatically
- Toast messages differentiate: partial = "Settled P750.00 to Juan" / full = "Fully settled with Juan"
- No highlight animation on updated balance row -- just update the number
- Activity feed entries for partial settlements show "(partial)" label to distinguish from full settlements

### Claude's Discretion
- Full balance display placement while editing (subtitle vs button label)
- Whether confirm button differentiates full settle visually
- Whether to show "Partial payment" label or remaining balance preview on the sheet
- Sheet title/header changes during editing
- Loading and error state handling
- Exact NumPad integration approach with useAmountInput hook

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

This phase modifies the existing `SettleConfirmSheet` component to add partial settlement amount entry. The current sheet is a simple confirmation dialog (35% snap point) that shows a static amount and a "Confirm Settlement" button. The modification adds a NumPad for custom amount entry, validation logic, and differentiated toast messages.

The critical insight is that **all building blocks already exist**: the `NumPad` component, the `useAmountInput` hook pattern (currently inline in add-expense.tsx), the `AppBottomSheet` wrapper, and the `record_settlement` RPC (which already accepts any positive amount). The work is purely UI composition and state management -- no new components, no backend changes.

The main architectural challenge is managing two sheet states (initial confirmation view vs. editing view with NumPad), adapting the `useAmountInput` hook to support initialization with a pre-filled amount and a max cap, and properly sizing the bottom sheet to accommodate the NumPad.

**Primary recommendation:** Extract `useAmountInput` into a shared hook file with configurable max amount support, then rebuild SettleConfirmSheet as a two-state component (display mode vs. edit mode) that conditionally shows the NumPad and increases the snap point to ~75% when editing.

## Standard Stack

This phase uses NO new libraries. Everything is already in the project.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@gorhom/bottom-sheet` | ^5.2.8 | Bottom sheet container | Already used for SettleConfirmSheet and AddMemberSheet |
| `react-native-reanimated` | ~4.1.1 | Animations (sheet transitions) | Already a peer dependency of bottom-sheet |
| `expo-haptics` | (installed) | Touch feedback on settle | Already used in current SettleConfirmSheet |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/components/expenses/NumPad` | n/a | Digit input grid | Reuse directly -- already has onDigit/onDecimal/onBackspace |
| `@/components/ui/Toast` | n/a | Success/error messages | Already used in current SettleConfirmSheet |
| `@/lib/expense-utils` | n/a | `formatPeso`, `pesosToCentavos` | Currency formatting and display |

### Alternatives Considered
None -- all components exist and are appropriate for this use case.

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Current SettleConfirmSheet Structure (BEFORE)
```
SettleConfirmSheet (35% snap)
  -> Header: "Settle Up"
  -> Subtitle: "{payer} pays {receiver}"
  -> Static amount display (h1, accent color)
  -> Confirm button: "Confirm Settlement" / "Settling..."
  -> Cancel pressable
```

### Target SettleConfirmSheet Structure (AFTER)
```
SettleConfirmSheet (dynamic snap: 35% initial, ~75% when editing)
  -> Header: "Settle Up"
  -> Subtitle: "{payer} pays {receiver}"
  -> Pressable amount display (tap to enter edit mode)
     - Display mode: shows full balance, formatted, tappable
     - Edit mode: shows user-entered amount, formatted
  -> [Edit mode only] Full balance reference + "Full amount" reset button
  -> [Edit mode only] NumPad component
  -> Confirm button: "Settle PX.XX" with dynamic amount
  -> Cancel pressable
```

### Pattern 1: Two-State Sheet (Display vs Edit)
**What:** The sheet starts in "display" mode showing the full balance. Tapping the amount transitions to "edit" mode which reveals the NumPad and expands the sheet.
**When to use:** When a bottom sheet needs to show a simple confirmation but also support complex input.
**Example:**
```typescript
// Source: Codebase analysis of existing patterns
const [editing, setEditing] = useState(false);

// Dynamic snap points based on edit state
const snapPoints = useMemo(
  () => [editing ? "75%" : "35%"],
  [editing]
);

function handleAmountTap() {
  setEditing(true);
  // Clear to zero -- user types from scratch (per user decision)
  resetAmount();
}

function handleFullAmount() {
  setFullBalance();
  // Optionally exit edit mode or stay in it
}
```

### Pattern 2: Adapted useAmountInput with Max Cap
**What:** The existing `useAmountInput` hook needs adaptation to support: (a) initialization from an external value, (b) a maximum amount cap that prevents typing beyond the balance, and (c) the dust-balance forced-full-settle rule.
**When to use:** When reusing the NumPad for settlement entry vs. the original expense entry.
**Example:**
```typescript
// Source: Adapted from app/group/[id]/add-expense.tsx useAmountInput
function useSettlementAmountInput(maxCentavos: number) {
  const [display, setDisplay] = useState("0");

  function toCentavos(): number {
    return Math.round(parseFloat(display) * 100);
  }

  function onDigit(digit: string) {
    setDisplay((prev) => {
      if (prev === "0" && digit !== "0") return digit;
      if (prev === "0" && digit === "0") return prev;

      const dotIndex = prev.indexOf(".");
      if (dotIndex !== -1 && prev.length - dotIndex > 2) return prev;

      const next = prev + digit;
      const nextCentavos = Math.round(parseFloat(next) * 100);
      // Cap at max balance (not MAX_AMOUNT_CENTAVOS)
      if (nextCentavos > maxCentavos) return prev;
      return next;
    });
  }

  function onDecimal() {
    setDisplay((prev) => {
      if (prev.includes(".")) return prev;
      return prev + ".";
    });
  }

  function onBackspace() {
    setDisplay((prev) => {
      if (prev.length <= 1) return "0";
      return prev.slice(0, -1);
    });
  }

  function reset() {
    setDisplay("0");
  }

  function setFull() {
    // Convert centavos to display string
    setDisplay((maxCentavos / 100).toString());
  }

  const centavos = toCentavos();

  return {
    display,
    centavos,
    onDigit,
    onDecimal,
    onBackspace,
    reset,
    setFull,
  };
}
```

### Pattern 3: Dynamic Bottom Sheet Snap Points
**What:** Change snap points when entering/leaving edit mode so the sheet accommodates the NumPad.
**When to use:** When content size changes significantly within the same sheet.
**Important note:** The `AppBottomSheet` wrapper currently passes `snapPoints` directly and has `enableDynamicSizing={false}`. The component will need either a snap point change or a re-present when transitioning states. The simplest approach is to use `useMemo` on snap points and let `@gorhom/bottom-sheet` animate the transition.
**Example:**
```typescript
// The AppBottomSheet accepts snapPoints prop
// When editing state changes, pass new snap points
<AppBottomSheet
  ref={ref}
  snapPoints={editing ? ["75%"] : ["35%"]}
  onDismiss={onClose}
>
```

### Pattern 4: Validation Logic
**What:** The confirm button enables/disables based on three rules.
**Rules:**
1. Amount >= 100 centavos (P1.00 minimum)
2. Amount <= maxCentavos (cannot exceed balance)
3. If (maxCentavos - amount) < 100 and amount != maxCentavos, force full settlement

**Example:**
```typescript
function getEffectiveSettleAmount(
  enteredCentavos: number,
  balanceCentavos: number,
): { amount: number; isFullSettle: boolean } {
  // Dust rule: if remainder would be < P1.00, settle full amount
  const remainder = balanceCentavos - enteredCentavos;
  if (remainder > 0 && remainder < 100) {
    return { amount: balanceCentavos, isFullSettle: true };
  }
  return {
    amount: enteredCentavos,
    isFullSettle: enteredCentavos === balanceCentavos,
  };
}

const canConfirm =
  effectiveAmount >= 100 &&
  effectiveAmount <= balanceCentavos &&
  !loading;
```

### Anti-Patterns to Avoid
- **Modifying NumPad for settlement-specific logic:** The NumPad is a pure input component. Cap enforcement belongs in the hook, not the NumPad.
- **Using TextInput for amount entry:** The user decision explicitly chose NumPad (clear-and-retype model), not a native keyboard TextInput.
- **Creating a separate SettlePartialSheet component:** Modify the existing SettleConfirmSheet in place. It keeps the integration simple -- the parent (`app/group/[id].tsx`) already wires it up correctly.
- **Changing the record_settlement RPC:** The phase is purely UI work. The RPC already accepts any positive amount.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Digit-by-digit amount input | Custom TextInput with keyboard type | `NumPad` component + adapted `useAmountInput` hook | Already proven pattern in add-expense; NumPad gives full control over valid input |
| Currency formatting | Manual string formatting | `formatPeso` from `@/lib/expense-utils` | Handles thousands separators, 2 decimal places, Intl.NumberFormat |
| Bottom sheet management | Custom modal/overlay | `AppBottomSheet` + `useBottomSheet` | Already manages backdrop, dismiss, snap points |
| Haptic feedback patterns | Raw Vibration API | `expo-haptics` with existing patterns | SettleConfirmSheet already uses Haptics.notificationAsync |

**Key insight:** Every UI building block exists. The only new code is the composition logic (state management, validation, conditional rendering) inside SettleConfirmSheet.

## Common Pitfalls

### Pitfall 1: Snap Point Transition Jank
**What goes wrong:** Changing snapPoints on `@gorhom/bottom-sheet` v5 can cause a visual jump if not handled properly.
**Why it happens:** The BottomSheetModal re-calculates its position when snapPoints change. If the content layout hasn't settled, it can flicker.
**How to avoid:** Use `useMemo` for snap points so the array reference only changes when `editing` state changes. Keep content height predictable. Consider using `snapToIndex(0)` after state change if the sheet doesn't auto-animate.
**Warning signs:** Sheet jumps or flickers when tapping the amount to enter edit mode.

### Pitfall 2: Floating Point Dust in Validation
**What goes wrong:** Comparing `remainder < 100` can produce incorrect results if amounts are stored as floats.
**Why it happens:** JavaScript floating point arithmetic can produce values like 99.99999999 instead of 100.
**How to avoid:** Always do validation math in integer centavos. The `toCentavos()` function uses `Math.round(parseFloat(display) * 100)` which is correct. Never compare pesos (floats) directly.
**Warning signs:** User enters P99.01 on a P100.00 balance -- remainder is P0.99 which should trigger forced full settle, but float comparison fails.

### Pitfall 3: Stale amountCentavos Prop After Partial Settlement
**What goes wrong:** After a partial settlement, the parent component calls `onSettled()` which triggers `fetchData()`. But if the sheet is still mounted or re-opens, it might show the old balance.
**Why it happens:** The `amountCentavos` prop comes from `selectedSettle.amount` in the parent. After `fetchData()`, the settlements array is recalculated, but `selectedSettle` state might still hold the old value.
**How to avoid:** The current pattern already handles this: `onSettled` calls `fetchData()` and `onClose` clears the sheet. The sheet is conditionally rendered only when `selectedSettle` is non-null. After closing, the user would need to tap "Settle" again which would show the updated balance.
**Warning signs:** Re-opening the settle sheet after a partial settlement shows the original full balance instead of the remaining balance.

### Pitfall 4: useAmountInput Reset When Props Change
**What goes wrong:** If the hook's max amount changes (e.g., sheet re-opens with different balance), the internal display state might not reset.
**Why it happens:** React hooks maintain state across re-renders unless explicitly reset.
**How to avoid:** Reset the hook state when the sheet opens (triggered by `editing` state reset or a `useEffect` on `amountCentavos`). The current pattern of conditionally rendering `{selectedSettle && <SettleConfirmSheet ...>}` means the component unmounts and remounts, which naturally resets hook state.
**Warning signs:** Opening settle sheet for person A, closing, then opening for person B shows person A's amount.

### Pitfall 5: Activity Feed "(partial)" Label Without Backend Change
**What goes wrong:** The user decision says activity feed entries for partial settlements should show "(partial)". But the `get_recent_activity` RPC hardcodes `'Settlement'::text as description` for all settlements.
**Why it happens:** The RPC has no way to know if a settlement was partial or full -- it only stores the amount, not the balance at time of settlement.
**How to avoid:** Two options: (a) update the activity feed RPC to include a flag, or (b) handle the "(partial)" label client-side. Since this phase is "purely UI work -- no backend/database changes", the client-side approach is simpler. However, the client doesn't have the original balance context when rendering activity items. This is an **open question** -- see Open Questions section.
**Warning signs:** Activity feed shows "Settlement" for both partial and full settlements with no way to distinguish.

## Code Examples

### Current SettleConfirmSheet Props Interface
```typescript
// Source: components/settlements/SettleConfirmSheet.tsx
interface SettleConfirmSheetProps {
  groupId: string;
  payerName: string;    // debtor display name
  payerId: string;      // debtor user id
  receiverName: string; // creditor display name
  receiverId: string;   // creditor user id
  amountCentavos: number; // full balance in centavos
  onSettled: () => void;
  onClose: () => void;
}
```

### Current Parent Integration
```typescript
// Source: app/group/[id].tsx lines 842-856
{selectedSettle && (
  <SettleConfirmSheet
    ref={settleSheetRef}
    groupId={id!}
    payerName={getMemberDisplayName(selectedSettle.from)}
    payerId={selectedSettle.from}
    receiverName={getMemberDisplayName(selectedSettle.to)}
    receiverId={selectedSettle.to}
    amountCentavos={selectedSettle.amount}
    onSettled={async () => {
      await fetchData();
    }}
    onClose={closeSettleSheet}
  />
)}
```

### NumPad Props Interface
```typescript
// Source: components/expenses/NumPad.tsx
interface NumPadProps {
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onBackspace: () => void;
}
```

### record_settlement RPC Call Pattern
```typescript
// Source: components/settlements/SettleConfirmSheet.tsx
const { error } = await supabase.rpc("record_settlement", {
  p_group_id: groupId,
  p_paid_by: payerId,
  p_paid_to: receiverId,
  p_amount: amountCentavos / 100, // convert centavos to pesos for DB
});
```

### trackSettleUp Analytics Pattern
```typescript
// Source: lib/analytics.ts
// Currently tracks groupId and amount -- may want to add isPartial flag
trackSettleUp({ groupId, amount: amountCentavos / 100 });
```

### Toast Message Pattern
```typescript
// Source: components/ui/Toast.tsx
// showToast accepts { message: string, type: "error" | "success" | "info" }
showToast({ message: "Settled!", type: "success" });
// New patterns needed:
// Partial: showToast({ message: `Settled P${formatPeso(amount)} to ${name}`, type: "success" })
// Full:    showToast({ message: `Fully settled with ${name}`, type: "success" })
```

### Dust Balance Validation Example
```typescript
// Example: balance = P100.00 (10000 centavos)
// User enters P99.50 (9950 centavos)
// Remainder = 50 centavos = P0.50 < P1.00
// Force full settlement: settle P100.00 instead

function getEffectiveAmount(enteredCentavos: number, balanceCentavos: number) {
  if (enteredCentavos === 0) return { amount: 0, isFullSettle: false };
  const remainder = balanceCentavos - enteredCentavos;
  if (remainder > 0 && remainder < 100) {
    // Dust rule: force full settlement
    return { amount: balanceCentavos, isFullSettle: true };
  }
  return {
    amount: enteredCentavos,
    isFullSettle: enteredCentavos >= balanceCentavos,
  };
}
```

## Discretionary Recommendations

For the areas marked as "Claude's discretion":

### 1. Full balance display placement while editing
**Recommendation:** Show as subtitle text below the editable amount: "Balance: P1,250.00" in `textSecondary` color. Additionally, the "Full amount" button label includes the amount: "Full amount (P1,250.00)".
**Rationale:** Subtitle is always visible without taking extra space. Including the amount in the button label gives a one-tap path back and serves as a reminder.

### 2. Whether confirm button differentiates full settle visually
**Recommendation:** Yes, append "(Full)" to the button text when the effective amount equals the full balance: "Settle P1,250.00 (Full)".
**Rationale:** Gives the user confidence they are settling the entire debt. Minimal effort -- just a string conditional.

### 3. Whether to show "Partial payment" label or remaining balance preview
**Recommendation:** Show remaining balance preview below the amount when editing and amount is partial: "Remaining: P500.00". Do NOT show a "Partial payment" label -- the amount itself makes it obvious.
**Rationale:** Remaining balance is more actionable information than a label. Users care about "how much will be left" not "is this partial".

### 4. Sheet title/header changes during editing
**Recommendation:** Keep the title as "Settle Up" in both modes. No change needed.
**Rationale:** Changing the title adds visual noise. The NumPad appearing is sufficient context change.

### 5. Loading and error state handling
**Recommendation:** Reuse the exact same pattern as the current sheet: `loading` state disables button, button shows "Settling..." via `loading` prop, errors show toast. No changes needed to the error path.
**Rationale:** Consistency with existing UX. The only change is the confirm button text uses dynamic amount instead of static "Confirm Settlement".

### 6. Exact NumPad integration approach
**Recommendation:** Create a `useSettlementAmountInput(maxCentavos)` hook inline in the SettleConfirmSheet file (same pattern as `useAmountInput` in add-expense.tsx but with max cap and reset/setFull methods). Wire `onDigit`, `onDecimal`, `onBackspace` to NumPad. Do NOT extract to a shared hook file -- the two hooks have different max logic (global MAX_AMOUNT_CENTAVOS vs. dynamic balance cap) and extracting would add unnecessary abstraction.
**Rationale:** The existing pattern puts the hook in the same file. The settlement version has different constraints (dynamic max, reset, setFull) that make it a distinct concern.

## Open Questions

1. **Activity feed "(partial)" label**
   - What we know: The user wants partial settlements to show "(partial)" in the activity feed. The `get_recent_activity` RPC returns `'Settlement'::text as description` for all settlements. The phase scope says "no backend changes."
   - What's unclear: How to distinguish partial from full settlements in the activity feed without a database change. The settlements table stores only `amount`, not `is_partial` or `original_balance`.
   - Recommendation: Two approaches:
     - **(a) Small schema addition (preferred):** Add an `is_partial boolean default false` column to the settlements table and update the RPC description to `'Settlement (partial)'` when true. This is minimal backend work.
     - **(b) Client-side approximation:** When rendering a settlement in the activity feed, compare the settlement amount against the current balance. But this is unreliable since balances change over time.
     - **(c) Accept the limitation:** Show "(partial)" only in the success toast message (which the user explicitly requested) and in the settlement history on the group detail page where we have balance context. Skip the activity feed label since it requires backend changes outside phase scope.
   - **Planner should decide** which approach fits the "purely UI work" constraint. Option (c) is safest for scope, but option (a) is a trivial DB change.

2. **Settlement history "(partial)" display on group detail page**
   - What we know: The settlement history section in `app/group/[id].tsx` shows `{sh.payer_name} paid {sh.receiver_name}` with the amount. It comes from a Supabase query on the settlements table.
   - What's unclear: Without an `is_partial` column, how does the group detail page know a settlement was partial?
   - Recommendation: Same as above -- this is tied to the activity feed question. If option (a) is chosen, the group detail settlement history can also use the flag.

3. **Dynamic snap point animation quality**
   - What we know: `@gorhom/bottom-sheet` v5 supports changing snap points, and the sheet should animate smoothly between them.
   - What's unclear: Whether changing `snapPoints` on a mounted `BottomSheetModal` triggers a smooth animation or requires calling `snapToIndex`.
   - Recommendation: Test during implementation. If the transition is janky, use `ref.current?.snapToIndex(0)` after updating snap points.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - Direct reading of all relevant source files:
  - `components/settlements/SettleConfirmSheet.tsx` - Current sheet implementation
  - `components/expenses/NumPad.tsx` - NumPad component API
  - `app/group/[id]/add-expense.tsx` - `useAmountInput` hook pattern
  - `components/ui/BottomSheet.tsx` - `AppBottomSheet` wrapper
  - `components/ui/Button.tsx` - Button props (label, disabled, loading)
  - `components/ui/Toast.tsx` - Toast API (showToast with message + type)
  - `lib/expense-utils.ts` - `formatPeso`, `MAX_AMOUNT_CENTAVOS`
  - `lib/balance-utils.ts` - `Settlement` type definition
  - `lib/analytics.ts` - `trackSettleUp` signature
  - `lib/activity.ts` - `ActivityItem` type and fetch
  - `app/group/[id].tsx` - Parent component integration
  - `app/activity.tsx` - Activity feed rendering
  - `supabase/migrations/00021_settlements_table.sql` - `record_settlement` RPC
  - `supabase/migrations/00022_activity_feed_rpc.sql` - `get_recent_activity` RPC
- **Package versions** - `@gorhom/bottom-sheet` ^5.2.8, `react-native-reanimated` ~4.1.1

### Secondary (MEDIUM confidence)
- None needed -- all findings from codebase analysis

### Tertiary (LOW confidence)
- `@gorhom/bottom-sheet` v5 dynamic snap point animation behavior -- not verified with official docs, based on general understanding of the library

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components verified by reading source files directly
- Architecture: HIGH - Patterns derived from existing codebase conventions
- Pitfalls: HIGH - Identified from actual code paths and data flow analysis
- Discretionary recommendations: MEDIUM - Based on UX judgment, not verified with users

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable -- no external dependencies changing)
