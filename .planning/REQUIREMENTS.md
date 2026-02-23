# Requirements: v1.4 PostHog Analytics

**Defined:** 2026-02-24
**Core Value:** A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.

## v1.4 Requirements

### SDK Setup

- [x] **SETUP-01**: PostHog standalone client created in `lib/analytics.ts` with API key from environment variable (`EXPO_PUBLIC_POSTHOG_API_KEY`)
- [x] **SETUP-02**: PostHogProvider wraps app root in `app/_layout.tsx` via `client` prop with autocapture disabled (`captureScreens: false`, `captureTouches: false`)
- [x] **SETUP-03**: Debug mode enabled only in development (`debug: __DEV__`)

### Screen Tracking

- [x] **SCREEN-01**: Screen views tracked automatically on every route change via `usePathname()` + `posthog.screen()` in root layout
- [x] **SCREEN-02**: Dynamic route segments normalized to template names (e.g., `/group/[id]` not `/group/abc123`, `/group/[id]/add-expense` not `/group/abc123/add-expense`)

### User Identification

- [x] **IDENT-01**: User identified with Supabase user ID (`posthog.identify(session.user.id)`) after profile setup completes (when `isNewUser` becomes `false`)
- [x] **IDENT-02**: Person properties set on identify — `display_name` via `$set`, `signup_method` and `first_sign_in_date` via `$set_once`
- [x] **IDENT-03**: `posthog.reset()` called on sign-out to clear identity before `supabase.auth.signOut()`

### Core Events

- [x] **EVENT-01**: `sign_in` event captured after successful Apple Sign-In — properties: `method: "apple"`
- [x] **EVENT-02**: `profile_completed` event captured after profile setup save — properties: `has_avatar: boolean`
- [x] **EVENT-03**: `group_created` event captured after group creation — properties: `group_id`
- [x] **EVENT-04**: `expense_added` event captured after expense submission — properties: `group_id`, `amount`, `split_type`, `member_count`
- [x] **EVENT-05**: `settle_up` event captured after settlement recorded — properties: `group_id`, `amount`
- [x] **EVENT-06**: `invite_accepted` event captured after accept RPC — properties: `group_id`
- [x] **EVENT-07**: `invite_declined` event captured after decline confirm — properties: `group_id`
- [x] **EVENT-08**: `group_joined_via_link` event captured after deep-link join — properties: `group_id`
- [x] **EVENT-09**: `invite_shared` event captured when share button tapped — properties: `group_id`

## Future Requirements (v1.5+)

- Super properties (`app_version`, `platform`) sent with every event
- Expense wizard step tracking (step-by-step funnel within add-expense flow)
- Offline sync event tracking (`offline_sync_completed`)
- Error event tracking (`error_occurred` on RPC failures)
- PostHog dashboard funnel and cohort configuration
- Analytics opt-out toggle in profile settings (DPA compliance)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Session replay | Adds native deps, performance overhead, privacy risk with financial data |
| Feature flags | 5-10 testers, no need for gradual rollout |
| A/B experiments | Statistically meaningless at current scale |
| Touch autocapture | Generates noise (numpad taps), wastes event quota |
| PostHog Group analytics | Paid feature, not needed for beta |
| Server-side tracking (posthog-node) | All analytics are client-side |
| User-facing analytics dashboards | Separate product feature, not analytics infrastructure |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 16 | Complete |
| SETUP-02 | Phase 16 | Complete |
| SETUP-03 | Phase 16 | Complete |
| SCREEN-01 | Phase 16 | Complete |
| SCREEN-02 | Phase 16 | Complete |
| IDENT-01 | Phase 16 | Complete |
| IDENT-02 | Phase 16 | Complete |
| IDENT-03 | Phase 16 | Complete |
| EVENT-01 | Phase 16 | Complete |
| EVENT-02 | Phase 16 | Complete |
| EVENT-03 | Phase 16 | Complete |
| EVENT-04 | Phase 16 | Complete |
| EVENT-05 | Phase 16 | Complete |
| EVENT-06 | Phase 16 | Complete |
| EVENT-07 | Phase 16 | Complete |
| EVENT-08 | Phase 16 | Complete |
| EVENT-09 | Phase 16 | Complete |

**Coverage:**
- v1.4 requirements: 17 total
- Mapped to phases: 17/17
- Unmapped: 0

---
*Requirements defined: 2026-02-24*
