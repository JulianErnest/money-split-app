# Phase 1: Foundation & Design System - Research

**Researched:** 2026-02-18
**Domain:** Expo + Supabase project scaffolding, dark-first design system
**Confidence:** HIGH

## Summary

Phase 1 establishes the complete project skeleton: an Expo SDK 54 app with TypeScript, Expo Router file-based navigation with bottom tabs, a Supabase backend with PostgreSQL schema and RLS policies, and a dark-first design system with soft green accent inspired by Wise's fintech aesthetic.

The standard approach is to use `create-expo-app` for scaffolding, Expo Router for file-based navigation (including custom tab bar for the elevated center FAB), `@supabase/supabase-js` with `expo-sqlite/localStorage` for the backend client, Supabase CLI for migrations, and a hand-crafted design token system using React Native StyleSheet (no NativeWind needed for this scope). Plus Jakarta Sans is the recommended font via `@expo-google-fonts/plus-jakarta-sans`.

**Primary recommendation:** Scaffold with Expo SDK 54, set up Supabase CLI with migration files for the full schema + RLS, build a semantic color token system with near-black base (#0D0D0D) and soft green accent (#9FE870 adapted), and create the custom tab bar with elevated center FAB using `expo-router/ui` headless components.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dark theme & color palette:**
- Near-black background (#0A0A0A-#121212 range) — depth without being harsh, like Discord/Spotify
- Soft green accent used sparingly — primary actions only (buttons, CTAs, active states), not pervasive
- Visual reference: Wise (TransferWise) dark mode — clean fintech aesthetic with green accent

**Typography & spacing:**
- Money amounts displayed bold & prominent — large, heavy weight, hero element treatment (like Wise)
- Spacious layout — generous padding, lots of whitespace, calm premium feel
- Peso symbol: ₱ (not PHP prefix) — compact, widely recognized in PH

**Component style:**
- Rounded shape language (12-16px radius) — soft, friendly, modern
- Emoji-based avatars for users and groups — auto-assigned emoji, fun Filipino-friendly vibe
- Underline/minimal input fields — just a bottom border, clean Wise-like style

**Navigation structure:**
- Bottom tab bar with 3 tabs: Groups, Add (center), Profile
- Center Add button is elevated FAB style — larger, raised green button, stands out as primary action
- Home screen (Groups tab) shows summary + groups list — top balance summary section, then groups below (dashboard feel)

### Claude's Discretion
- Card/surface elevation colors — Claude picks what works with the near-black base
- Exact green shade selection
- Font choice — pick what works best for a fintech-style app
- Button style — pick what fits the Wise-inspired direction

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo | ~54.0.x | App framework | Current stable SDK, React Native 0.81, New Architecture enabled by default |
| expo-router | ~4.x | File-based navigation | Built-in to Expo SDK 54, provides tabs/stacks/layouts with file conventions |
| @supabase/supabase-js | ^2.x | Backend client | Official Supabase JS client, works with RLS + auth |
| expo-sqlite | bundled | Auth session storage | Provides localStorage polyfill recommended by Supabase for Expo auth persistence |
| typescript | ~5.x | Type safety | Included in Expo SDK 54 default template |
| supabase (CLI) | latest | DB migrations & type gen | Official CLI for local dev, migrations, and `gen types` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @expo-google-fonts/plus-jakarta-sans | latest | Typography | Load Plus Jakarta Sans font weights (400, 500, 600, 700, 800) |
| expo-font | bundled | Font loading | Required by @expo-google-fonts, bundled with Expo |
| @expo/vector-icons | bundled | Tab bar icons | Material Icons / Ionicons for navigation, bundled with Expo |
| expo-haptics | bundled | Haptic feedback | Tactile response on key actions (prep for Phase 6) |
| expo-constants | bundled | Environment config | Access Supabase URL/key from app config |
| react-native-safe-area-context | bundled | Safe area handling | Bundled with Expo, required for proper layout |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| StyleSheet (chosen) | NativeWind/Tailwind | NativeWind adds build complexity; StyleSheet is simpler for a focused design system with known tokens |
| Plus Jakarta Sans | Inter, SF Pro | Inter is more common but Plus Jakarta Sans has slightly more personality; fits fintech vibe better |
| expo-sqlite localStorage | AsyncStorage | expo-sqlite/localStorage is the current Supabase-recommended approach for Expo auth storage |
| Hand-crafted tokens | Shopify Restyle | Restyle adds a dependency for something achievable with a simple token + StyleSheet approach |

**Installation:**
```bash
# Create project
npx create-expo-app@latest money-split-app --template default

# Core dependencies
npx expo install @supabase/supabase-js expo-sqlite

# Fonts
npx expo install @expo-google-fonts/plus-jakarta-sans expo-font

# Supabase CLI (global or project-level)
npm install -D supabase
npx supabase init
```

## Architecture Patterns

### Recommended Project Structure
```
app/
├── _layout.tsx              # Root layout (ThemeProvider, fonts, Supabase init)
├── (tabs)/
│   ├── _layout.tsx          # Custom tab bar with center FAB
│   ├── index.tsx            # Groups tab (home/dashboard)
│   ├── add.tsx              # Add expense (placeholder, routed from FAB)
│   └── profile.tsx          # Profile tab
├── (auth)/
│   ├── _layout.tsx          # Auth stack layout
│   └── login.tsx            # Login screen (placeholder for Phase 2)
lib/
├── supabase.ts              # Supabase client initialization
├── database.types.ts        # Generated types from supabase gen types
theme/
├── colors.ts                # Color tokens (primitive + semantic)
├── typography.ts            # Font families, sizes, weights
├── spacing.ts               # Spacing scale
├── tokens.ts                # Combined token export
├── index.ts                 # Theme barrel export
components/
├── ui/
│   ├── Button.tsx           # Primary, secondary, ghost button variants
│   ├── Card.tsx             # Surface/card component with elevation
│   ├── Input.tsx            # Underline-style text input
│   ├── Text.tsx             # Themed text component with variant props
│   ├── Avatar.tsx           # Emoji avatar component
│   └── TabBar.tsx           # Custom bottom tab bar with center FAB
supabase/
├── config.toml              # Supabase local config
├── migrations/
│   └── 00001_initial_schema.sql  # Full schema + RLS
├── seed.sql                 # Optional seed data for development
```

### Pattern 1: Semantic Color Tokens
**What:** Two-tier color system — primitive values and semantic aliases
**When to use:** Always. All components reference semantic tokens, never raw hex values.
**Example:**
```typescript
// theme/colors.ts

// Primitive tokens — raw values, never used directly in components
const palette = {
  black: '#000000',
  nearBlack: '#0D0D0D',
  dark1: '#141414',
  dark2: '#1A1A1A',
  dark3: '#222222',
  dark4: '#2A2A2A',
  dark5: '#333333',
  gray1: '#666666',
  gray2: '#888888',
  gray3: '#AAAAAA',
  gray4: '#CCCCCC',
  white: '#FFFFFF',
  green: '#9FE870',       // Wise Bright Green — primary accent
  greenDark: '#7BC44E',   // Pressed/active state
  greenSubtle: '#1A2E10', // Green-tinted surface for subtle highlights
  red: '#E85454',         // Error/negative
  yellow: '#FFEB69',      // Warning
} as const;

// Semantic tokens — what components consume
export const colors = {
  // Backgrounds
  background: palette.nearBlack,
  backgroundElevated: palette.dark1,
  backgroundCard: palette.dark2,
  backgroundInput: 'transparent',

  // Surfaces
  surface: palette.dark2,
  surfaceElevated: palette.dark3,
  surfacePressed: palette.dark4,

  // Text
  textPrimary: palette.white,
  textSecondary: palette.gray3,
  textTertiary: palette.gray1,
  textInverse: palette.nearBlack,

  // Accent
  accent: palette.green,
  accentPressed: palette.greenDark,
  accentSubtle: palette.greenSubtle,

  // Interactive
  buttonPrimary: palette.green,
  buttonPrimaryText: palette.nearBlack,
  buttonSecondary: palette.dark3,
  buttonSecondaryText: palette.white,
  buttonGhost: 'transparent',
  buttonGhostText: palette.gray3,

  // Input
  inputBorder: palette.dark5,
  inputBorderFocused: palette.green,
  inputText: palette.white,
  inputPlaceholder: palette.gray1,

  // Borders
  border: palette.dark4,
  borderSubtle: palette.dark3,

  // Status
  error: palette.red,
  warning: palette.yellow,
  success: palette.green,

  // Tab bar
  tabBar: palette.dark1,
  tabBarBorder: palette.dark3,
  tabActive: palette.green,
  tabInactive: palette.gray1,
} as const;
```

### Pattern 2: Supabase Client with expo-sqlite localStorage
**What:** Initialize Supabase with the recommended expo-sqlite localStorage polyfill
**When to use:** Single client instance, imported everywhere.
**Example:**
```typescript
// lib/supabase.ts
import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auto-refresh tokens when app becomes active
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
```

### Pattern 3: Custom Tab Bar with Center FAB
**What:** Headless tab components from expo-router/ui with a custom-styled bar
**When to use:** For the 3-tab layout with elevated center Add button
**Example:**
```typescript
// components/ui/TabBar.tsx
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { View, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

// In app/(tabs)/_layout.tsx:
export default function TabLayout() {
  return (
    <Tabs>
      <TabSlot />
      <View style={styles.tabBar}>
        <TabTrigger name="index" href="/">
          {/* Groups icon + label */}
        </TabTrigger>

        {/* Center FAB - elevated green button */}
        <TabTrigger name="add" href="/add" asChild>
          <Pressable style={styles.fab}>
            {/* Plus icon */}
          </Pressable>
        </TabTrigger>

        <TabTrigger name="profile" href="/profile">
          {/* Profile icon + label */}
        </TabTrigger>
      </View>

      {/* Hidden TabList defines routes */}
      <TabList style={{ display: 'none' }}>
        <TabTrigger name="index" href="/" />
        <TabTrigger name="add" href="/add" />
        <TabTrigger name="profile" href="/profile" />
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: colors.tabBarBorder,
    paddingBottom: 20, // safe area
    paddingTop: 8,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -28, // Elevate above tab bar
    // Shadow
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
```

### Pattern 4: Database Schema with RLS
**What:** Full PostgreSQL schema with row-level security policies
**When to use:** Initial migration file for Supabase
**Example:**
```sql
-- supabase/migrations/00001_initial_schema.sql

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Users table (synced from auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone_number text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

alter table public.users enable row level security;

create policy "Users can view their own profile"
  on public.users for select
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.users for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can insert their own profile"
  on public.users for insert
  with check ((select auth.uid()) = id);

-- Groups table
create table public.groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  invite_code text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_by uuid references public.users(id) not null,
  created_at timestamptz default now() not null
);

alter table public.groups enable row level security;

-- Group members junction table
create table public.group_members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  joined_at timestamptz default now() not null,
  unique(group_id, user_id)
);

alter table public.group_members enable row level security;

-- Users can only see groups they are members of
create policy "Members can view their groups"
  on public.groups for select
  using (
    id in (
      select group_id from public.group_members
      where user_id = (select auth.uid())
    )
  );

create policy "Authenticated users can create groups"
  on public.groups for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

-- Group members policies
create policy "Members can view group members"
  on public.group_members for select
  using (
    group_id in (
      select group_id from public.group_members
      where user_id = (select auth.uid())
    )
  );

create policy "Authenticated users can join groups"
  on public.group_members for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Expenses table
create table public.expenses (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade not null,
  description text not null,
  amount numeric(10,2) not null check (amount > 0 and amount <= 999999),
  paid_by uuid references public.users(id) not null,
  split_type text not null check (split_type in ('equal', 'custom')),
  created_by uuid references public.users(id) not null,
  created_at timestamptz default now() not null
);

alter table public.expenses enable row level security;

create policy "Members can view group expenses"
  on public.expenses for select
  using (
    group_id in (
      select group_id from public.group_members
      where user_id = (select auth.uid())
    )
  );

create policy "Members can add expenses to their groups"
  on public.expenses for insert
  to authenticated
  with check (
    group_id in (
      select group_id from public.group_members
      where user_id = (select auth.uid())
    )
    and (select auth.uid()) = created_by
  );

-- Expense splits table
create table public.expense_splits (
  id uuid primary key default uuid_generate_v4(),
  expense_id uuid references public.expenses(id) on delete cascade not null,
  user_id uuid references public.users(id) not null,
  amount numeric(10,2) not null check (amount >= 0),
  unique(expense_id, user_id)
);

alter table public.expense_splits enable row level security;

create policy "Members can view expense splits"
  on public.expense_splits for select
  using (
    expense_id in (
      select e.id from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where gm.user_id = (select auth.uid())
    )
  );

create policy "Members can add expense splits"
  on public.expense_splits for insert
  to authenticated
  with check (
    expense_id in (
      select e.id from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where gm.user_id = (select auth.uid())
    )
  );

-- Indexes for RLS policy performance
create index idx_group_members_user_id on public.group_members(user_id);
create index idx_group_members_group_id on public.group_members(group_id);
create index idx_expenses_group_id on public.expenses(group_id);
create index idx_expense_splits_expense_id on public.expense_splits(expense_id);

-- Also allow users to see other members' profiles within their groups (for display names)
create policy "Users can view profiles of group co-members"
  on public.users for select
  using (
    id in (
      select gm2.user_id from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = (select auth.uid())
    )
  );
```

### Anti-Patterns to Avoid
- **Raw hex colors in components:** Always use semantic tokens. If you see `#9FE870` in a component file, it should be `colors.accent` instead.
- **Inline styles for theme values:** Extract all color/spacing/typography references to the token system.
- **Multiple Supabase client instances:** Create one client in `lib/supabase.ts` and import it everywhere.
- **Schema changes via Supabase Dashboard:** Always use migration files. Dashboard changes create drift between local and production.
- **RLS policies without indexes:** Every column referenced in a policy WHERE clause needs an index. Missing indexes cause full table scans.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font loading | Manual asset bundling | @expo-google-fonts/plus-jakarta-sans + useFonts hook | Handles async loading, caching, and error states |
| Navigation | Custom navigator | Expo Router file-based routing | Handles deep linking, back navigation, URL state automatically |
| Auth session storage | Custom AsyncStorage wrapper | expo-sqlite/localStorage polyfill | Recommended by Supabase, handles token refresh lifecycle |
| DB type safety | Manual interface definitions | `supabase gen types typescript` | Generates types directly from schema, stays in sync |
| Safe area insets | Manual padding guesses | react-native-safe-area-context (bundled) | Handles notches, dynamic islands, and tab bar offsets |
| Tab bar safe area | Bottom padding hacks | useSafeAreaInsets() from safe-area-context | Returns exact bottom inset value for the device |

**Key insight:** Expo SDK 54 bundles most infrastructure libraries. The default template includes Expo Router, safe area context, vector icons, and font loading. Don't install what's already there.

## Common Pitfalls

### Pitfall 1: RLS Policies Block All Access By Default
**What goes wrong:** You enable RLS on a table but forget to create policies. All queries return empty results with no error.
**Why it happens:** RLS defaults to deny-all when enabled with no policies. The Supabase client doesn't throw an error; it just returns empty data.
**How to avoid:** Always pair `enable row level security` with at least a SELECT policy. Test every table immediately after creating policies.
**Warning signs:** Queries return empty arrays when you know data exists. No error messages.

### Pitfall 2: Missing Indexes on RLS Policy Columns
**What goes wrong:** RLS policies work but become extremely slow as data grows because they trigger full table scans.
**Why it happens:** RLS policies run as implicit WHERE clauses on every query. Without indexes on the columns in those WHERE clauses (like `user_id`, `group_id`), PostgreSQL scans every row.
**How to avoid:** Create indexes on every column referenced in RLS policies. The `group_members(user_id)` and `group_members(group_id)` indexes are critical since most policies join through this table.
**Warning signs:** Queries that were fast become slow after adding more data.

### Pitfall 3: Supabase Client Created Before Environment Variables Load
**What goes wrong:** The Supabase client initializes with undefined URL/key, causing silent auth failures.
**Why it happens:** Module-level initialization runs before Expo Constants or environment variables are available.
**How to avoid:** Use `process.env.EXPO_PUBLIC_*` variables which are inlined at build time by Metro. Store Supabase URL and anon key as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`.
**Warning signs:** Auth calls fail silently or throw "Invalid URL" errors.

### Pitfall 4: Pure Black Background Causes "OLED Smearing"
**What goes wrong:** On OLED screens, pure black (#000000) backgrounds cause visible smearing/ghosting when scrolling because OLED pixels physically turn off for black.
**Why it happens:** OLED displays have per-pixel lighting. Pure black = pixels off. Transitioning from off to on has slight latency, causing smear artifacts.
**How to avoid:** Use near-black (#0D0D0D to #121212) instead of pure #000000. This keeps pixels slightly lit, preventing the smear effect. The user's decision to use #0A0A0A-#121212 range already avoids this.
**Warning signs:** Visible ghosting artifacts when scrolling on OLED phones (common in flagship Android devices).

### Pitfall 5: expo-router/ui TabTrigger Requires Hidden TabList
**What goes wrong:** Custom tab bar renders but tabs don't navigate or routes are undefined.
**Why it happens:** When using expo-router/ui headless components, you still need a `TabList` to define the route mapping. If you only use `TabTrigger` outside a `TabList`, routes may not register.
**How to avoid:** Always include a hidden `<TabList style={{ display: 'none' }}>` with all route definitions, even when building a custom tab bar. The visible custom bar uses `TabTrigger` components that reference the same route names.
**Warning signs:** Tab presses don't navigate, or you get "route not found" errors.

### Pitfall 6: Font Loading Blocks Render
**What goes wrong:** App shows a blank/white screen while fonts load, breaking the dark theme experience.
**Why it happens:** `useFonts` returns `loaded: false` until fonts are ready. If you render your app before fonts load, you get unstyled text or a flash.
**How to avoid:** Use Expo's `SplashScreen.preventAutoHideAsync()` and hide the splash screen only after fonts are loaded. This gives a seamless transition from splash to themed app.
**Warning signs:** Brief white flash on app launch before dark theme appears.

## Code Examples

### Typography Token System
```typescript
// theme/typography.ts
import { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  hero: 48,   // For prominent money amounts
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

// Semantic text styles
export const textStyles: Record<string, TextStyle> = {
  // Money amounts — hero treatment
  moneyLarge: {
    fontFamily: fontFamily.extraBold,
    fontSize: fontSize.hero,
    lineHeight: fontSize.hero * lineHeight.tight,
  },
  moneyMedium: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
    lineHeight: fontSize['3xl'] * lineHeight.tight,
  },
  moneySmall: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.tight,
  },
  // Headings
  h1: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
    lineHeight: fontSize['3xl'] * lineHeight.tight,
  },
  h2: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * lineHeight.tight,
  },
  h3: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.normal,
  },
  // Body
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.relaxed,
  },
  bodyMedium: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.relaxed,
  },
  // Small
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
} as const;
```

### Spacing Scale
```typescript
// theme/spacing.ts
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
```

### Root Layout with Font Loading and Theme
```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { colors } from '@/theme/colors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}
```

### Themed Text Component
```typescript
// components/ui/Text.tsx
import { Text as RNText, TextProps, TextStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { textStyles } from '@/theme/typography';

interface ThemedTextProps extends TextProps {
  variant?: keyof typeof textStyles;
  color?: keyof typeof colors;
}

export function Text({
  variant = 'body',
  color = 'textPrimary',
  style,
  ...props
}: ThemedTextProps) {
  return (
    <RNText
      style={[
        textStyles[variant],
        { color: colors[color] },
        style,
      ]}
      {...props}
    />
  );
}
```

### Underline Input Component
```typescript
// components/ui/Input.tsx
import { useState } from 'react';
import { TextInput, View, StyleSheet, TextInputProps } from 'react-native';
import { colors } from '@/theme/colors';
import { fontFamily, fontSize } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Text } from './Text';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && (
        <Text variant="label" color="textTertiary">
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          {
            borderBottomColor: error
              ? colors.error
              : focused
              ? colors.inputBorderFocused
              : colors.inputBorder,
          },
          style,
        ]}
        placeholderTextColor={colors.inputPlaceholder}
        selectionColor={colors.accent}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {error && (
        <Text variant="caption" color="error" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[1],
  },
  input: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    color: colors.inputText,
    borderBottomWidth: 1,
    paddingVertical: spacing[3],
    paddingHorizontal: 0,
  },
  error: {
    marginTop: spacing[1],
  },
});
```

### Environment Variable Setup
```bash
# .env (not committed to git)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AsyncStorage for Supabase auth | expo-sqlite/localStorage polyfill | 2025 (SDK 53+) | More reliable session persistence, recommended by Supabase docs |
| Expo Router `<Tabs>` for custom tab bars | expo-router/ui headless components | 2025 (Expo Router v4) | Full control over tab bar UI without fighting React Navigation styles |
| New Architecture opt-in | New Architecture default (SDK 53+) | SDK 53 (April 2025) | Cannot disable in SDK 55+, SDK 54 is last version to opt out |
| SecureStore for auth tokens | expo-sqlite localStorage | 2025 | SecureStore had 2KB size limits that caused issues with large JWTs |
| `@react-native-async-storage/async-storage` | `expo-sqlite/localStorage/install` | 2025 | Unified storage approach, one less dependency |

