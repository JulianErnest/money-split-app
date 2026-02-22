# Phase 13: User Setup Instructions

This document contains manual configuration steps required for Phase 13 (Database & Infrastructure Prep).

## Service: Supabase Apple Provider

**Required by:** Plan 13-02 (Apple Auth Configuration)
**Purpose:** Enable Apple Sign-In authentication provider for native iOS flow

### Configuration Steps

**Location:** Supabase Dashboard > Authentication > Providers > Apple

1. **Enable Apple provider**
   - Toggle: Enable Apple provider = ON

2. **Set Authorized Client IDs**
   - Field: Authorized Client IDs = `com.kkbsplit.app`
   - This MUST match the `bundleIdentifier` in app.json

3. **Leave OAuth fields empty**
   - Secret Key: (empty)
   - Service ID: (empty)
   - Redirect URL: (empty)
   - These fields are for OAuth web flow only, NOT needed for native iOS `signInWithIdToken` flow

4. **Save configuration**

### Why This Is Manual

Supabase Management API does not provide endpoints for auth provider configuration. Dashboard is the only way to enable providers.

### Verification

**Status:** ✓ Complete (user confirmed 2026-02-22)

The configuration was completed during plan execution. To verify it's still enabled:

1. Visit: Supabase Dashboard > Authentication > Providers > Apple
2. Confirm: Apple provider toggle is ON
3. Confirm: Authorized Client IDs contains `com.kkbsplit.app`

### Next Steps

No action required. This configuration is persistent in Supabase and will be used in Phase 14 when `supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken })` is called.

### Troubleshooting

**If `signInWithIdToken` returns 400/422 errors in Phase 14:**
- Check that Apple provider is enabled in dashboard
- Verify Authorized Client IDs = `com.kkbsplit.app` (exact match, no spaces)
- Confirm bundle ID in app.json matches: `"bundleIdentifier": "com.kkbsplit.app"`

---

*Last updated: 2026-02-22*
