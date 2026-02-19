import { useEffect, useRef } from "react";
import { useNetwork } from "@/lib/network-context";
import { getAll, remove, updateStatus, QueueItem } from "@/lib/offline-queue";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// Sync-complete listener registry
// ---------------------------------------------------------------------------

/** Screens can subscribe to be notified when a sync flush finishes. */
export const syncCompleteListeners = new Set<() => void>();

function notifySyncComplete() {
  syncCompleteListeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Hook: useSyncOnReconnect
// ---------------------------------------------------------------------------

/**
 * Watches network status. When the device transitions from offline to online,
 * flushes the offline queue once. On failure, shows an error toast with a
 * Retry button. No silent auto-retry loop -- user controls retry.
 */
export function useSyncOnReconnect(onSyncComplete?: () => void) {
  const { isOnline } = useNetwork();
  const { showToast } = useToast();
  const prevOnlineRef = useRef(isOnline);
  const flushingRef = useRef(false);

  // Replay a single queued action against Supabase
  async function replayItem(
    item: QueueItem,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (item.action_type === "create_group") {
        const { error } = await supabase.rpc("create_group", {
          group_name: item.payload.group_name,
        });
        if (error) return { success: false, error: error.message };
        return { success: true };
      }

      if (item.action_type === "add_expense") {
        const { error } = await supabase.rpc(
          "create_expense",
          item.payload.rpcParams,
        );
        if (error) return { success: false, error: error.message };
        return { success: true };
      }

      // Unknown action type -- mark failed so it doesn't block queue
      return { success: false, error: `Unknown action: ${item.action_type}` };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Network error" };
    }
  }

  // Retry a single failed item (called from toast Retry button)
  async function retrySingleItem(item: QueueItem) {
    const result = await replayItem(item);
    if (result.success) {
      remove(item.id);
      showToast({ message: "Synced successfully!", type: "success" });
      onSyncComplete?.();
      notifySyncComplete();
    } else {
      updateStatus(item.id, "failed");
      showToast({
        message: `Sync failed: ${result.error}`,
        type: "error",
        actionLabel: "Retry",
        onAction: () => retrySingleItem(item),
      });
    }
  }

  // Flush all pending items in the queue
  async function flushQueue() {
    if (flushingRef.current) return;
    flushingRef.current = true;

    try {
      const items = getAll();
      if (items.length === 0) {
        onSyncComplete?.();
        notifySyncComplete();
        return;
      }

      for (const item of items) {
        const result = await replayItem(item);
        if (result.success) {
          remove(item.id);
        } else {
          updateStatus(item.id, "failed");
          const description =
            item.payload.group_name ??
            item.payload.rpcParams?.p_description ??
            item.action_type;
          showToast({
            message: `Sync failed for "${description}". Tap to retry.`,
            type: "error",
            actionLabel: "Retry",
            onAction: () => retrySingleItem(item),
          });
        }
      }

      onSyncComplete?.();
      notifySyncComplete();
    } finally {
      flushingRef.current = false;
    }
  }

  useEffect(() => {
    // Detect offline -> online transition
    if (prevOnlineRef.current === false && isOnline === true) {
      flushQueue();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);
}
