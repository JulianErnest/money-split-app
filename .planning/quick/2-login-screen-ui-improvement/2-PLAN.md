---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(auth)/sign-in.tsx
autonomous: true
requirements: [QUICK-2]

must_haves:
  truths:
    - "Login screen has content anchored to the bottom, letting carousel images fill more of the screen"
    - "Carousel has page indicator dots showing which image is active"
    - "Each carousel slide has a contextual tagline that fades in/out with the image"
    - "Apple Sign-In button remains fully functional with no regressions"
  artifacts:
    - path: "app/(auth)/sign-in.tsx"
      provides: "Improved sign-in screen with bottom-anchored layout, page dots, and rotating taglines"
      min_lines: 100
  key_links:
    - from: "app/(auth)/sign-in.tsx"
      to: "expo-apple-authentication"
      via: "AppleAuthenticationButton onPress"
      pattern: "onPress.*handleSignIn"
---

<objective>
Improve the login screen visual design while preserving all existing authentication logic.

Purpose: The current sign-in screen centers content vertically, which obscures the background carousel. Moving content to the bottom third creates a more visually appealing hero layout. Adding page dots and rotating taglines gives the screen more polish and visual interest.

Output: Updated `app/(auth)/sign-in.tsx` with improved layout and visual elements.
</objective>

<execution_context>
@/home/claude/.claude/get-shit-done/workflows/execute-plan.md
@/home/claude/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/(auth)/sign-in.tsx
@theme/colors.ts
@theme/typography.ts
@theme/spacing.ts
@components/ui/Text.tsx
</context>

<interfaces>
<!-- Existing theme tokens used by sign-in screen -->

From theme/colors.ts:
```typescript
colors.background    // #0D0D0D (nearBlack)
colors.accent        // #9FE870 (green)
colors.textPrimary   // #FFFFFF
colors.textSecondary // #AAAAAA
colors.error         // #E85454
```

From theme/spacing.ts:
```typescript
spacing[1] = 4, spacing[2] = 8, spacing[3] = 12, spacing[4] = 16
spacing[5] = 20, spacing[6] = 24, spacing[8] = 32, spacing[10] = 40
```

From theme/typography.ts:
```typescript
textStyles.h1   // bold, 30px
textStyles.body // regular, 15px
fontFamily.semiBold // PlusJakartaSans_600SemiBold
fontSize.lg     // 17
```

