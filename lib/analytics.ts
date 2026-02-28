import PostHog from "posthog-react-native";

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY!;

export const posthogClient = new PostHog(POSTHOG_API_KEY, {
  host: "https://us.i.posthog.com",
});

// Enable debug logging in development (debug is a method, not a constructor option)
if (__DEV__) {
  posthogClient.debug(true);
}

/**
 * Normalize dynamic route segments to template names for PostHog screen tracking.
 * Prevents creating separate screen entries for every group/expense/join instance.
 */
export function normalizePathname(pathname: string): string {
  return pathname
    .replace(/\/group\/[^/]+\/add-expense/, "/group/[id]/add-expense")
    .replace(/\/group\/[^/]+/, "/group/[id]")
    .replace(/\/join\/[^/]+/, "/join/[code]");
}

// ── Typed Event Helpers ──────────────────────────────────────────────

export function trackSignIn(method: "apple") {
  posthogClient.capture("sign_in", { method });
}

export function trackProfileCompleted(hasAvatar: boolean) {
  posthogClient.capture("profile_completed", { has_avatar: hasAvatar });
}

export function trackGroupCreated(groupId: string) {
  posthogClient.capture("group_created", { group_id: groupId });
}

export function trackExpenseAdded(data: {
  groupId: string;
  amount: number;
  splitType: string;
  memberCount: number;
}) {
  posthogClient.capture("expense_added", {
    group_id: data.groupId,
    amount: data.amount,
    split_type: data.splitType,
    member_count: data.memberCount,
  });
}

export function trackSettleUp(data: {
  groupId: string;
  amount: number;
  isPartial: boolean;
}) {
  posthogClient.capture("settle_up", {
    group_id: data.groupId,
    amount: data.amount,
    is_partial: data.isPartial,
  });
}

export function trackInviteAccepted(groupId: string) {
  posthogClient.capture("invite_accepted", { group_id: groupId });
}

export function trackInviteDeclined(groupId: string) {
  posthogClient.capture("invite_declined", { group_id: groupId });
}

export function trackGroupJoinedViaLink(groupId: string) {
  posthogClient.capture("group_joined_via_link", { group_id: groupId });
}

export function trackInviteShared(groupId: string) {
  posthogClient.capture("invite_shared", { group_id: groupId });
}
