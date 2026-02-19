# Phase 6: Polish & Distribution - Research

**Researched:** 2026-02-19
**Domain:** Offline resilience, micro-interactions, Taglish microcopy, EAS distribution
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Queue both "add expense" and "create group" actions offline
- Show items optimistically (with pending state) plus a persistent "You're offline" banner at top of screen
- On reconnect sync failure: show error toast with a "Retry" action button; item stays in pending state until resolved
- No silent auto-retry -- user controls retry
- Cached data (groups, expenses, balances) persists across app restarts via local storage
- App opens instantly with last-known data, refreshes in background
- Shimmer skeleton loaders for all list screens (groups, expenses, members, balances)
- Custom animated pull-to-refresh (e.g., coin/peso drop animation fitting the app personality)
- Platform default screen transitions (iOS slide-from-right, Android fade) -- no shared element transitions
- Background data updates use fade-in animation for new/changed items so user notices what changed

### Claude's Discretion
- Haptic feedback patterns (which actions, intensity)
- Bottom sheet vs modal decisions for confirmation flows
- Empty state illustrations and microcopy (Taglish tone, peso sign usage)
- Skeleton shape design matching existing card/list components
- Specific pull-to-refresh animation design
- Offline queue storage mechanism (expo-sqlite vs AsyncStorage vs MMKV)
- EAS build configuration and distribution setup
- Exact offline banner styling and positioning

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

This phase covers four distinct domains: (1) offline queue with optimistic UI, (2) skeleton/shimmer loaders and pull-to-refresh, (3) haptics and bottom sheets for micro-interactions, and (4) Taglish microcopy plus EAS distribution. The app already has `react-native-reanimated ~4.1.1`, `react-native-gesture-handler ~2.28.0`, and `expo-haptics ~15.0.8` installed, so the polish layer builds on existing infrastructure. No babel.config.js is needed for Reanimated on Expo SDK 54 -- it is handled automatically by babel-preset-expo.

The offline queue is best implemented as a custom lightweight solution using expo-sqlite (already in the project for session persistence) rather than pulling in heavy libraries like react-native-offline which couple to Redux. The queue stores serialized action payloads, with a simple flush-on-reconnect loop controlled by user retry. For skeletons, Moti Skeleton with expo-linear-gradient is the standard approach since the project already has Reanimated. Bottom sheets use @gorhom/bottom-sheet v5 which pairs naturally with the existing gesture-handler and reanimated dependencies. EAS internal distribution requires creating an eas.json with a "preview" profile set to `"distribution": "internal"`.

**Primary recommendation:** Use expo-sqlite for the offline queue (already installed), Moti Skeleton for shimmer loaders, @gorhom/bottom-sheet v5 for action sheets, and keep the stack minimal by leveraging what is already installed.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| expo-haptics | ~15.0.8 | Haptic feedback | Already in package.json |
| react-native-reanimated | ~4.1.1 | Animations (shimmer, pull-to-refresh, fade-in) | Already installed |
| react-native-gesture-handler | ~2.28.0 | Gesture support for bottom sheets | Already installed |
| expo-sqlite | ~16.0.10 | Offline queue persistence + cached data | Already installed |
| expo | ~54.0.33 | SDK, EAS Build | Already installed |

### New Dependencies
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @gorhom/bottom-sheet | ^5 | Bottom sheet for actions/confirmations | De facto standard for RN bottom sheets, built on Reanimated v3 + Gesture Handler v2 |
| moti | ^0.29 | Skeleton shimmer loader component | Best shimmer lib for Reanimated 3, supports Skeleton.Group |
| expo-linear-gradient | latest | Required by moti/skeleton for shimmer effect | Expo-native gradient, no native module issues |
| @react-native-community/netinfo | latest | Network connectivity detection + listener | Expo-supported, provides useNetInfo hook and addEventListener |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| expo-sqlite for queue | MMKV | MMKV is 30x faster but requires expo prebuild; project already uses expo-sqlite for session persistence, consistency wins |
| expo-sqlite for queue | AsyncStorage | AsyncStorage is async-only and slower; expo-sqlite is already in the project |
| moti/skeleton | react-native-skeleton-content | moti leverages existing Reanimated dep; skeleton-content brings its own animation engine |
| @gorhom/bottom-sheet | React Native Modal | Bottom sheets feel more native on mobile, support drag-to-dismiss, backdrop tap |

