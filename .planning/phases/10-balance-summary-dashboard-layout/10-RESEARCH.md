# Phase 10: Balance Summary & Dashboard Layout - Research

**Researched:** 2026-02-21
**Domain:** React Native dashboard UI, SectionList restructuring, typography hierarchy
**Confidence:** HIGH

## Summary

This phase transforms the existing home screen (`app/(tabs)/index.tsx`) from a flat groups list into a sectioned dashboard with a prominent balance summary header. The existing codebase already has all the data-fetching infrastructure needed -- `get_my_group_balances` RPC returns per-group balances, and the `fetchBalances` callback already stores them in a `Map<string, number>` (centavos). The work is purely UI: summing balances, creating a visually prominent header component, restructuring the screen into clear dashboard sections, and establishing typography hierarchy.

The existing design system provides everything needed: `moneyLarge` text style (48px ExtraBold) for the hero balance number, `accent`/`error`/`textSecondary` color tokens for balance color-coding, and `spacing`/`radius` tokens for section separation. No new libraries are required.

The key architectural decision is how to add the balance summary to the existing SectionList. The cleanest approach is using `ListHeaderComponent` on the SectionList, which renders a fixed header above all sections. This avoids re-architecting the current SectionList-based layout while adding the balance summary and activity placeholder as dashboard elements above the groups list.

**Primary recommendation:** Use SectionList's `ListHeaderComponent` for the balance summary + activity placeholder, keeping the existing section infrastructure for invites and groups. Sum the existing `groupBalances` Map to derive the net balance -- no new RPC calls needed.

## Standard Stack

This phase uses ONLY existing project dependencies. No new installations required.

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native | 0.81.5 | Core framework | Already in project |
| expo-router | ~6.0.23 | Navigation | Already in project |
| moti | ^0.30.0 | Animations (fade-in) | Already used for group card animations |
| react-native-safe-area-context | ~5.6.0 | Safe area handling | Already used in home screen |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/supabase-js | ^2.96.0 | Data fetching (RPC) | Already used for `get_my_group_balances` |
| expo-linear-gradient | ~15.0.8 | Optional accent gradient for balance area | Available if needed for visual polish |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SectionList ListHeaderComponent | ScrollView + FlatList | Would break existing SectionList structure, more complex |
| Inline balance sum calculation | New RPC for total balance | Over-engineering; sum of existing data is trivial |
| expo-linear-gradient for balance area | Plain backgroundColor | Gradient adds visual distinction but is optional |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Current Home Screen Structure (BEFORE)
```
SafeAreaView
  Header ("Groups" + "+" button)
  SectionList
    Section: "Pending Invites" (invite cards)
    Section: "My Groups" (group cards)
```

### Target Dashboard Structure (AFTER)
```
SafeAreaView
  SectionList
    ListHeaderComponent:
      BalanceSummaryHeader
        - Net balance (moneyLarge, color-coded)
        - Subtext ("You are owed" / "You owe" / "All settled up")
      ActivityPlaceholder
        - Section title "Recent Activity"
        - Placeholder text for Phase 11
      Section divider
    Section: "Pending Invites" (invite cards) -- only when invites exist
    Section: "My Groups" (group cards)
```

### Pattern 1: ListHeaderComponent for Dashboard Header
**What:** SectionList's `ListHeaderComponent` prop renders a component above all sections, scrolling with the list
**When to use:** When you need a persistent-but-scrollable header above sectioned data
**Why this pattern:**
- Keeps the existing SectionList with invites + groups intact
- Balance header scrolls naturally with content (not a fixed overlay eating screen space)
- SectionList already handles pull-to-refresh, which also refreshes balance data
- No need to restructure the entire screen

**Example:**
```typescript
// Source: React Native SectionList documentation
<SectionList
  ListHeaderComponent={<DashboardHeader netBalance={netBalance} />}
  sections={sections}
  renderItem={renderItem}
  // ... existing props
/>
```

### Pattern 2: Derived State for Net Balance
**What:** Compute net balance from existing `groupBalances` Map using `useMemo`
**When to use:** When the aggregate value is a simple sum of already-fetched data
**Why this pattern:**
- `groupBalances` state already holds per-group net balances in centavos
- A single `useMemo` that sums the Map values is O(n) where n = number of groups (tiny)
- Avoids a separate API call for total balance
- Re-derives automatically when `groupBalances` updates (on focus, refresh, sync)

**Example:**
```typescript
// Source: Existing codebase pattern
const netBalance = useMemo(() => {
  let total = 0;
  for (const centavos of groupBalances.values()) {
    total += centavos;
  }
  return total;
}, [groupBalances]);
```

