# Phase 1: Foundation & Design System - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Expo project skeleton with Supabase backend (schema + RLS) and a dark-first design system with soft green accent. Delivers the infrastructure and visual foundation that all subsequent phases build on. No user-facing features — just the scaffolding and design tokens/components.

</domain>

<decisions>
## Implementation Decisions

### Dark theme & color palette
- Near-black background (#0A0A0A-#121212 range) — depth without being harsh, like Discord/Spotify
- Soft green accent used sparingly — primary actions only (buttons, CTAs, active states), not pervasive
- Visual reference: Wise (TransferWise) dark mode — clean fintech aesthetic with green accent

### Claude's Discretion
- Card/surface elevation colors — Claude picks what works with the near-black base
- Exact green shade selection

### Typography & spacing
- Font choice at Claude's discretion — pick what works best for a fintech-style app
- Money amounts displayed bold & prominent — large, heavy weight, hero element treatment (like Wise)
- Spacious layout — generous padding, lots of whitespace, calm premium feel
- Peso symbol: ₱ (not PHP prefix) — compact, widely recognized in PH

### Component style
- Rounded shape language (12-16px radius) — soft, friendly, modern
- Button style at Claude's discretion — pick what fits the Wise-inspired direction
- Emoji-based avatars for users and groups — auto-assigned emoji, fun Filipino-friendly vibe
- Underline/minimal input fields — just a bottom border, clean Wise-like style

### Navigation structure
- Bottom tab bar with 3 tabs: Groups, Add (center), Profile
- Center Add button is elevated FAB style — larger, raised green button, stands out as primary action
- Home screen (Groups tab) shows summary + groups list — top balance summary section, then groups below (dashboard feel)

</decisions>

<specifics>
## Specific Ideas

- Wise (TransferWise) dark mode is the primary visual reference — clean, fintech, green accent on dark
- Emoji avatars give the app personality and a casual, Filipino-friendly feel
- The elevated center FAB for "Add Expense" makes the core action unmissable
- Dashboard-style home screen with balance summary on top sets the context before diving into groups

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-design-system*
*Context gathered: 2026-02-18*