**Installation:**
```bash
npx expo install @gorhom/bottom-sheet moti expo-linear-gradient @react-native-community/netinfo
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
  offline-queue.ts        # Queue class: enqueue, flush, getAll, remove
  network-context.tsx     # React context providing isOnline + offline banner
  cached-data.ts          # Read/write cached groups/expenses/balances to SQLite
components/
  ui/
    Skeleton.tsx           # Reusable skeleton wrapper for cards/lists
    BottomSheet.tsx        # Wrapper around @gorhom/bottom-sheet with app theming
    OfflineBanner.tsx      # Persistent top banner when offline
    EmptyState.tsx         # Reusable empty state with emoji + Taglish microcopy
    PullToRefresh.tsx      # Custom animated refresh control (peso coin animation)
```

### Pattern 1: Offline Queue with Optimistic UI
**What:** Enqueue actions locally when offline, show them optimistically with pending state, flush on reconnect
**When to use:** "add expense" and "create group" while offline

```typescript
// lib/offline-queue.ts
import * as SQLite from 'expo-sqlite';

interface QueuedAction {
  id: string;
  type: 'create_group' | 'add_expense';
  payload: string; // JSON-serialized
  created_at: number;
  status: 'pending' | 'failed';
}

// Initialize queue table in the same SQLite db used for session
const db = SQLite.openDatabaseSync('offline-queue.db');

export function initQueue() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS action_queue (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT DEFAULT 'pending'
    )
  `);
}

export function enqueue(type: QueuedAction['type'], payload: object): string {
  const id = crypto.randomUUID?.() ?? Date.now().toString();
  db.runSync(
    'INSERT INTO action_queue (id, type, payload, created_at, status) VALUES (?, ?, ?, ?, ?)',
    [id, type, JSON.stringify(payload), Date.now(), 'pending']
  );
  return id;
}

export function getPendingActions(): QueuedAction[] {
  return db.getAllSync('SELECT * FROM action_queue WHERE status = ? ORDER BY created_at ASC', ['pending']);
}

export function markFailed(id: string) {
  db.runSync('UPDATE action_queue SET status = ? WHERE id = ?', ['failed', id]);
}

export function removeAction(id: string) {
  db.runSync('DELETE FROM action_queue WHERE id = ?', [id]);
}
```

### Pattern 2: Network Context with Offline Banner
**What:** Global context that tracks online/offline state, renders persistent banner
**When to use:** Wrap the app root so all screens can read connectivity

```typescript
// lib/network-context.tsx
import React, { createContext, useContext } from 'react';
import NetInfo, { useNetInfo } from '@react-native-community/netinfo';

const NetworkContext = createContext({ isOnline: true });

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected ?? true; // assume online until proven otherwise

  return (
    <NetworkContext.Provider value={{ isOnline }}>
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext);
```

### Pattern 3: Cached Data Layer
**What:** Cache Supabase query results to SQLite, load on startup, refresh in background
**When to use:** Groups list, expenses list, balances

```typescript
// lib/cached-data.ts
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('cached-data.db');

export function initCache() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

export function getCached<T>(key: string): T | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM cache WHERE key = ?', [key]);
  return row ? JSON.parse(row.value) : null;
}

export function setCache(key: string, value: unknown) {
  db.runSync(
    'INSERT OR REPLACE INTO cache (key, value, updated_at) VALUES (?, ?, ?)',
    [key, JSON.stringify(value), Date.now()]
  );
}
```

### Pattern 4: Bottom Sheet Setup
**What:** Wrap app with required providers, create themed bottom sheet component
**When to use:** All action/confirmation flows (add expense, create group, invite member)

```typescript
// In app/_layout.tsx -- add GestureHandlerRootView + BottomSheetModalProvider
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

// Wrap: GestureHandlerRootView > BottomSheetModalProvider > AuthProvider > ...
```

### Pattern 5: Shimmer Skeleton with Moti
**What:** Skeleton.Group wrapping card-shaped placeholders matching existing UI
**When to use:** All list loading states

```typescript
import { Skeleton } from 'moti/skeleton';