### Pattern 3: Color-Coding Using Existing Balance Utils
**What:** Reuse `formatBalanceColor` and `formatBalanceSummary` from `lib/balance-utils.ts`
**When to use:** Whenever displaying balance amounts with color semantics
**Why this pattern:**
- `formatBalanceColor(centavos)` already returns `"accent"` (green), `"error"` (red), or `"textSecondary"` (neutral)
- `formatBalanceSummary(centavos, formatPeso)` already returns "You are owed P...", "You owe P...", or "Settled up"
- These utilities are already used in the group card rendering -- reusing them ensures consistency

**Example:**
```typescript
// Source: Existing lib/balance-utils.ts
<Text variant="moneyLarge" color={formatBalanceColor(netBalance)}>
  {netBalance === 0 ? "P0.00" : `P${formatPeso(Math.abs(netBalance))}`}
</Text>
<Text variant="body" color="textSecondary">
  {formatBalanceSummary(netBalance, formatPeso)}
</Text>
```

### Pattern 4: Section Separation via Spacing and Dividers
**What:** Use spacing tokens and subtle border/background differences to create visual section boundaries
**When to use:** Dashboard layouts with multiple distinct content areas
**Why this pattern:**
- The design system already has `spacing[6]` (24px), `spacing[8]` (32px) for major gaps
- `colors.border` (`#2A2A2A`) and `colors.borderSubtle` (`#222222`) for horizontal dividers
- `colors.backgroundCard` (`#1A1A1A`) for section card backgrounds vs `colors.background` (`#0D0D0D`)
- These are the established patterns in the existing app

**Example:**
```typescript
// Section separator component
const SectionDivider = () => (
  <View style={{
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing[6],
    marginHorizontal: spacing[6],
  }} />
);
```

### Pattern 5: Typography Hierarchy for Dashboard
**What:** Use the existing text style scale to guide the eye through sections
**When to use:** Multi-section screens where information hierarchy matters

The existing typography scale provides a clear hierarchy:
```
moneyLarge  -> 48px ExtraBold  -> Hero balance number
h1          -> 30px Bold       -> Screen title (if kept)
h2          -> 24px SemiBold   -> Section titles
h3          -> 20px SemiBold   -> Sub-section titles
bodyMedium  -> 15px Medium     -> Card titles, emphasis text
body        -> 15px Regular    -> Descriptions
caption     -> 13px Regular    -> Secondary info, labels
label       -> 13px Medium     -> Uppercase section labels
```

**Recommended hierarchy for dashboard:**
- Balance amount: `moneyLarge` (48px) -- dominates the screen
- Balance descriptor: `body` + `textSecondary` -- explains the number
- Section titles ("Recent Activity", "My Groups"): `label` variant -- uppercase, understated
- Group card names: `bodyMedium` -- existing pattern

### Anti-Patterns to Avoid
- **Don't use ScrollView wrapping SectionList:** Nesting scrollable views causes performance and gesture issues in React Native. SectionList already scrolls.
- **Don't create a new API endpoint for total balance:** The data is already fetched. Sum it client-side.
- **Don't use fixed/absolute positioning for the balance header:** It should scroll with content, not eat screen real estate on small devices.
- **Don't change the "Groups" header into "Dashboard" text:** The tab is labeled "Groups" in the TabBar. The page title can change but the tab label should stay for navigation clarity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Balance color logic | Custom color selection | `formatBalanceColor()` from `lib/balance-utils.ts` | Already handles all 3 states consistently |
| Balance text summary | Custom conditional text | `formatBalanceSummary()` from `lib/balance-utils.ts` | Already handles all 3 states with correct wording |
| Peso formatting | Manual string formatting | `formatPeso()` from `lib/expense-utils.ts` | Handles commas, decimal places, locale correctly |
| Section spacing | Ad-hoc pixel values | `spacing` tokens from `@/theme` | Maintains design system consistency |
| Typography styles | Inline fontSize/fontWeight | `textStyles` variants via `<Text variant="...">` | All typography is pre-defined in the design system |
| Pull-to-refresh | Custom refresh logic | Existing `AnimatedRefreshControl` + `handleRefresh` | Already wired to fetch groups, balances, invites |

**Key insight:** This phase is 100% UI restructuring. All data fetching, balance computation logic, and formatting utilities already exist. The work is arranging existing building blocks into a dashboard layout.

## Common Pitfalls

### Pitfall 1: SectionList TypeScript Mismatch
**What goes wrong:** The existing code already has a TS error (`sections as any` cast on line 593) because `InviteSection` and `GroupSection` have different `data` types. Adding `ListHeaderComponent` won't make this worse, but be aware when modifying SectionList props.
**Why it happens:** SectionList expects uniform section types. The project uses a union type `HomeSection` with different data shapes per section.
**How to avoid:** Continue using the `as any` cast for `sections` prop. This is a known cosmetic issue that does not affect runtime behavior (documented in STATE.md).
**Warning signs:** TypeScript errors on SectionList props that don't affect actual rendering.

