# Phase 2: Authentication - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phone OTP sign-in with profile setup. Users can enter their Philippine phone number, verify via OTP, set up a display name and optional avatar, and maintain a persistent session. This phase establishes identity for all group and expense operations. Sign-out is included; password reset, email auth, and OAuth are out of scope.

</domain>

<decisions>
## Implementation Decisions

### OTP sign-in flow
- Phone number input: +63 country code pre-filled and non-editable, user enters the 10-digit number only
- OTP input: 6 individual digit boxes with auto-advance on each digit and auto-submit when all filled
- Error handling: inline error message below the OTP boxes + "Resend OTP" button with 60-second cooldown timer
- Rate limiting: 3 wrong OTP attempts triggers a 5-minute lockout before allowing resend

### Claude's Discretion
- Profile setup screen design (what info to collect, avatar handling, flow)
- Session persistence and returning user behavior (auto sign-in, expiry)
- Sign-out flow and confirmation
- Auth screen visual design, copy, and branding presence
- Loading states and transitions between auth screens

</decisions>

<specifics>
## Specific Ideas

- Philippine-focused: +63 locked prefix signals this is built for Filipino users
- Individual digit boxes for OTP — familiar mobile pattern (GCash, Maya style)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-authentication*
*Context gathered: 2026-02-18*