function GroupCardSkeleton() {
  return (
    <Skeleton.Group show={true}>
      <View style={styles.card}>
        <View style={styles.row}>
          <Skeleton colorMode="dark" radius="round" height={40} width={40} />
          <View style={styles.info}>
            <Skeleton colorMode="dark" height={16} width="60%" />
            <Skeleton colorMode="dark" height={12} width="30%" />
          </View>
        </View>
      </View>
    </Skeleton.Group>
  );
}
```

### Anti-Patterns to Avoid
- **Auto-retry on reconnect:** User locked decision says NO silent auto-retry. Always surface retry to user.
- **Spinners instead of skeletons:** User locked decision says shimmer skeletons, never spinner/ActivityIndicator for list loads.
- **Toasts for offline state:** User wants persistent banner, not a dismissable toast. Toasts are only for sync failure notifications.
- **Separate SQLite databases per feature:** Use one db for queue, one for cache, keep it minimal.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Network state detection | Custom AppState + fetch polling | @react-native-community/netinfo | Handles all edge cases (cellular, wifi, VPN), provides hooks |
| Shimmer animation | Custom Animated.View gradient loop | moti/skeleton | Complex gradient animation with proper cleanup, already tested |
| Bottom sheet gestures | Custom PanResponder sheet | @gorhom/bottom-sheet v5 | Gesture interruption, keyboard avoidance, snap points, backdrop |
| Haptic feedback | Direct Vibration API | expo-haptics | Cross-platform with proper fallbacks, no VIBRATE permission needed on Android |
| Linear gradient | Custom shader or image | expo-linear-gradient | Native performance, required by moti/skeleton |

**Key insight:** This phase is about polish, not features. Every micro-interaction library handles edge cases (keyboard avoidance, gesture conflicts, animation cleanup) that hand-rolled solutions miss.

## Common Pitfalls

### Pitfall 1: GestureHandlerRootView Missing
**What goes wrong:** @gorhom/bottom-sheet silently fails to respond to gestures
**Why it happens:** Bottom sheet requires GestureHandlerRootView wrapping the entire app
**How to avoid:** Add GestureHandlerRootView as the outermost wrapper in app/_layout.tsx. Currently NOT present in the app.
**Warning signs:** Bottom sheet renders but cannot be dragged or dismissed

### Pitfall 2: Optimistic UI ID Conflicts
**What goes wrong:** Locally-generated IDs clash with server-generated UUIDs after sync
**Why it happens:** Creating items optimistically with local IDs, then server returns different IDs
**How to avoid:** Use a separate `local_id` field for optimistic items; replace with server ID after sync succeeds. Mark optimistic items visually (subtle pending indicator).
**Warning signs:** Duplicate items appearing after sync

### Pitfall 3: Stale Cache Displayed After Login Change
**What goes wrong:** User B sees User A's cached data after switching accounts
**Why it happens:** Cache is not scoped to user
**How to avoid:** Scope cache keys by user ID (e.g., `groups:${userId}`). Clear cache on sign-out.
**Warning signs:** Wrong data flashing before refresh

### Pitfall 4: Moti Skeleton colorMode Mismatch
**What goes wrong:** Shimmer skeleton looks invisible or too bright against dark background
**Why it happens:** Using default "light" colorMode on dark-themed app
**How to avoid:** Always pass `colorMode="dark"` to Skeleton components. The app uses a dark-first theme.
**Warning signs:** Skeleton placeholders not visible

### Pitfall 5: Offline Banner Covering Content
**What goes wrong:** Fixed banner overlaps navigation headers or tab bars
**Why it happens:** Banner inserted at wrong level in component tree
**How to avoid:** Insert OfflineBanner just below SafeAreaView top edge, above content but below header. Use absolute positioning with a known height (e.g., 36px) and animate in/out.
**Warning signs:** Content jumping or being hidden

### Pitfall 6: EAS Build Missing Credentials
**What goes wrong:** iOS build fails due to missing provisioning profile or Apple credentials
**Why it happens:** First EAS build needs Apple Developer account login and device registration
**How to avoid:** Run `eas credentials` and `eas device:create` before first build. For ad hoc distribution, register test device UDIDs first (limited to 100/year).
**Warning signs:** Build succeeds but install fails on device

### Pitfall 7: NetInfo Reports False Positive Connectivity
**What goes wrong:** NetInfo says "connected" but Supabase requests fail (captive portal, etc.)
**Why it happens:** NetInfo checks network layer, not application layer reachability
**How to avoid:** After NetInfo reports reconnection, actually attempt the queued Supabase call. If it fails, keep the item in pending state and show retry.
**Warning signs:** Queue flushes but all actions fail

## Code Examples

### expo-haptics Usage Patterns
```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/haptics/
import * as Haptics from 'expo-haptics';