### Pitfall 2: Empty State When No Groups Exist
**What goes wrong:** If the user has no groups, `groupBalances` is an empty Map, net balance is 0, and the balance header shows "P0.00 - All settled up". This is technically correct but misleading for new users.
**Why it happens:** Zero balance can mean "all settled" or "no data yet".
**How to avoid:** Check `groups.length === 0` alongside `netBalance === 0`. If no groups exist, either hide the balance header or show a different message like "No groups yet".
**Warning signs:** New user sees "All settled up" before adding any groups.

### Pitfall 3: Balance Flicker on Navigation Focus
**What goes wrong:** When user navigates back to the home tab, `fetchBalances()` is called via `useFocusEffect`. During the fetch, the old balance shows, then updates. If there's a loading state reset, it could flash.
**Why it happens:** The existing code does NOT reset state before re-fetching on focus (good), but adding a loading indicator to the balance header could introduce this.
**How to avoid:** Do NOT add a loading state to the balance header. The existing pattern fetches in the background and updates state when done. The stale-while-revalidate approach is correct here.
**Warning signs:** Balance number briefly disappearing or flickering to 0 on tab focus.

### Pitfall 4: Header Height Affecting Scroll Performance
**What goes wrong:** An overly tall ListHeaderComponent pushes section content far down, making the initial render feel empty or requiring excessive scrolling.
**Why it happens:** Balance header + activity placeholder + spacing can add up to 200+ pixels.
**How to avoid:** Keep the balance header compact: ~120px (balance number + descriptor + padding). Activity placeholder should be minimal (~80px with title + "Coming soon" text). Total header should be under 220px.
**Warning signs:** User has to scroll to see their first group card.

### Pitfall 5: Removing the Existing Header
**What goes wrong:** The current screen has a "Groups" header with "+" button at the top. If this is removed or repositioned incorrectly, the create-group flow breaks.
**Why it happens:** The "+" button triggers `openCreateSheet()` for the bottom sheet create flow.
**How to avoid:** Either keep the header row but rename it (e.g., "Home" or just remove the title and keep the "+" button), or integrate the "+" button into the dashboard header area. The `openCreateSheet` bottom sheet must remain functional.
**Warning signs:** No way to create a new group from the home screen.

## Code Examples

### Computing Net Balance from Existing State
```typescript
// Source: Derived from existing fetchBalances in app/(tabs)/index.tsx
// groupBalances is already Map<string, number> (centavos, positive = owed to user)
const netBalance = useMemo(() => {
  let total = 0;
  for (const centavos of groupBalances.values()) {
    total += centavos;
  }
  return total;
}, [groupBalances]);
```

### Balance Summary Header Component
```typescript
// Source: Composition of existing design system tokens
import { Text } from "@/components/ui/Text";
import { formatBalanceColor, formatBalanceSummary } from "@/lib/balance-utils";
import { formatPeso } from "@/lib/expense-utils";
import { colors, spacing } from "@/theme";

interface BalanceSummaryProps {
  netBalance: number; // centavos
  hasGroups: boolean;
}

function BalanceSummary({ netBalance, hasGroups }: BalanceSummaryProps) {
  if (!hasGroups) return null; // Don't show balance header if no groups

  const balanceColor = formatBalanceColor(netBalance);
  const displayAmount = netBalance === 0
    ? "P0.00"
    : `${netBalance > 0 ? "+" : "-"}P${formatPeso(Math.abs(netBalance))}`;

  return (
    <View style={balanceSummaryStyles.container}>
      <Text variant="caption" color="textSecondary">
        Overall Balance
      </Text>
      <Text variant="moneyLarge" color={balanceColor}>
        {displayAmount}
      </Text>
      <Text variant="body" color="textSecondary">
        {formatBalanceSummary(netBalance, formatPeso)}
      </Text>
    </View>
  );
}

const balanceSummaryStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
  },
});
```

### Dashboard Header with Activity Placeholder
```typescript
// Source: Pattern using ListHeaderComponent
function DashboardHeader({
  netBalance,
  hasGroups,
}: {
  netBalance: number;
  hasGroups: boolean;
}) {
  return (
    <View>
      {/* Balance Section */}
      <BalanceSummary netBalance={netBalance} hasGroups={hasGroups} />

      {/* Section Divider */}
      <View style={dashStyles.divider} />

      {/* Activity Placeholder (for Phase 11) */}
      <View style={dashStyles.activitySection}>
        <Text variant="label" color="textSecondary">
          Recent Activity
        </Text>
        <Text variant="body" color="textTertiary" style={dashStyles.placeholder}>
          Coming soon
        </Text>
      </View>

      {/* Section Divider */}
      <View style={dashStyles.divider} />
    </View>
  );
}

const dashStyles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: spacing[6],
  },
  activitySection: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    gap: spacing[2],
  },
  placeholder: {
    fontStyle: "italic",
  },
});
```

