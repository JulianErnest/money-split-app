import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GroupMember {
  id: string; // user.id for real members, pending_members.id for pending
  display_name: string; // user.display_name or formatted phone for pending
  avatar_url: string | null;
  isPending: boolean;
  phone_number?: string; // only for pending members, E.164 format
  invite_status?: "pending" | "accepted" | "declined"; // only for pending members
}

// ---------------------------------------------------------------------------
// Phone utilities
// ---------------------------------------------------------------------------

/**
 * Convert E.164 Philippine phone number to display format.
 * "+639171234567" -> "+63 917 123 4567"
 */
export function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace("+63", "");
  if (digits.length === 10) {
    return `+63 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return e164;
}

/**
 * Validate raw digits (without +63 prefix) as a Philippine mobile number.
 * Must be 10 digits starting with 9.
 */
export function isValidPHPhone(digits: string): boolean {
  return /^9\d{9}$/.test(digits);
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/**
 * Fetch all members (real + pending) for a group.
 * Returns a unified GroupMember[] array with isPending flag.
 */
export async function fetchAllMembers(
  groupId: string,
): Promise<GroupMember[]> {
  const [realResult, pendingResult] = await Promise.all([
    supabase
      .from("group_members")
      .select("user_id, users (id, display_name, avatar_url)")
      .eq("group_id", groupId),
    supabase
      .from("pending_members")
      .select("id, phone_number, nickname, invite_status")
      .eq("group_id", groupId),
  ]);

  const realMembers: GroupMember[] = (realResult.data ?? []).map(
    (row: any) => ({
      id: row.users.id,
      display_name: row.users.display_name || "Unknown",
      avatar_url: row.users.avatar_url,
      isPending: false,
    }),
  );

  const pendingMembers: GroupMember[] = (pendingResult.data ?? []).map(
    (row: any) => ({
      id: row.id,
      display_name: row.nickname || formatPhoneDisplay(row.phone_number),
      avatar_url: null,
      isPending: true,
      phone_number: row.phone_number,
      invite_status: row.invite_status ?? "pending",
    }),
  );

  return [...realMembers, ...pendingMembers];
}

// ---------------------------------------------------------------------------
// Invite inbox
// ---------------------------------------------------------------------------

/** Row returned by the get_my_pending_invites RPC. */
export interface InviteRow {
  pending_member_id: string;
  group_id: string;
  group_name: string;
  invited_by_name: string;
}

/** Fetch pending invites for the current authenticated user. */
export async function fetchPendingInvites(): Promise<InviteRow[]> {
  const { data, error } = await supabase.rpc("get_my_pending_invites");
  if (error || !data) return [];
  return data as InviteRow[];
}