// RECOMMENDED haptic patterns for this app:
// 1. Button press (add expense, create group): Light impact
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// 2. Success (expense added, group created): Success notification
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// 3. Error (sync failure, validation error): Error notification
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

// 4. Selection change (member toggle in split, payer selection): Selection
await Haptics.selectionAsync();

// 5. Destructive action confirmation (delete): Medium impact
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
```

### Bottom Sheet Themed Component
```typescript
// components/ui/BottomSheet.tsx
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { colors } from '@/theme';

// Key props for dark theme:
// backgroundStyle={{ backgroundColor: colors.backgroundCard }}
// handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
// backdropComponent={(props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />}
```

### Offline Banner Component
```typescript
// components/ui/OfflineBanner.tsx
// Persistent banner at top of screen, animated slide-down when offline
// Uses Reanimated for smooth entrance/exit
// Height: 36px, background: colors.warning (yellow), text: dark
// Position: just below SafeAreaView inset, above content
// Text: "You're offline -- changes will sync when you reconnect"
```

### Cached Data Load Pattern
```typescript
// In screen component:
const [groups, setGroups] = useState<GroupRow[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  // 1. Load cached data instantly
  const cached = getCached<GroupRow[]>(`groups:${user.id}`);
  if (cached) {
    setGroups(cached);
    setLoading(false); // No skeleton needed
  }

  // 2. Fetch fresh data in background
  fetchGroups().then((fresh) => {
    setGroups(fresh);
    setCache(`groups:${user.id}`, fresh);
    setLoading(false);
  });
}, []);
```

### EAS Configuration
```json
// eas.json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "production": {}
  }
}
```

### Pull-to-Refresh Custom Animation
```typescript
// Custom peso coin drop animation using Reanimated
// Use FlatList's onRefresh + refreshing props
// Override RefreshControl with a custom component that:
// 1. Shows a peso coin icon that drops with gravity
// 2. Spins while refreshing
// 3. Bounces back up when done
// Implementation: Animated.View with translateY + rotate driven by
// useSharedValue tracking the pull distance
```

## Discretion Recommendations

### Haptic Feedback Patterns
| Action | Haptic Type | Intensity | Rationale |
|--------|-------------|-----------|-----------|
| Tab switch | Light impact | Subtle | Already in HapticTab component |
| Add expense button press | Light impact | Subtle | Common action, shouldn't be jarring |
| Expense saved successfully | Success notification | Standard | Confirms completion |
| Group created | Success notification | Standard | Confirms completion |
| Sync failure | Error notification | Standard | Alerts to problem |
| Member selection toggle | Selection | Minimal | Frequent interaction |
| Pull-to-refresh threshold | Medium impact | Medium | Signals "release to refresh" |
| Destructive confirm (remove member) | Medium impact | Medium | Adds weight to decision |

### Bottom Sheet vs Modal
| Flow | Recommendation | Rationale |
|------|----------------|-----------|
| Create group | Bottom sheet | Replace current Modal; more native feel, drag-to-dismiss |
| Add expense | Keep as full screen | Complex form with multiple steps, bottom sheet too cramped |
| Invite/add member | Bottom sheet | Simple input, benefits from drag-to-dismiss |
| Remove member confirm | Bottom sheet with red action | Destructive confirmation, clear visual hierarchy |
| Expense detail | Keep as screen | Has navigation context (drill-down from list) |

### Offline Queue Storage: expo-sqlite
**Recommendation:** Use expo-sqlite (already installed) for the offline queue.
- Project already uses expo-sqlite for Supabase session persistence
- Synchronous API via `openDatabaseSync` / `runSync` / `getAllSync` -- perfect for queue operations
- No new native dependency needed
- MMKV would be faster but requires additional native module setup; queue operations are infrequent enough that SQLite performance is more than sufficient

### Empty State Microcopy (Taglish)
| Screen | Emoji | Headline | Subtext |
|--------|-------|----------|---------|
| Groups (no groups) | (coin emoji) | Wala ka pang group! | Tap + to create one, or ask a friend for an invite code |
| Expenses (no expenses) | (receipt emoji) | No expenses yet | Mag-add ng expense para ma-track kung sino may utang |
| Members (just you) | (wave emoji) | Ikaw lang dito! | Share the invite code para ma-join ang friends mo |
| Balances (all settled) | (check emoji) | All settled! | Walang utang-utangan. Nice! |

### Pull-to-Refresh Animation
**Recommendation:** Peso coin drop animation
- Show a small peso sign icon that tracks finger pull distance
- At refresh threshold, coin "drops" with slight bounce
- While refreshing, coin spins with a subtle glow
- On complete, coin fades out
- Keep animation under 60 frames, use `useAnimatedStyle` with `withSpring`

### Offline Banner Styling
**Recommendation:**
- Background: `colors.warning` (yellow #FFEB69) with 90% opacity
- Text: `colors.textInverse` (near-black)
- Height: 36px, full width
- Position: absolute, top of screen below SafeArea inset
- Content: Wifi-off icon + "You're offline"
- Animate: slideDown on disconnect, slideUp on reconnect (200ms)
- Content below shifts down to avoid overlap

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AsyncStorage for offline data | expo-sqlite synchronous API | Expo SDK 52+ | Synchronous reads, no async overhead |
| react-native-reanimated babel plugin | Auto-configured in babel-preset-expo | Expo SDK 52+ | No babel.config.js needed |
| Manual provisioning profiles | EAS managed credentials | EAS Build v3+ | eas credentials handles signing automatically |
| Redux-based offline middleware | Lightweight custom queue | 2024+ | Less boilerplate, no Redux dependency needed |

**Deprecated/outdated:**
- `AsyncStorage` for performance-sensitive storage: expo-sqlite synchronous API is faster and already in the project
- Manual `babel.config.js` for Reanimated: Not needed on Expo SDK 54, handled by babel-preset-expo automatically

## Open Questions

1. **Apple Developer Account access**
   - What we know: EAS internal distribution for iOS requires an Apple Developer account ($99/year) and ad hoc provisioning (100 device limit)
   - What's unclear: Whether the user has an active Apple Developer account
   - Recommendation: Plan the EAS setup task to handle both iOS and Android, but note iOS requires credentials setup first. Android APK works immediately.

2. **Custom pull-to-refresh vs FlatList default**
   - What we know: FlatList's built-in `refreshing`/`onRefresh` uses platform default RefreshControl
   - What's unclear: Whether a fully custom animated refresh control is worth the complexity vs a themed version of the default
   - Recommendation: Start with a themed RefreshControl (custom tintColor/colors), upgrade to custom animation if time permits. The custom coin animation is a nice-to-have.

3. **Expo SDK 54 + @gorhom/bottom-sheet v5 compatibility**
   - What we know: bottom-sheet v5 works with Reanimated v3 and Gesture Handler v2, both installed
   - What's unclear: Any specific issues with Expo SDK 54 + React Native 0.81
   - Recommendation: Install and test immediately; if issues arise, fall back to a simpler Reanimated-based custom bottom sheet

## Sources

### Primary (HIGH confidence)
- expo-haptics official docs: https://docs.expo.dev/versions/latest/sdk/haptics/ -- full API reference verified
- EAS internal distribution docs: https://docs.expo.dev/build/internal-distribution/ -- configuration and setup
- Moti skeleton docs: https://moti.fyi/skeleton -- API, props, Skeleton.Group
- @gorhom/bottom-sheet docs: https://gorhom.dev/react-native-bottom-sheet/ -- installation, v5, providers
- Expo Reanimated docs: https://docs.expo.dev/versions/latest/sdk/reanimated/ -- no babel plugin needed
- @react-native-community/netinfo Expo docs: https://docs.expo.dev/versions/latest/sdk/netinfo/

### Secondary (MEDIUM confidence)
- expo-sqlite offline-first patterns: https://medium.com/@aargon007/expo-sqlite-a-complete-guide-for-offline-first-react-native-apps-984fd50e3adb
- MMKV vs AsyncStorage comparison: https://reactnativeexpert.com/blog/mmkv-vs-asyncstorage-in-react-native/

### Tertiary (LOW confidence)
- Pull-to-refresh custom animation approaches -- based on training knowledge, no specific verified source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified against official docs, most already installed
- Architecture: HIGH -- patterns verified with official APIs, SQLite synchronous API confirmed
- Pitfalls: HIGH -- based on verified library requirements (GestureHandlerRootView, colorMode) and established patterns
- EAS setup: MEDIUM -- docs verified but actual build depends on user's Apple Developer account status
- Custom pull-to-refresh: LOW -- training knowledge only, may need iteration

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days -- stable libraries, no major releases expected)