### Wiring into Existing SectionList
```typescript
// Source: Modification of existing app/(tabs)/index.tsx render
<SectionList
  ListHeaderComponent={
    <DashboardHeader netBalance={netBalance} hasGroups={groups.length > 0} />
  }
  sections={sections as any}
  renderItem={renderItem}
  renderSectionHeader={renderSectionHeader}
  renderSectionFooter={renderSectionFooter}
  keyExtractor={keyExtractor}
  contentContainerStyle={styles.list}
  stickySectionHeadersEnabled={false}
  alwaysBounceVertical={true}
  refreshControl={
    <AnimatedRefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
    />
  }
/>
```

### Updated Screen Header (Simplified)
```typescript
// Source: Modification of existing header
// Change from "Groups" title to a minimal header or remove title entirely
// Keep the "+" create button accessible
<View style={styles.header}>
  <Text variant="h2" color="textPrimary">
    Home
  </Text>
  <Pressable
    onPress={() => openCreateSheet()}
    style={({ pressed }) => [
      styles.addButton,
      pressed && styles.addButtonPressed,
    ]}
  >
    <Text variant="h1" color="accent" style={styles.addButtonText}>
      +
    </Text>
  </Pressable>
</View>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat groups list | Sectioned dashboard with balance header | This phase | User immediately sees financial position |
| Per-group balance only | Net balance across all groups | This phase | One-glance financial summary |
| "Groups" page title | Dashboard-style layout with section labels | This phase | Clearer information hierarchy |

**Not changing:**
- Data fetching approach (RPC + useFocusEffect) -- already optimal
- SectionList as the scrolling container -- proven in the app
- Balance color-coding logic -- already implemented in `balance-utils.ts`
- Pull-to-refresh -- already wired and functional

## Open Questions

1. **Should the page title change from "Groups" to "Home"?**
   - What we know: The TabBar labels the tab as "Groups" with a people icon. The current page header says "Groups".
   - What's unclear: Whether the user wants a "Home" branding for the dashboard feel, or keep "Groups" for consistency with the tab.
   - Recommendation: Change the page header to "Home" but leave the tab bar label as-is. Phase 12 may want to revisit tab naming. Alternatively, remove the page title entirely and let the balance header be the visual anchor.

2. **Balance sign convention: show +/- prefix or not?**
   - What we know: `formatBalanceSummary` returns "You are owed P..." / "You owe P..." which clarifies direction. The color also communicates direction.
   - What's unclear: Whether the large balance number should include a +/- prefix for additional clarity.
   - Recommendation: Show the amount without +/- but WITH the color-coding and the text descriptor below. The combination of color + text + amount is sufficient. Keep it clean: just "P1,234.56".

3. **How minimal should the activity placeholder be?**
   - What we know: Phase 11 will implement the full activity feed. Phase 10 just needs a placeholder section.
   - What's unclear: Whether the placeholder should be a visible "Coming soon" section or an invisible reserved space.
   - Recommendation: Show a minimal visible placeholder with "Recent Activity" label and "Coming soon" text. This validates the dashboard layout and section spacing before Phase 11 fills it in. If this feels clunky, it can simply be omitted and added in Phase 11 -- the balance header and groups sections alone satisfy all Phase 10 requirements.

## Sources

### Primary (HIGH confidence)
- **Existing codebase** (`app/(tabs)/index.tsx`) - Current home screen implementation, SectionList structure, state management
- **Existing codebase** (`lib/balance-utils.ts`) - `formatBalanceColor`, `formatBalanceSummary` utilities
- **Existing codebase** (`lib/expense-utils.ts`) - `formatPeso` formatting function
- **Existing codebase** (`theme/typography.ts`) - `moneyLarge` (48px ExtraBold), full text style scale
- **Existing codebase** (`theme/colors.ts`) - `accent` (green), `error` (red), `textSecondary` semantic tokens
- **Existing codebase** (`theme/spacing.ts`) - Spacing and radius tokens
- **Existing codebase** (`lib/database.types.ts`) - `get_my_group_balances` RPC return type
- **Existing codebase** (`components/ui/Text.tsx`) - Text component with variant + color props

### Secondary (MEDIUM confidence)
- **React Native SectionList API** - `ListHeaderComponent` prop for headers above sections (well-documented, stable API)

### Tertiary (LOW confidence)
- None -- this phase uses only existing, verified codebase patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed, all existing
- Architecture: HIGH - SectionList ListHeaderComponent is well-documented React Native API, and the existing screen structure is fully understood
- Pitfalls: HIGH - Based on direct analysis of existing code and known issues documented in STATE.md

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable -- no external dependencies changing)
