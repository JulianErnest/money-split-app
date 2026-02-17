# Phase 1: User Setup Required

**Generated:** 2026-02-18
**Phase:** 01-foundation-design-system
**Status:** Incomplete

Complete these items for Supabase integration to function.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `EXPO_PUBLIC_SUPABASE_URL` | Supabase Dashboard -> Project Settings -> API -> Project URL | `.env` |
| [ ] | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard -> Project Settings -> API -> anon/public key | `.env` |

## Account Setup

- [ ] **Create Supabase project**
  - URL: https://supabase.com/dashboard -> New Project
  - Skip if: Already have project

## Dashboard Configuration

- [ ] **Enable Phone Auth provider**
  - Location: Supabase Dashboard -> Authentication -> Providers -> Phone
  - Enable: Phone provider
  - Notes: Required for Phase 2 authentication

## Verification

After completing setup:

```bash
# Create .env from template
cp .env.example .env

# Fill in your values
# EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Check env vars
grep EXPO_PUBLIC_SUPABASE .env

# Verify build passes
npx expo start
```

---
**Once all items complete:** Mark status as "Complete" at top of file.
