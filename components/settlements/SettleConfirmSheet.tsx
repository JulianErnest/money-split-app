import React, { forwardRef, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { AppBottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { NumPad } from "@/components/expenses/NumPad";
import { trackSettleUp } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { formatPeso } from "@/lib/expense-utils";
import { colors, spacing, radius } from "@/theme";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const peso = "\u20B1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettleConfirmSheetProps {
  groupId: string;
  payerName: string; // debtor display name (person who owes)
  payerId: string; // debtor user id
  receiverName: string; // creditor display name (person owed money)
  receiverId: string; // creditor user id
  amountCentavos: number; // settlement amount in centavos (full balance)
  onSettled: () => void; // callback to refetch group data after success
  onClose: () => void; // callback to close the sheet
}

// ---------------------------------------------------------------------------
// useSettlementAmountInput hook
// ---------------------------------------------------------------------------

function useSettlementAmountInput(maxCentavos: number) {
  const [display, setDisplay] = useState("0");

  function toCentavos(): number {
    return Math.round(parseFloat(display) * 100);
  }

  function onDigit(digit: string) {
    setDisplay((prev) => {
      if (prev === "0" && digit !== "0") return digit;
      if (prev === "0" && digit === "0") return prev;

      const dotIndex = prev.indexOf(".");
      // Already has 2 decimal places -- reject
      if (dotIndex !== -1 && prev.length - dotIndex > 2) return prev;

      const next = prev + digit;
      // Check max (capped to balance, not global MAX_AMOUNT_CENTAVOS)
      if (Math.round(parseFloat(next) * 100) > maxCentavos) return prev;
      return next;
    });
  }

  function onDecimal() {
    setDisplay((prev) => {
      if (prev.includes(".")) return prev;
      return prev + ".";
    });
  }

  function onBackspace() {
    setDisplay((prev) => {
      if (prev.length <= 1) return "0";
      return prev.slice(0, -1);
    });
  }

  function reset() {
    setDisplay("0");
  }

  function setFull() {
    setDisplay((maxCentavos / 100).toString());
  }

  return {
    display,
    centavos: toCentavos(),
    onDigit,
    onDecimal,
    onBackspace,
    reset,
    setFull,
  };
}

// ---------------------------------------------------------------------------
// getEffectiveSettleAmount helper
// ---------------------------------------------------------------------------

function getEffectiveSettleAmount(
  enteredCentavos: number,
  balanceCentavos: number,
): { amount: number; isFullSettle: boolean } {
  if (enteredCentavos === 0) return { amount: 0, isFullSettle: false };
  const remainder = balanceCentavos - enteredCentavos;
  // Dust rule: if remainder < P1.00, force full settlement
  if (remainder > 0 && remainder < 100) {
    return { amount: balanceCentavos, isFullSettle: true };
  }
  return {
    amount: enteredCentavos,
    isFullSettle: enteredCentavos >= balanceCentavos,
  };
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
    const [editing, setEditing] = useState(false);
    const { showToast } = useToast();
    const amountInput = useSettlementAmountInput(amountCentavos);

    const snapPoints = useMemo(
      () => [editing ? "75%" : "35%"],
      [editing],
    );

    const { amount: effectiveAmount, isFullSettle } = getEffectiveSettleAmount(
      amountInput.centavos,
      amountCentavos,
    );

    // ------------------------------------------------------------------
    // Confirm handler
    // ------------------------------------------------------------------

    async function handleConfirmSettle(settleAmount: number) {
      if (loading) return;

      const { amount: finalAmount, isFullSettle: isFull } =
        getEffectiveSettleAmount(settleAmount, amountCentavos);

      if (finalAmount < 100) return; // P1.00 minimum

      setLoading(true);

      try {
        const { error } = await supabase.rpc("record_settlement", {
          p_group_id: groupId,
          p_paid_by: payerId,
          p_paid_to: receiverId,
          p_amount: finalAmount / 100, // convert centavos to pesos for DB
        });

        if (error) {
          showToast({ message: error.message, type: "error" });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }

        trackSettleUp({
          groupId,
          amount: finalAmount / 100,
          isPartial: !isFull,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (isFull) {
          showToast({
            message: `Fully settled with ${receiverName}`,
            type: "success",
          });
        } else {
          showToast({
            message: `Settled ${peso}${formatPeso(finalAmount)} to ${receiverName}`,
            type: "success",
          });
        }

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

    // ------------------------------------------------------------------
    // Confirm button label & disabled state
    // ------------------------------------------------------------------

    function getConfirmLabel(): string {
      if (loading) return "Settling...";

      if (editing) {
        if (effectiveAmount === 0 || effectiveAmount < 100) return "Settle";
        if (isFullSettle)
          return `Settle ${peso}${formatPeso(effectiveAmount)} (Full)`;
        return `Settle ${peso}${formatPeso(effectiveAmount)}`;
      }

      return `Settle ${peso}${formatPeso(amountCentavos)}`;
    }

    const confirmDisabled = editing
      ? effectiveAmount < 100 || loading
      : loading;

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------

    return (
      <AppBottomSheet ref={ref} snapPoints={snapPoints} onDismiss={onClose}>
        <View style={styles.content}>
          <Text variant="h3" color="textPrimary" style={styles.header}>
            Settle Up
          </Text>

          <Text variant="body" color="textSecondary" style={styles.description}>
            {payerName} pays {receiverName}
          </Text>

          {!editing ? (
            <>
              {/* Display mode: tap amount to enter edit mode */}
              <Pressable
                onPress={() => {
                  amountInput.reset();
                  setEditing(true);
                }}
              >
                <Text variant="h1" color="accent" style={styles.amount}>
                  {peso}
                  {formatPeso(amountCentavos)}
                </Text>
              </Pressable>

              <Button
                label={getConfirmLabel()}
                variant="primary"
                onPress={() => handleConfirmSettle(amountCentavos)}
                loading={loading}
                disabled={confirmDisabled}
                style={styles.confirmButton}
              />

              <Pressable onPress={onClose} style={styles.cancelButton}>
                <Text variant="body" color="textTertiary">
                  Cancel
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* Edit mode: NumPad with validation */}
              <Text
                variant="body"
                color="textSecondary"
                style={styles.balanceRef}
              >
                Balance: {peso}
                {formatPeso(amountCentavos)}
              </Text>

              <Text variant="h1" color="accent" style={styles.amount}>
                {peso}
                {amountInput.display === "0"
                  ? "0.00"
                  : amountInput.display}
              </Text>

              {/* Remaining balance preview */}
              {!isFullSettle && amountInput.centavos > 0 && (
                <Text
                  variant="body"
                  color="textSecondary"
                  style={styles.remainingPreview}
                >
                  Remaining: {peso}
                  {formatPeso(amountCentavos - effectiveAmount)}
                </Text>
              )}

              {/* Full amount button */}
              <Pressable
                onPress={() => amountInput.setFull()}
                style={styles.fullAmountButton}
              >
                <Text
                  variant="body"
                  color="textPrimary"
                  style={styles.fullAmountButtonText}
                >
                  Full amount ({peso}
                  {formatPeso(amountCentavos)})
                </Text>
              </Pressable>

              <NumPad
                onDigit={amountInput.onDigit}
                onDecimal={amountInput.onDecimal}
                onBackspace={amountInput.onBackspace}
              />

              <Button
                label={getConfirmLabel()}
                variant="primary"
                onPress={() => handleConfirmSettle(amountInput.centavos)}
                loading={loading}
                disabled={confirmDisabled}
                style={styles.confirmButton}
              />

              <Pressable
                onPress={() => {
                  setEditing(false);
                  amountInput.reset();
                }}
                style={styles.cancelButton}
              >
                <Text variant="body" color="textTertiary">
                  Cancel
                </Text>
              </Pressable>
            </>
          )}
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
  balanceRef: {
    textAlign: "center",
  },
  remainingPreview: {
    textAlign: "center",
  },
  fullAmountButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fullAmountButtonText: {
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
