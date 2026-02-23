import React, { forwardRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { AppBottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { trackSettleUp } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { formatPeso } from "@/lib/expense-utils";
import { colors, spacing } from "@/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettleConfirmSheetProps {
  groupId: string;
  payerName: string; // debtor display name (person who owes)
  payerId: string; // debtor user id
  receiverName: string; // creditor display name (person owed money)
  receiverId: string; // creditor user id
  amountCentavos: number; // settlement amount in centavos
  onSettled: () => void; // callback to refetch group data after success
  onClose: () => void; // callback to close the sheet
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SettleConfirmSheet = forwardRef<BottomSheetModal, SettleConfirmSheetProps>(
  function SettleConfirmSheet(
    {
      groupId,
      payerName,
      payerId,
      receiverName,
      receiverId,
      amountCentavos,
      onSettled,
      onClose,
    },
    ref,
  ) {
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    async function handleConfirmSettle() {
      if (loading) return;
      setLoading(true);

      try {
        const { error } = await supabase.rpc("record_settlement", {
          p_group_id: groupId,
          p_paid_by: payerId,
          p_paid_to: receiverId,
          p_amount: amountCentavos / 100, // convert centavos to pesos for DB
        });

        if (error) {
          showToast({ message: error.message, type: "error" });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }

        trackSettleUp({ groupId, amount: amountCentavos / 100 });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast({ message: "Settled!", type: "success" });
        onSettled();
        onClose();
      } catch {
        showToast({
          message: "Something went wrong. Please try again.",
          type: "error",
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setLoading(false);
      }
    }

    return (
      <AppBottomSheet ref={ref} snapPoints={["35%"]} onDismiss={onClose}>
        <View style={styles.content}>
          <Text variant="h3" color="textPrimary" style={styles.header}>
            Settle Up
          </Text>

          <Text variant="body" color="textSecondary" style={styles.description}>
            {payerName} pays {receiverName}
          </Text>

          <Text variant="h1" color="accent" style={styles.amount}>
            {"\u20B1"}
            {formatPeso(amountCentavos)}
          </Text>

          <Button
            label={loading ? "Settling..." : "Confirm Settlement"}
            variant="primary"
            onPress={handleConfirmSettle}
            loading={loading}
            style={styles.confirmButton}
          />

          <Pressable onPress={onClose} style={styles.cancelButton}>
            <Text variant="body" color="textTertiary">
              Cancel
            </Text>
          </Pressable>
        </View>
      </AppBottomSheet>
    );
  },
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
    alignItems: "center",
    gap: spacing[3],
  },
  header: {
    textAlign: "center",
  },
  description: {
    textAlign: "center",
  },
  amount: {
    textAlign: "center",
  },
  confirmButton: {
    width: "100%",
    marginTop: spacing[2],
  },
  cancelButton: {
    paddingVertical: spacing[2],
  },
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { SettleConfirmSheet };
export type { SettleConfirmSheetProps };
