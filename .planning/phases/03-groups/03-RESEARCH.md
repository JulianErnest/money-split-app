# Phase 3: Groups - Research

**Researched:** 2026-02-18
**Domain:** Group CRUD, invite links, deep linking, Supabase RLS/RPC, Expo Router
**Confidence:** HIGH

## Summary

Phase 3 builds the groups feature: creating groups, generating shareable invite links, handling deep link joins, listing groups with auto-generated avatars, and viewing group members. The database schema already exists (groups, group_members tables with RLS policies and the `get_user_group_ids()` security definer function from Phase 2). The invite_code column already auto-generates 8-character codes. The app scheme is already configured as `hatian` in app.json.

The primary technical challenges are: (1) creating a group atomically (insert group + insert creator as member in a single transaction), (2) building the deep link flow with Expo Router for invite codes, and (3) using React Native's built-in Share API for the share sheet. The existing Avatar component already supports emoji-based avatars and can be reused for group avatars with a deterministic emoji selection based on group name or ID.

**Primary recommendation:** Use a Supabase RPC function for atomic group creation (insert group + add creator as member), React Native's built-in `Share.share()` for the share sheet, and Expo Router's file-based routing with a `+native-intent.tsx` rewrite for deep link handling.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.96.0 | Database queries, RPC calls | Already in use, typed client |
| expo-router | ~6.0.23 | File-based routing, deep link handling | Already in use, auto deep linking |
| expo-linking | ~8.0.11 | URL creation for invite links | Already installed, `Linking.createURL()` |
| react-native (Share) | 0.81.5 | System share sheet | Built-in, no extra dependency needed |

### Supporting (No New Dependencies Needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-native-safe-area-context | ~5.6.0 | SafeAreaView for screens | Already installed, use on all new screens |
| expo-haptics | ~15.0.8 | Haptic feedback on group creation | Already installed |

### No New Dependencies Required

This phase requires zero new npm packages. Everything needed is already installed:
- `expo-linking` for `Linking.createURL()` to build invite URLs
- React Native's built-in `Share` API for the system share sheet
- `expo-router` for deep link routing
- `@supabase/supabase-js` for all database operations

## Architecture Patterns

### Recommended Route Structure
```
app/
  (tabs)/
    index.tsx             # Groups list (HOME screen - replace current showcase)
    _layout.tsx           # Add group detail as a screen
  group/
    [id].tsx              # Group detail screen (members list)
  join/
    [code].tsx            # Join flow screen (handles invite deep links)
  +native-intent.tsx      # Rewrites incoming deep link URLs
```

**Key decision:** The group detail screen should live outside `(tabs)` as a Stack screen so it pushes on top of the tab navigator. The join screen is similarly a standalone Stack screen. Both should be added to the root `_layout.tsx` Stack.

### Pattern 1: Atomic Group Creation via Supabase RPC
**What:** A PostgreSQL function that creates a group AND adds the creator as the first member in a single transaction.
**When to use:** Every time a user creates a group.
**Why:** Without this, a client-side two-step insert (group, then group_member) can fail halfway, leaving an orphan group with no members. The RLS policy on groups requires membership to view, so the creator would lose access to their own group.

```sql
-- Migration: 00003_create_group_function.sql
create or replace function public.create_group(
  group_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group_id uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Insert group
  insert into groups (name, created_by)
  values (group_name, current_user_id)
  returning id into new_group_id;

  -- Add creator as first member
  insert into group_members (group_id, user_id)
  values (new_group_id, current_user_id);

  return new_group_id;
end;
$$;
```

```typescript
// Client-side usage
const { data: groupId, error } = await supabase.rpc('create_group', {
  group_name: name.trim(),
});
```

### Pattern 2: Deep Link Handling with +native-intent.tsx
**What:** Rewrite incoming `hatian://join/ABCD1234` deep links to the correct route.
**When to use:** When the app receives a deep link from an invite.

```typescript
// app/+native-intent.tsx
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    const url = new URL(path, 'hatian://');
    // hatian://join/ABCD1234 -> /join/ABCD1234
    if (url.pathname.startsWith('/join/')) {
      return url.pathname;
    }
    return path;
  } catch {
    return path;
  }
}
```

### Pattern 3: Invite Link Generation and Sharing
**What:** Build a deep link URL with the group's invite_code and open the system share sheet.
**When to use:** When user taps "Invite" in a group.

```typescript
import * as Linking from 'expo-linking';
import { Share } from 'react-native';

async function shareInviteLink(inviteCode: string, groupName: string) {
  const url = Linking.createURL(`join/${inviteCode}`);
  // url = "hatian://join/ABCD1234"

  await Share.share({
    message: `Join my group "${groupName}" on HatianApp! ${url}`,
  });
}
```

### Pattern 4: Join Group via Invite Code
**What:** Look up invite_code, check if already a member, insert into group_members.
**When to use:** When a user opens an invite deep link.