**Deprecated/outdated:**
- `expo-app-loading`: Replaced by `expo-splash-screen` API (SplashScreen.preventAutoHideAsync/hideAsync)
- `react-native-url-polyfill`: No longer needed with recent Expo SDK versions
- Supabase `anon` key naming: Being replaced by `publishable` key (sb_publishable_xxx) but old keys still work

## Discretion Recommendations

### Exact Green Shade: #9FE870
**Recommendation:** Use Wise's Bright Green #9FE870 directly. It is well-tested for accessibility on dark backgrounds, has the right softness (not neon), and directly matches the user's stated visual reference. Derive a pressed state by darkening ~15% to #7BC44E, and a subtle highlight by creating a very low-opacity green-tinted dark: #1A2E10.
**Confidence:** HIGH — sourced from Wise's official design system documentation.

### Card/Surface Elevation Colors
**Recommendation:** Use a graduated near-black scale for surface elevation:
- Background (L0): #0D0D0D — main app background
- Elevated surface (L1): #141414 — cards, tab bar
- Higher surface (L2): #1A1A1A — modals, popovers, active cards
- Highest surface (L3): #222222 — pressed states, focused elements

This follows Material Design's dark theme elevation principle where lighter = higher, but stays subtle enough to feel premium rather than gray.
**Confidence:** HIGH — standard dark theme pattern used by Discord, Spotify, and Wise.

