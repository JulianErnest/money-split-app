/**
 * Activity feed data layer.
 *
 * Provides the ActivityItem type, fetch function for the get_recent_activity
 * RPC, relative timestamp formatting, and day label grouping utilities.
 */

import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityItem {
  id: string;
  type: "expense" | "settlement";
  description: string;
  /** Amount in pesos (numeric from DB). Convert to centavos for formatPeso. */
  amount: number;
  payer_name: string;
  payer_id: string;
  group_name: string;
  group_id: string;
  expense_id: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/**
 * Fetch recent activity across all of the current user's groups.
 *
 * Calls the `get_recent_activity` RPC which returns expenses and settlements
 * merged chronologically. Returns an empty array on error.
 */
export async function fetchRecentActivity(
  limit: number = 5,
  offset: number = 0,
): Promise<ActivityItem[]> {
  const { data, error } = await supabase.rpc("get_recent_activity", {
    p_limit: limit,
    p_offset: offset,
  });

  if (error || !data) return [];
  return data as ActivityItem[];
}

// ---------------------------------------------------------------------------
// Timestamp formatting
// ---------------------------------------------------------------------------

/**
 * Convert an ISO timestamp to a relative time string.
 *
 * Examples: "Just now", "5m ago", "2h ago", "Yesterday", "3d ago", "Feb 20"
 */
export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Convert an ISO timestamp to a day group label for section headers.
 *
 * Returns "Today", "Yesterday", or a short date like "Feb 20".
 * Uses calendar day comparison (not 24-hour windows).
 */
export function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const itemDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  if (itemDay.getTime() === today.getTime()) return "Today";
  if (itemDay.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
