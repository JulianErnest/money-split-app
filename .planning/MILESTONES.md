# Milestones: HatianApp

## Completed

### v1.5 — Partial Settlements (2026-02-27 → 2026-02-28)

**Goal:** Allow users to record partial payments instead of requiring whole-balance settlements, enabling installment-style paybacks.

**Phases:** 1 (Phase 17)
**Plans:** 1 total
**Requirements:** 6/6 complete

**What shipped:**
- Two-state SettleConfirmSheet with display mode and NumPad edit mode
- Balance-capped amount input with dust rule (remainder < P1.00 forces full settle)
- Differentiated toast messages for partial vs full settlements
- PostHog analytics tracking with `is_partial` flag
- Backwards-compatible full settlement behavior

**Key decisions:**
- Inline hook in SettleConfirmSheet (single consumer)
- Dust rule threshold at P1.00 (100 centavos)
- Display mode 35% snap, edit mode 75% snap
- No backend/database changes needed (purely UI)

**Last phase number:** 17

---

### v1.1 — Invites & Settle Up (2026-02-19 → 2026-02-20)

**Goal:** Fix the broken invite/pending member system with proper consent-based invites, and add manual settle-up so users can record payments.

**Phases:** 3 (7 through 9)
**Plans:** 6 total
**Requirements:** 12/12 complete

**What shipped:**
- Phone normalization fix and creator-only guards for adding members
- Consent-aware invite system (pending invites, not auto-add)
- Invite inbox on home screen with accept/decline flows
- Decline cleanup (hard delete splits for re-invite capability)
- Settlements table with record/delete RPCs and balance math integration
- Settle-up UI with confirmation bottom sheet, history section, and delete

**Key decisions:**
- Invite inbox (not push notifications)
- Creator-only phone invites for security
- Whole-balance settlement only
- Hard delete on decline for re-invite capability
- No server-side amount validation (race condition tolerance)

**Last phase number:** 9

---

### v1.0 — Core Expense Splitting (2026-02-18 → 2026-02-19)

**Goal:** Ship a testable private build with the core expense-splitting loop — groups, expenses, balances, offline support.

**Phases:** 7 (1 through 6, plus 4.1 inserted)
**Plans:** 22 total, ~1.4 hours execution
**Requirements:** 27/27 complete

**What shipped:**
- Phone OTP authentication with profile setup
- Groups with invite links (Expo deep linking)
- Expenses with equal/custom splits
- Pending members by phone (pre-register before install)
- Debt simplification algorithm with balance views
- Offline queue with sync-on-reconnect
- Dark-first UI with skeleton loaders, haptics, bottom sheets
- EAS internal distribution build

**Key decisions:**
- Phone OTP only (Filipino market)
- Expenses immutable in Stage 1
- Greedy two-pointer debt simplification
- expo-sqlite for Supabase session persistence
- security definer function pattern for RLS

**Last phase number:** 6