### Font Choice: Plus Jakarta Sans
**Recommendation:** Plus Jakarta Sans. It has geometric proportions similar to Inter but with slightly more personality (rounded terminals, wider x-height). Available via `@expo-google-fonts/plus-jakarta-sans` with all needed weights (400-800). It reads well at small sizes for captions and has enough heft at ExtraBold (800) to make money amounts feel substantial — matching the Wise hero-amount treatment.
**Confidence:** HIGH — available in expo-google-fonts, widely used in fintech designs.

### Button Style
**Recommendation:** Three button variants:
1. **Primary** — Solid green (#9FE870) background with near-black text, rounded (radius.lg = 16px), full-width or content-width depending on context. Used for main CTAs.
2. **Secondary** — Dark surface background (#222222) with white text, same rounded shape. Used for secondary actions.
3. **Ghost** — Transparent background with gray text, no border. Used for tertiary/cancel actions.

All buttons: 48-52px height, medium font weight label, subtle press animation (opacity 0.8 or slight scale). No outlined/bordered variant — keeps the visual language minimal.
**Confidence:** HIGH — aligns with Wise's minimal button approach.

## Open Questions

1. **expo-router/ui TabTrigger `asChild` behavior with Pressable**
   - What we know: The `asChild` prop passes navigation to a child component. The docs show basic examples.
   - What's unclear: Whether `asChild` properly forwards the `isFocused` state to custom FAB components for active styling.
   - Recommendation: Test during implementation. Fallback is to use `usePathname()` from expo-router to determine active tab manually.

2. **Supabase RLS policy for viewing any group by invite_code (for join flow)**
   - What we know: Current policies restrict group visibility to members only. But joining requires reading the group by invite code before the user is a member.
   - What's unclear: Whether to add a special SELECT policy for invite_code lookup or handle this via a Supabase Edge Function.
   - Recommendation: Add a narrow RLS policy: `for select using (invite_code = current_setting('request.headers')::json->>'x-invite-code')` or use a database function with `security definer`. Defer exact implementation to Phase 3 (Groups) — for now, just note that the groups table will need an additional policy for the join flow.

3. **TypeScript path aliases (@/) in Expo SDK 54**
   - What we know: Expo Router supports `@/` path aliases via tsconfig paths configuration.
   - What's unclear: Whether this requires additional Metro configuration in SDK 54 or works out of the box.
   - Recommendation: Configure `"paths": { "@/*": ["./*"] }` in tsconfig.json. If Metro doesn't resolve it, add `babel-plugin-module-resolver` as fallback.

## Sources

### Primary (HIGH confidence)
- Expo SDK 54 docs — SDK version, create-expo-app, Expo Router tabs, custom tab layouts, fonts
- Supabase official docs — RLS policies, Expo React Native quickstart, client initialization, CLI migrations
- Wise Design System (wise.design/foundations/colour) — Official color tokens: Bright Green #9FE870, Forest Green #163300, Base Dark #121511
- @expo-google-fonts/plus-jakarta-sans npm — Font availability and weight variants confirmed

### Secondary (MEDIUM confidence)
- Expo SDK changelog — SDK 54 is current stable, SDK 55 beta available, New Architecture default since SDK 53
- Supabase RLS best practices (multiple sources) — Index strategy, auth.uid() wrapping in select, membership-based policies
- PostgreSQL NUMERIC(10,2) for money — Crunchy Data blog + PostgreSQL official docs confirm numeric is the right type for exact decimal arithmetic

### Tertiary (LOW confidence)
- expo-router/ui headless tab components — Documentation exists but the pattern for custom FAB-style center button is community-derived, not officially documented as a recipe
- expo-sqlite/localStorage as default storage — This is in the official Supabase+Expo tutorial but is relatively new; some older guides still show AsyncStorage

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Expo SDK 54, Supabase JS client, Expo Router all verified via official docs and npm
- Architecture: HIGH — File structure follows Expo Router conventions, design token pattern is industry standard
- Database schema & RLS: HIGH — SQL patterns verified against Supabase RLS documentation, data model matches PROJECT.md specification
- Design system tokens: HIGH — Color values sourced from Wise official design system, typography from Google Fonts
- Custom tab bar with FAB: MEDIUM — Pattern is documented but center FAB elevation is community-derived
- Pitfalls: HIGH — All pitfalls verified via official docs or multiple credible sources

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable domain, 30-day validity)
