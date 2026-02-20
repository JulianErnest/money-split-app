# Phase 12: Group Cards & Visual Polish - Research

**Researched:** 2026-02-21
**Domain:** React Native visual polish, glassmorphism cards, gradient backgrounds, avatar stacks, warm accent colors
**Confidence:** HIGH

## Summary

This phase transforms the home screen from a functional dashboard into a polished, branded product. The work spans four areas: (1) a gradient background behind the balance header using `expo-linear-gradient` (already installed), (2) glassmorphism-style group cards using semi-transparent backgrounds with subtle borders (no blur library needed), (3) enriched group card data — last activity date, member avatar stack, per-group balance, and (4) warm accent colors (amber/coral) and improved empty states.

The existing codebase provides nearly all the infrastructure. `expo-linear-gradient` v15.0.8 is already in `package.json`. The `Card` component (`components/ui/Card.tsx`) is simple and easily extended. The `Avatar` component supports multiple sizes. The `get_my_group_balances` RPC already provides per-group balances (already rendered in group cards). The activity feed RPC (`get_recent_activity`) already returns `group_id` and `created_at` — but for per-group last activity, a new lightweight query or RPC is more efficient than re-parsing the full activity feed.

The glassmorphism approach uses a CSS-only technique (semi-transparent rgba backgrounds + subtle border + slight elevation) rather than `expo-blur`. This avoids adding a new dependency, avoids Android blur performance issues, and achieves the "premium, modern feel" on dark theme that the user wants. On a dark background (#0D0D0D), a card with `rgba(255,255,255,0.05)` background and `rgba(255,255,255,0.08)` border creates a convincing frosted-glass effect without actual blur.

**Primary recommendation:** Use `expo-linear-gradient` for the balance header gradient, CSS-only glassmorphism for group cards (rgba transparency + border), a new Supabase RPC for per-group last activity + member names, warm accent palette tokens (amber/coral) added to the theme, and `MotiPressable` for card press effects.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Balance header treatment:** Gradient background behind the balance area at the top of the dashboard. Dark-to-accent fade style — bold, app-like feel. Should integrate with existing green/red balance color-coding.
- **Card style:** Glassmorphism for group cards — semi-transparent with blur effect. Premium, modern feel that works with the dark theme. Each group card should feel distinct from the background.
- **Color palette:** Warm accent tones (amber, coral) alongside existing green/red balance colors. Friendly, warm vibe — Filipino fiesta energy. Warm accents used for brand touches, not replacing the functional green/red system.
- **Empty states:** Minimal + English — simple icon with short English copy. Clean, professional tone — not overly playful. Should guide users toward action (create group, add expense).

### Claude's Discretion
- Exact gradient colors and direction for balance header
- Specific glassmorphism blur intensity and transparency levels
- Which warm accent colors to use (specific amber/coral hex values)
- Group card information layout (avatar stack positioning, balance placement, last activity format)
- Micro-interactions and press effects on cards
- Typography adjustments for polish pass

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

This phase uses mostly existing project dependencies. One small addition may be needed for blur, but CSS-only glassmorphism is recommended to avoid it.

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-linear-gradient | ~15.0.8 | Gradient background for balance header | Already in package.json, Expo's official gradient solution |
| moti | ^0.30.0 | MotiPressable for card press animations, MotiView for fade-ins | Already used for group card fade animations |
| react-native-reanimated | ~4.1.1 | Powers moti animations | Already installed |
| react-native-gesture-handler | ~2.28.0 | Required by MotiPressable interactions | Already installed |
| @supabase/supabase-js | ^2.96.0 | New RPC for per-group card data | Already used throughout |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-native (StyleSheet) | 0.81.5 | rgba backgrounds, borders for glassmorphism | Core card styling |
| expo-haptics | ~15.0.8 | Press feedback on cards | Already used in existing Pressable interactions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS-only glassmorphism (rgba + border) | expo-blur BlurView | expo-blur adds dependency, has Android performance issues, rendering order gotchas. CSS-only achieves 90% of the effect on dark backgrounds with zero overhead |
| MotiPressable for press effects | Animated.Value + Pressable | MotiPressable is zero-re-renders and already available via moti |
| New RPC for group card data | Client-side queries per group | Single RPC is more efficient than N+1 queries for N groups |

**Installation:**
```bash
# No new packages needed — expo-linear-gradient and moti already installed
# If real blur is strongly desired later:
# npx expo install expo-blur
```

## Architecture Patterns

### Current Group Card Structure (BEFORE)
```
Card (backgroundCard: #1A1A1A)
  Row
    Avatar (emoji, size md)
    Info column
      Group name (bodyMedium)
      Member count (caption, textSecondary)
      Balance text (caption, color-coded) -- only if nonzero
    Chevron (">")
```

### Target Group Card Structure (AFTER)
```
GlassmorphismCard (rgba background, subtle border, radius.lg)
  Row
    Avatar (emoji, size md)
    Info column
      Group name (bodyMedium)
      Last activity date (caption, textTertiary) -- e.g. "2h ago" or "Feb 20"
    Balance column (right-aligned)
      Balance amount (bodyMedium, color-coded)
      Balance descriptor (caption, textSecondary) -- "owed" or "owe"
  AvatarStack row (below main row)
    Overlapping small avatars (first 3-4 members)
    "+N" overflow indicator if more
```

### Target Balance Header Structure (AFTER)
```
LinearGradient (dark-to-accent fade)
  Overall Balance label (caption, textSecondary)
  P{amount} (moneyLarge, color-coded)
  Balance summary text (body, textSecondary)
```

### Pattern 1: CSS-Only Glassmorphism on Dark Theme
**What:** Semi-transparent card backgrounds with subtle borders to create frosted-glass appearance without actual blur
**When to use:** Dark themes where the background is very dark (#0D0D0D) — transparency contrast is inherent
**Why this pattern:**
- No new dependency required
- No Android blur performance issues
- Works consistently across all platforms
- On dark backgrounds, even subtle transparency creates visible "glass" layering
- Avoids expo-blur's rendering order gotcha with FlatList/SectionList

**Example:**
```typescript
// Source: Verified React Native rgba support (reactnative.dev/docs/colors)
const glassCard = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',  // 5% white on dark bg
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',       // subtle glass edge
    borderRadius: radius.lg,
    padding: spacing[4],
  },
});
```

### Pattern 2: LinearGradient for Balance Header
**What:** Dark-to-accent gradient behind the balance area
**When to use:** Hero sections that need visual weight and brand identity
**Why this pattern:**
- `expo-linear-gradient` already installed
- Gradient direction and colors easily tuned via props
- Integrates with existing balance color-coding (green/red)

**Example:**
```typescript
// Source: expo-linear-gradient docs (docs.expo.dev/versions/latest/sdk/linear-gradient/)
import { LinearGradient } from 'expo-linear-gradient';

<LinearGradient
  colors={['#0D0D0D', 'rgba(159, 232, 112, 0.15)', '#0D0D0D']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={balanceHeaderStyles.gradient}
>
  {/* Balance content */}
</LinearGradient>
```

### Pattern 3: Avatar Stack with Overlapping Layout
**What:** Horizontal row of small avatars with negative margin to create overlap
**When to use:** Showing group membership at a glance without taking much space
**Why this pattern:**
- Pure React Native styling — no library needed
- Negative marginLeft creates overlap effect
- zIndex ordering ensures correct layering
- "+N" overflow badge for groups with many members

**Example:**
```typescript
// Source: Standard React Native overlapping pattern
function AvatarStack({ members, max = 3 }: { members: GroupMember[]; max?: number }) {
  const visible = members.slice(0, max);
  const overflow = members.length - max;

  return (
    <View style={avatarStackStyles.container}>
      {visible.map((member, index) => (
        <View
          key={member.id}
          style={[
            avatarStackStyles.avatarWrapper,
            { marginLeft: index === 0 ? 0 : -8, zIndex: max - index },
          ]}
        >
          <Avatar emoji={member.avatar_url || undefined} size="sm" />
        </View>
      ))}
      {overflow > 0 && (
        <View style={[avatarStackStyles.overflowBadge, { marginLeft: -8 }]}>
          <Text variant="caption" color="textSecondary">+{overflow}</Text>
        </View>
      )}
    </View>
  );
}
```

### Pattern 4: MotiPressable for Card Press Effects
**What:** Scale-down animation on press using moti's native-thread animation
**When to use:** Interactive cards that need tactile press feedback
**Why this pattern:**
- moti already installed and used in the project
- MotiPressable triggers zero re-renders — all animation on native thread
- Can combine scale + opacity for premium feel
- Import from `moti/interactions`

**Example:**
```typescript
// Source: moti.fyi/interactions/pressable
import { MotiPressable } from 'moti/interactions';

<MotiPressable
  onPress={() => router.push(`/group/${group.id}`)}
  animate={({ pressed }) => {
    'worklet';
    return {
      scale: pressed ? 0.97 : 1,
      opacity: pressed ? 0.9 : 1,
    };
  }}
  transition={{ type: 'timing', duration: 150 }}
>
  {/* Card content */}
</MotiPressable>
```

### Pattern 5: Warm Accent Palette Extension
**What:** Add amber and coral accent colors to the palette without disrupting existing color system
**When to use:** Brand touches — section decorations, empty state accents, subtle warmth
**Why this pattern:**
- Add to `palette` object in `theme/colors.ts` alongside existing primitives
- Create new semantic tokens that reference the warm palette
- 60-30-10 rule: primary colors (dark bg, green/red) stay dominant; warm accents are the 10%

**Example:**
```typescript
// Source: Design research — warm accent palette
// Added to theme/colors.ts palette
amber: '#F5A623',        // warm golden amber
amberSubtle: '#2A2010',  // dark amber for backgrounds
coral: '#FF6B6B',        // warm coral
coralSubtle: '#2A1515',  // dark coral for backgrounds
```

### Anti-Patterns to Avoid
- **Don't use expo-blur for card glassmorphism:** BlurView has Android performance issues, rendering order problems with SectionList, and requires a new install. The dark background makes CSS-only glassmorphism equally effective.
- **Don't fetch member data per-group in a loop:** N+1 query problem. Use a single batch query or RPC to get all member info for all groups at once.
- **Don't use real-time blur intensity animations:** GPU-heavy and unnecessary for static cards.
- **Don't replace functional green/red with warm accents:** Green = owed to you, red = you owe. These are established in the app. Warm accents are additive brand touches only.
- **Don't make glassmorphism too transparent:** On the dark background, too much transparency (>10% white) makes cards look washed out. Keep it subtle (3-6%).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gradient backgrounds | Manual canvas/SVG gradients | `expo-linear-gradient` LinearGradient | Already installed, well-tested, simple props API |
| Card press animations | Animated.Value + Pressable + event handlers | `MotiPressable` from moti | Zero re-renders, native thread, already in project |
| Avatar overlap layout | Complex absolute positioning | Negative marginLeft + zIndex | Simpler, works in flexbox, standard RN pattern |
| Relative time formatting | New time utility | `formatRelativeTime()` from `lib/activity.ts` | Already exists and handles all cases |
| Balance color logic | Custom color picker | `formatBalanceColor()` from `lib/balance-utils.ts` | Already handles green/red/neutral |
| Balance text | Custom conditional text | `formatBalanceSummary()` from `lib/balance-utils.ts` | Already handles all states |

**Key insight:** The visual polish work is styling and layout changes on top of an already-functional data layer. The only new data need is per-group member display info and last activity dates for the enriched group cards.

## Common Pitfalls

### Pitfall 1: Glassmorphism Invisibility on Dark Background
**What goes wrong:** Cards with subtle transparency disappear into the near-black background, defeating the purpose.
**Why it happens:** On background #0D0D0D, `rgba(255,255,255,0.03)` is imperceptible. But `rgba(255,255,255,0.15)` looks washed out.
**How to avoid:** Test at `rgba(255,255,255,0.05)` as baseline. Add a 1px border at `rgba(255,255,255,0.08)` — the border is what sells the glass effect on dark themes. The combination of subtle fill + visible border edge creates depth.
**Warning signs:** Cards look identical to the background, or cards look like light gray blocks.

### Pitfall 2: Gradient Overload on Balance Header
**What goes wrong:** Gradient is too intense or colorful, making the balance text hard to read or creating visual noise.
**Why it happens:** Accent green (#9FE870) at full opacity in a gradient is extremely bright on dark backgrounds.
**How to avoid:** Use the accent color at 10-20% opacity in the gradient: `rgba(159, 232, 112, 0.12)`. The gradient should be felt, not seen — a subtle ambient glow, not a banner. Test readability of the balance text on top.
**Warning signs:** Balance text becomes hard to read, gradient draws more attention than the balance number.

### Pitfall 3: N+1 Query Problem for Group Card Data
**What goes wrong:** Fetching member list, last activity, and balance separately per group creates many API calls as the user adds groups.
**Why it happens:** The current code already fetches member counts with a batch query, but member display info (names, avatars) and last activity are not batch-fetched.
**How to avoid:** Create a single RPC `get_group_card_data` that returns enriched data for all user's groups in one call: member names (first 3-4 per group), last activity timestamp per group, and member count. Alternatively, use two efficient batch queries.
**Warning signs:** Dashboard loads slowly with many groups, multiple loading spinners.

### Pitfall 4: Avatar Stack Overflow on Small Screens
**What goes wrong:** Too many avatars or large avatars push content off-screen or break the card layout.
**Why it happens:** Not capping the visible avatar count, or avatars being too large.
**How to avoid:** Cap visible avatars at 3-4, use `size="sm"` (32px) avatars with -8px overlap. Show "+N" for overflow. Total avatar stack width: ~3*32 - 2*8 = 80px — comfortably fits in a card.
**Warning signs:** Card layout breaks on narrow devices, avatars clip outside card bounds.

### Pitfall 5: MotiPressable Import Path
**What goes wrong:** Importing `MotiPressable` from the wrong path causes build errors or missing component.
**Why it happens:** moti has separate entry points for interactions vs core animations.
**How to avoid:** Import from `moti/interactions`, not from `moti`. The interactions module requires `react-native-gesture-handler` (already installed).
**Warning signs:** Module not found errors, component renders as undefined.

### Pitfall 6: Empty State Copy in Tagalog
**What goes wrong:** Existing empty states use Tagalog copy ("Wala pa kay group!"), but the user decided on English for this phase.
**Why it happens:** Earlier phases used Tagalog for personality. Phase 12 decision is "Minimal + English".
**How to avoid:** Update only the empty states touched by this phase to English. If existing Tagalog empty states elsewhere (group detail) are not in scope, leave them. The decision applies to dashboard empty states specifically.
**Warning signs:** Mix of languages feels inconsistent — but this is acceptable if only dashboard states are touched.

## Code Examples

### Glassmorphism Card Component
```typescript
// Source: Extension of existing components/ui/Card.tsx
import { View, ViewProps, StyleSheet } from 'react-native';
import { radius, spacing } from '@/theme';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
}

export function GlassCard({ style, children, ...props }: GlassCardProps) {
  return (
    <View style={[glassStyles.card, style]} {...props}>
      {children}
    </View>
  );
}

const glassStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.lg,
    padding: spacing[4],
  },
});
```

### Gradient Balance Header
```typescript
// Source: expo-linear-gradient docs + existing BalanceSummaryHeader
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/Text';
import { formatBalanceColor, formatBalanceSummary } from '@/lib/balance-utils';
import { formatPeso } from '@/lib/expense-utils';
import { spacing } from '@/theme';

function BalanceSummaryHeader({
  netBalance,
  hasGroups,
}: {
  netBalance: number;
  hasGroups: boolean;
}) {
  if (!hasGroups) return null;

  // Dynamic gradient: subtle accent glow based on balance direction
  const accentColor = netBalance >= 0
    ? 'rgba(159, 232, 112, 0.12)'  // green glow
    : 'rgba(232, 84, 84, 0.12)';   // red glow

  return (
    <LinearGradient
      colors={['#0D0D0D', accentColor, '#0D0D0D']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={headerStyles.gradient}
    >
      <Text variant="caption" color="textSecondary">
        Overall Balance
      </Text>
      <Text variant="moneyLarge" color={formatBalanceColor(netBalance)}>
        P{formatPeso(Math.abs(netBalance))}
      </Text>
      <Text variant="body" color="textSecondary">
        {formatBalanceSummary(netBalance, formatPeso)}
      </Text>
    </LinearGradient>
  );
}

const headerStyles = StyleSheet.create({
  gradient: {
    alignItems: 'center',
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[6],
  },
});
```

### Avatar Stack Component
```typescript
// Source: Standard React Native overlap pattern + existing Avatar component
import { View, StyleSheet } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

interface AvatarStackMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

function AvatarStack({
  members,
  max = 3,
}: {
  members: AvatarStackMember[];
  max?: number;
}) {
  const visible = members.slice(0, max);
  const overflow = members.length - max;

  return (
    <View style={stackStyles.container}>
      {visible.map((member, index) => (
        <View
          key={member.id}
          style={[
            stackStyles.wrapper,
            {
              marginLeft: index === 0 ? 0 : -8,
              zIndex: max - index,
            },
          ]}
        >
          <Avatar emoji={member.avatar_url || undefined} size="sm" />
        </View>
      ))}
      {overflow > 0 && (
        <View style={[stackStyles.overflow, { marginLeft: -8 }]}>
          <Text variant="caption" color="textSecondary">
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}

const stackStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wrapper: {
    borderWidth: 2,
    borderColor: '#0D0D0D',  // matches background for clean overlap
    borderRadius: radius.full,
  },
  overflow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0D0D0D',
  },
});
```

### Enriched Group Card with Press Effect
```typescript
// Source: moti.fyi/interactions/pressable + existing renderGroupCard
import { MotiPressable } from 'moti/interactions';

function GroupCard({ group, balance, members, lastActivity, onPress }: GroupCardProps) {
  return (
    <MotiPressable
      onPress={onPress}
      animate={({ pressed }) => {
        'worklet';
        return {
          scale: pressed ? 0.97 : 1,
          opacity: pressed ? 0.9 : 1,
        };
      }}
      transition={{ type: 'timing', duration: 150 }}
    >
      <GlassCard>
        <View style={cardStyles.topRow}>
          <Avatar emoji={getGroupEmoji(group.name)} size="md" />
          <View style={cardStyles.info}>
            <Text variant="bodyMedium" color="textPrimary">
              {group.name}
            </Text>
            <Text variant="caption" color="textTertiary">
              {lastActivity ? formatRelativeTime(lastActivity) : 'No activity'}
            </Text>
          </View>
          {balance != null && (
            <View style={cardStyles.balanceCol}>
              <Text variant="bodyMedium" color={formatBalanceColor(balance)}>
                P{formatPeso(Math.abs(balance))}
              </Text>
            </View>
          )}
        </View>
        {members.length > 0 && (
          <View style={cardStyles.avatarRow}>
            <AvatarStack members={members} max={4} />
          </View>
        )}
      </GlassCard>
    </MotiPressable>
  );
}
```

### Warm Empty State
```typescript
// Source: Existing EmptyState component pattern
<EmptyState
  emoji="👥"
  headline="No groups yet"
  subtext="Create a group to start splitting expenses with friends"
/>

// For no activity:
<EmptyState
  emoji="📋"
  headline="No recent activity"
  subtext="Add an expense to see activity here"
/>
```

### New RPC: get_group_card_data
```sql
-- Returns enriched data for group cards on the dashboard
-- Per-group: member display info (first 4), last activity timestamp, member count
create or replace function public.get_group_card_data()
returns table(
  group_id uuid,
  member_count integer,
  member_names text[],       -- first 4 member display_names
  member_avatars text[],     -- first 4 member avatar_urls (nullable)
  last_activity_at timestamptz
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
  ),
  group_member_info as (
    select
      gm.group_id,
      count(*) as member_count,
      array_agg(coalesce(u.display_name, 'Unknown') order by gm.joined_at) filter (where row_number <= 4) as member_names,
      array_agg(u.avatar_url order by gm.joined_at) filter (where row_number <= 4) as member_avatars
    from (
      select gm.*, row_number() over (partition by gm.group_id order by gm.joined_at) as row_number
      from group_members gm
      where gm.group_id in (select mg.group_id from my_groups mg)
    ) gm
    join users u on u.id = gm.user_id
    group by gm.group_id
  ),
  last_activities as (
    select
      sub.group_id,
      max(sub.created_at) as last_activity_at
    from (
      select e.group_id, e.created_at
      from expenses e
      where e.group_id in (select mg.group_id from my_groups mg)
      union all
      select s.group_id, s.created_at
      from settlements s
      where s.group_id in (select mg.group_id from my_groups mg)
    ) sub
    group by sub.group_id
  )
  select
    mg.group_id,
    coalesce(gmi.member_count::integer, 0),
    coalesce(gmi.member_names, '{}'),
    coalesce(gmi.member_avatars, '{}'),
    la.last_activity_at
  from my_groups mg
  left join group_member_info gmi on gmi.group_id = mg.group_id
  left join last_activities la on la.group_id = mg.group_id;
end;
$$;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat Card bg (#1A1A1A) | Glassmorphism (rgba transparency + border) | This phase | Premium, modern card appearance |
| Plain balance header | Gradient background (expo-linear-gradient) | This phase | Visual weight and brand identity |
| Member count text only | Avatar stack + count | This phase | Visual richness, social presence |
| Opacity-only press feedback | MotiPressable scale+opacity | This phase | Tactile, premium card interactions |
| Tagalog + emoji empty states | English, minimal, action-guiding | This phase | Professional, internationally accessible |
| Simple card with name+count | Rich card with balance, activity date, avatars | This phase | Information density, glanceable dashboard |

**Not changing:**
- Data fetching architecture (RPC + useFocusEffect + cache)
- SectionList as the scrolling container
- Balance color semantics (green = owed, red = owe, neutral = settled)
- Pull-to-refresh behavior
- Navigation patterns (Pressable/MotiPressable -> router.push)

## Open Questions

1. **Should the gradient direction change based on balance sign?**
   - What we know: The user wants "dark-to-accent fade". Positive balance means green accent, negative means red.
   - What's unclear: Whether the gradient should dynamically switch between green and red glow, or always use a single warm accent.
   - Recommendation: Dynamic gradient that glows green when positive and red when negative. This integrates with the existing color-coding system as the user requested. When zero/no groups, use a neutral warm amber glow.

2. **New RPC vs. client-side joins for group card data?**
   - What we know: Current code fetches member counts with a batch query on `group_members`. Adding member names and last activity requires either: (a) a new RPC, or (b) additional client-side queries.
   - What's unclear: Whether the team prefers a fat RPC or leaner queries.
   - Recommendation: New RPC `get_group_card_data` that returns member names (first 4), member count, and last activity per group in one call. This replaces the current batch member count query and avoids N+1 problems. The per-group balance is already fetched via `get_my_group_balances`.

3. **MotiPressable vs. Pressable with style callback for card press effects?**
   - What we know: The project uses Pressable with opacity style callback for buttons. Moti is installed and used for fade-in animations.
   - What's unclear: Whether the scale animation from MotiPressable might feel inconsistent with other pressables.
   - Recommendation: Use MotiPressable only for group cards (the premium feel targets). Keep existing Pressable pattern for buttons and other touchables. The group card is the main interactive element being polished.

## Sources

### Primary (HIGH confidence)
- **Existing codebase** (`app/(tabs)/index.tsx`) - Current dashboard structure, group card rendering, SectionList pattern
- **Existing codebase** (`components/ui/Card.tsx`) - Current Card component (simple View wrapper with bg/radius/padding)
- **Existing codebase** (`components/ui/Avatar.tsx`) - Avatar component with size map (sm=32, md=40, lg=56, xl=120)
- **Existing codebase** (`components/ui/EmptyState.tsx`) - Current empty state component
- **Existing codebase** (`theme/colors.ts`) - Palette and semantic color tokens
- **Existing codebase** (`lib/balance-utils.ts`) - formatBalanceColor, formatBalanceSummary
- **Existing codebase** (`lib/activity.ts`) - formatRelativeTime utility
- **Existing codebase** (`supabase/migrations/`) - Existing RPC patterns (00009, 00022)
- **expo-linear-gradient docs** (docs.expo.dev/versions/latest/sdk/linear-gradient/) - LinearGradient API: colors, start, end, locations props
- **moti docs** (moti.fyi/interactions/pressable) - MotiPressable API: animate callback with pressed state, zero re-renders
- **React Native colors** (reactnative.dev/docs/colors) - rgba() support confirmed for backgroundColor and borderColor

### Secondary (MEDIUM confidence)
- **expo-blur docs** (docs.expo.dev/versions/latest/sdk/blur-view/) - BlurView API, Android limitations, rendering order issues — informed decision to avoid
- **Glassmorphism on dark themes** - Multiple sources agree: rgba transparency + border is sufficient on dark backgrounds
- **Avatar stack pattern** - Negative marginLeft + zIndex is the standard React Native approach, confirmed by multiple community sources

### Tertiary (LOW confidence)
- **Specific amber/coral hex values** - Design research suggests amber #F5A623 and coral #FF6B6B as starting points, but final values need visual testing on the actual dark theme
- **MotiPressable performance in SectionList** - GitHub issue #322 reports performance concerns in FlashList; SectionList behavior needs validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed, no new dependencies needed
- Architecture: HIGH - Patterns are straightforward React Native styling + existing project patterns
- Data layer: HIGH - RPC pattern well-established in the project, SQL follows existing migration patterns
- Glassmorphism approach: MEDIUM - CSS-only approach is well-documented but specific rgba values need visual tuning
- MotiPressable in SectionList: MEDIUM - API is documented but performance in list context has one open issue
- Warm accent hex values: LOW - Starting point values identified but need visual testing against the actual theme

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable — no external dependencies changing, all libraries already pinned)