```sql
-- Migration: 00003 continued
create or replace function public.join_group_by_invite(
  invite text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_group_id uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id into found_group_id
  from groups
  where invite_code = invite;

  if found_group_id is null then
    raise exception 'Invalid invite code';
  end if;

  -- Insert if not already a member (upsert)
  insert into group_members (group_id, user_id)
  values (found_group_id, current_user_id)
  on conflict (group_id, user_id) do nothing;

  return found_group_id;
end;
$$;
```

### Pattern 5: Deterministic Group Avatar
**What:** Generate a consistent emoji avatar for each group based on its name or ID.
**When to use:** GRPS-06 requires auto-generated avatars for groups.

```typescript
import { EMOJI_LIST } from '@/components/ui/Avatar';

function getGroupEmoji(groupName: string): string {
  // Simple hash of the group name to pick a consistent emoji
  let hash = 0;
  for (let i = 0; i < groupName.length; i++) {
    hash = ((hash << 5) - hash + groupName.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % EMOJI_LIST.length;
  return EMOJI_LIST[index];
}
```

### Anti-Patterns to Avoid
- **Two-step group creation on the client:** Never insert into `groups` then `group_members` separately. Use the RPC function for atomicity.
- **Storing invite URLs in the database:** Only store the `invite_code`. Build the full URL at share time using `Linking.createURL()`.
- **Bypassing auth checks in RPC functions:** Always validate `auth.uid()` is not null in security definer functions.
- **Using `useGlobalSearchParams` for deep link params:** Use `useLocalSearchParams` instead to avoid unnecessary re-renders.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Share sheet | Custom share UI | `Share.share()` from React Native | Native share sheet handles all apps, accessibility, platform differences |
| Deep link routing | Manual URL parsing + navigation | Expo Router file-based routes + `+native-intent.tsx` | Expo Router handles deep links automatically via file structure |
| Invite code generation | Client-side random string | PostgreSQL `substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)` | Already in schema, server-generated, unique constraint |
| Transactional group creation | Client-side multi-step inserts | Supabase RPC (PostgreSQL function) | Atomicity, security definer pattern already established in project |
| Group avatar | Image upload / generation service | Deterministic emoji from `EMOJI_LIST` based on group name hash | Existing Avatar component, zero network calls, consistent display |

**Key insight:** The schema from Phase 1 already has invite_code generation built in. The Avatar component from Phase 1 already handles emoji display. No new UI primitives are needed.

## Common Pitfalls

