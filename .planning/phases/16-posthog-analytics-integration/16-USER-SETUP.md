# Phase 16: User Setup Required

**Generated:** 2026-02-24
**Phase:** 16-posthog-analytics-integration
**Status:** Incomplete

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `EXPO_PUBLIC_POSTHOG_API_KEY` | PostHog Dashboard -> Project Settings -> Project API Key | `.env` |

## Account Setup

- [ ] **Create PostHog account** at https://posthog.com (if not already created)
- [ ] **Create a project** (or use existing one)
- [ ] **Copy the Project API Key** from Project Settings

## Verification

After adding the environment variable, verify with:

```bash
# Confirm env var is set
grep EXPO_PUBLIC_POSTHOG_API_KEY .env

# Start the app and check console for PostHog debug output (dev mode)
npx expo start
# Look for "[PostHog Debug]" messages in the console
```

---
**Once all items complete:** Mark status as "Complete"