From components/ui/Text.tsx:
```typescript
<Text variant="h1" color="accent">  // Maps to textStyles.h1 + colors.accent
<Text variant="body" color="textSecondary">  // Maps to textStyles.body + colors.textSecondary
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Redesign sign-in screen layout with bottom-anchored content, page dots, and rotating taglines</name>
  <files>app/(auth)/sign-in.tsx</files>
  <action>
Refactor the sign-in screen layout in `app/(auth)/sign-in.tsx`. PRESERVE all existing auth logic (handleSignIn, useEffect for Apple availability, nonce generation, Supabase exchange, fullName capture, analytics tracking, error handling) -- only change the JSX layout and styles.

**Layout changes:**
- Change `container` from `justifyContent: "center"` to `justifyContent: "flex-end"` so content sits in the bottom third of the screen, letting the carousel images fill the top
- Add `paddingBottom: spacing[12]` (48px) to container for comfortable bottom spacing on devices with home indicators
- Keep SafeAreaView wrapping

**Page indicator dots:**
- Add a row of 3 small dots below the carousel overlay, positioned above the content area
- Each dot: 8x8 circle, `borderRadius: radius.full`
- Active dot: `backgroundColor: colors.accent` (green)
- Inactive dots: `backgroundColor: colors.textTertiary` (gray1 / #666666)
- Use `currentIndex` state (already exists) to determine active dot
- Row centered horizontally with `gap: spacing[2]` (8px) between dots
- Add `marginBottom: spacing[8]` (32px) below the dot row

**Rotating taglines:**
- Define a `CAROUSEL_TAGLINES` array with 3 taglines matching the 3 images:
  - "Split bills, not friendships"
  - "Track expenses with your barkada"
  - "Settle up in seconds"
- Display the tagline corresponding to `currentIndex` (already drives the image carousel)
- The tagline inherits the existing `fadeAnim` opacity animation (it already fades in/out with the image)
- Use `<Text variant="h2" color="textPrimary">` for the tagline
- Center-align the tagline text with `textAlign: "center"`
- Place tagline between the dots and the app name
- Add `marginBottom: spacing[6]` (24px) below the tagline

**App name and subtitle adjustments:**
- Center-align both app name "KKB" and subtitle text (`textAlign: "center"`)
- Change app name from `variant="h1"` to a custom style: `fontSize: fontSize.hero` (48px), `fontFamily: fontFamily.extraBold`, keeping `color="accent"`
- Keep subtitle "Split expenses with your barkada" as `variant="body" color="textSecondary"` but center it
- Reduce `header` marginBottom from `spacing[10]` to `spacing[6]` to keep the bottom section compact

**Overlay gradient feel (subtle):**
- Change the overlay from a flat `rgba(13, 13, 13, 0.75)` to a gradient effect using two stacked Views:
  - Top half: `rgba(13, 13, 13, 0.3)` (lighter, lets images show through more)
  - Bottom half: `rgba(13, 13, 13, 0.85)` (darker, ensures text readability)
- Both views use `position: "absolute"` and split the screen vertically
- Top view: `top: 0, left: 0, right: 0, height: "50%"`
- Bottom view: `bottom: 0, left: 0, right: 0, height: "50%"`

**Apple button adjustments:**
- Keep the `AppleAuthenticationButton` exactly as is (WHITE style, cornerRadius 8, height 56)
- Keep the error text display above the button

**Do NOT change:**
- Any auth logic (handleSignIn function body)
- The carousel image source array or interval timing
- The fade animation logic (useEffect with Animated.timing)
- Any imports except potentially adding theme imports if needed
- The loading/error/isAvailable state management
  </action>
  <verify>
    <automated>cd /home/claude/money-split-app && npx tsc --noEmit app/\(auth\)/sign-in.tsx 2>&1 | head -20</automated>
  </verify>
  <done>
- Sign-in screen content is anchored to the bottom third of the screen
- 3 page indicator dots visible, active dot highlighted in green
- Rotating tagline fades in/out in sync with carousel images
- App name "KKB" rendered larger (hero size, extraBold) and centered
- Overlay has a gradient effect (lighter top, darker bottom)
- All auth logic (Apple Sign-In, nonce, Supabase, analytics) unchanged
- TypeScript compiles without errors
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Redesigned login screen with bottom-anchored layout, carousel page dots, rotating taglines, larger app name, and gradient overlay</what-built>
  <how-to-verify>
    1. Run the app: `npx expo start` and open on iOS simulator or device
    2. Navigate to sign-in screen (sign out if already logged in)
    3. Verify:
       - Content (app name, subtitle, sign-in button) sits in the bottom third
       - Background images are more visible in the top portion
       - Three page indicator dots are visible and the active one is green
       - Taglines rotate and fade in/out with each image change (~5 second interval)
       - "KKB" text is large and bold (hero size)
       - The overlay is lighter at the top, darker at the bottom
       - Apple Sign-In button still works (tap it to test the native dialog appears)
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues to fix</resume-signal>
</task>

</tasks>

<verification>
- TypeScript compiles: `npx tsc --noEmit app/\(auth\)/sign-in.tsx`
- No removed auth logic: grep for `handleSignIn`, `signInWithIdToken`, `trackSignIn`, `AppleAuthenticationButton` all still present
- Visual verification on device/simulator
</verification>

<success_criteria>
- Login screen has a polished, bottom-anchored layout with more visible background imagery
- Carousel page dots indicate current image
- Rotating taglines add context to each carousel image
- All authentication functionality preserved with no regressions
</success_criteria>

<output>
After completion, create `.planning/quick/2-login-screen-ui-improvement/2-SUMMARY.md`
</output>