### Pitfall 1: RLS Blocks Creator From Seeing Their Own Group
**What goes wrong:** After creating a group, the creator can't query it because they're not in `group_members` yet (if the two inserts aren't atomic).
**Why it happens:** The groups SELECT policy requires the user to be in group_members. If the group_members insert fails, the group is invisible.
**How to avoid:** Use a `security definer` RPC function that inserts into both tables in one transaction.
**Warning signs:** "Group created successfully" but empty groups list.

### Pitfall 2: Deep Link Not Handled When App Is Not Running
**What goes wrong:** User taps invite link but app opens to home screen instead of join flow.
**Why it happens:** The `+native-intent.tsx` rewrite or the routing guard in `_layout.tsx` may intercept the navigation.
**How to avoid:** Ensure the `+native-intent.tsx` correctly returns the `/join/[code]` path. Handle the case where the user is not authenticated -- store the pending invite code and process it after auth completes.
**Warning signs:** Deep link works when app is open but not from cold start.

### Pitfall 3: Join Screen Accessible Without Authentication
**What goes wrong:** Unauthenticated user opens invite link, lands on join screen, but can't join because they have no session.
**Why it happens:** The routing guard in `_layout.tsx` redirects unauthenticated users to auth, losing the deep link context.
**How to avoid:** Store the invite code (e.g., in a ref or async storage) before the auth redirect. After auth completes and routing guard allows access, check for a pending invite code and navigate to the join flow.
**Warning signs:** User completes auth but doesn't auto-join the group they were invited to.

### Pitfall 4: Duplicate Group Member Inserts
**What goes wrong:** User taps invite link multiple times, creating duplicate entries.
**Why it happens:** No deduplication on the join flow.
**How to avoid:** The `unique(group_id, user_id)` constraint on `group_members` prevents duplicates. The RPC uses `ON CONFLICT DO NOTHING`. Also check membership client-side before showing the join confirmation.
**Warning signs:** Supabase returns a 409/unique constraint error.

### Pitfall 5: Invite Code Collision in URL
**What goes wrong:** The scheme URL `hatian://join/ABC123` is not handled on Android.
**Why it happens:** Android requires the scheme to be registered in the manifest, which Expo handles via the `scheme` in app.json. But in development (Expo Go), the scheme differs (`exp://`).
**How to avoid:** Use `Linking.createURL()` which adapts to the current environment (uses `exp://` in dev, `hatian://` in production). Always test deep links on a dev build, not just Expo Go.
**Warning signs:** Deep links work in dev build but not Expo Go, or vice versa.

## Code Examples

### Fetching User's Groups List
```typescript
// Source: Established project pattern from profile.tsx
const { data: groups, error } = await supabase
  .from('group_members')
  .select(`
    group_id,
    groups (
      id,
      name,
      invite_code,
      created_by,
      created_at
    )
  `)
  .eq('user_id', user.id)
  .order('joined_at', { ascending: false });
```

### Fetching Group Members
```typescript
const { data: members, error } = await supabase
  .from('group_members')
  .select(`
    user_id,
    joined_at,
    users (
      id,
      display_name,
      avatar_url
    )
  `)
  .eq('group_id', groupId);
```

### Group List Item Component Pattern
```typescript
// Following the Card component pattern already in the project
<Card onPress={() => router.push(`/group/${group.id}`)}>
  <View style={styles.row}>
    <Avatar emoji={getGroupEmoji(group.name)} size="md" />
    <View style={styles.info}>
      <Text variant="bodyMedium">{group.name}</Text>
      <Text variant="caption" color="textSecondary">
        {memberCount} members
      </Text>
    </View>
  </View>
</Card>
```

### Updating database.types.ts for RPC Functions
```typescript
// Add to Database interface > public > Functions
Functions: {
  create_group: {
    Args: { group_name: string };
    Returns: string;
  };
  join_group_by_invite: {
    Args: { invite: string };
    Returns: string;
  };
  get_user_group_ids: {
    Args: Record<string, never>;
    Returns: string[];
  };
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual Linking config in RN | Expo Router auto deep linking via file structure | Expo Router v2+ | No manual linking config needed |
| expo-sharing (file-based) | React Native built-in `Share.share()` (text/URL) | Always available | No extra dependency for text sharing |
| Client-side multi-step DB writes | Supabase RPC with security definer | Standard pattern | Atomicity, security, fewer round trips |
| UUID-based invite tokens | Short 8-char invite codes | Already in schema | Easier to share verbally, shorter URLs |

**Notes:**
- `expo-sharing` is specifically for sharing files (images, PDFs). For sharing text/URLs, use React Native's built-in `Share` API.
- The `+native-intent.tsx` pattern is the current recommended way to customize incoming deep links in Expo Router.

## Open Questions

1. **Pending invite after auth flow**
   - What we know: If an unauthenticated user taps an invite link, they need to auth first. After auth, they should auto-join.
   - What's unclear: Best storage mechanism for the pending invite code during auth flow (in-memory ref vs expo-sqlite).
   - Recommendation: Use a simple module-level variable or React ref in the root layout. It only needs to persist for the duration of the auth flow (seconds to minutes). No persistent storage needed.

2. **Member count on groups list**
   - What we know: Displaying member count requires either a join query or a denormalized count column.
   - What's unclear: Whether to add a `member_count` column to groups or compute it client-side.
   - Recommendation: Use a Supabase query with count aggregation (`group_members.count()`) rather than denormalization. Simpler, always accurate, acceptable performance for Stage 1.

3. **Group creation modal vs dedicated screen**
   - What we know: The roadmap mentions "group creation and groups list screen."
   - What's unclear: Whether group creation should be a modal/bottom sheet or a full screen.
   - Recommendation: Use a simple modal or inline form at the top of the groups list. A full screen is overkill for a single text input (group name). However, bottom sheets are deferred to Phase 6 (UX-06), so use a simple modal or Alert.prompt for now.

## Sources

### Primary (HIGH confidence)
- Existing codebase: supabase/migrations/00001_initial_schema.sql, 00002_fix_rls_recursion.sql
- Existing codebase: app.json (scheme: "hatian" already configured)
- Existing codebase: lib/supabase.ts, lib/auth-context.tsx, components/ui/Avatar.tsx
- [Expo Linking Docs](https://docs.expo.dev/versions/latest/sdk/linking/) - createURL, parse APIs
- [Expo Router Deep Linking](https://docs.expo.dev/linking/into-your-app/) - Auto deep linking with file-based routing
- [Expo Router URL Parameters](https://docs.expo.dev/router/reference/url-parameters/) - useLocalSearchParams
- [Expo Router +native-intent.tsx](https://docs.expo.dev/router/advanced/native-intent/) - redirectSystemPath for URL rewriting
- [React Native Share API](https://reactnative.dev/docs/share) - Share.share() method

### Secondary (MEDIUM confidence)
- [Supabase RPC Documentation](https://supabase.com/docs/reference/javascript/v1/rpc) - RPC function patterns

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use
- Architecture: HIGH - Patterns directly follow existing codebase conventions and official Expo docs
- Pitfalls: HIGH - RLS recursion pitfall already encountered and solved in Phase 2; deep link pitfalls from official docs
- Database: HIGH - Schema already exists, only migration for RPC functions needed

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable - schema exists, deps already installed)
