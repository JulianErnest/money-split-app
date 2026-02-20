---
status: complete
phase: 07-invite-infrastructure
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md]
started: 2026-02-19T12:00:00Z
updated: 2026-02-19T12:30:00Z
---

## Tests

### 1. Creator sees Add Member button
expected: Open a group where you are the creator. You should see an "Add Member" button in the members section.
result: pass

### 2. Non-creator does NOT see Add Member button
expected: Open a group where you are NOT the creator (have someone else create a group and invite you via link). The "Add Member" button should NOT appear. You should still see the "Invite Friends" share button.
result: pass

### 3. Invite Friends button visible to all members
expected: In any group (whether you are creator or not), the "Invite Friends" share button remains visible and functional. Tapping it opens the share sheet with the invite link.
result: pass

### 4. Adding member by phone creates pending invite
expected: As group creator, tap Add Member, enter a phone number. The person should appear in the member list as a pending invite (not as a full group member). They should NOT be auto-added to the group.
result: pass

### 5. Invite link still auto-joins instantly
expected: Share an invite link with someone. When they open the link and join, they become a full group member immediately — no accept/decline step. This behavior is unchanged from before.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
