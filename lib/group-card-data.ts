/**
 * Group card enrichment data layer.
 *
 * Provides types and fetch function for the get_group_card_data RPC,
 * which returns member display info and last activity date per group.
 */

import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GroupCardMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface GroupCardData {
  group_id: string;
  member_count: number;
  members: GroupCardMember[];
  last_activity_at: string | null;
}

// ---------------------------------------------------------------------------
// Raw RPC row shape (arrays from Postgres)
// ---------------------------------------------------------------------------

interface RawGroupCardRow {
  group_id: string;
  member_count: number;
  member_ids: string[];
  member_names: string[];
  member_avatars: (string | null)[];
  last_activity_at: string | null;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/**
 * Fetch enriched group card data for all of the current user's groups.
 *
 * Calls the `get_group_card_data` RPC which returns member display info
 * and last activity per group. Returns an empty array on error.
 */
export async function fetchGroupCardData(): Promise<GroupCardData[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("get_group_card_data");

  if (error || !data) return [];

  return (data as RawGroupCardRow[]).map((row) => ({
    group_id: row.group_id,
    member_count: row.member_count,
    members: row.member_ids.map((id, i) => ({
      id,
      display_name: row.member_names[i] ?? "Unknown",
      avatar_url: row.member_avatars[i] ?? null,
    })),
    last_activity_at: row.last_activity_at,
  }));
}
