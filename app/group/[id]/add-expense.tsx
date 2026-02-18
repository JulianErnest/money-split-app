import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import PagerView from "react-native-pager-view";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { NumPad } from "@/components/expenses/NumPad";
import { AmountDisplay } from "@/components/expenses/AmountDisplay";
import { PayerSelector } from "@/components/expenses/PayerSelector";
import { MemberSelector } from "@/components/expenses/MemberSelector";
import { SplitTypeToggle } from "@/components/expenses/SplitTypeToggle";
import { CustomSplitRow } from "@/components/expenses/CustomSplitRow";
import { DotIndicator } from "@/components/expenses/DotIndicator";
import {
  calculateEqualSplit,
  customSplitRemaining,
  formatPeso,
  MAX_AMOUNT_CENTAVOS,
} from "@/lib/expense-utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { GroupMember, fetchAllMembers } from "@/lib/group-members";
import { colors, spacing, radius, fontFamily, fontSize } from "@/theme";

// ---------------------------------------------------------------------------
// Amount Input Hook
// ---------------------------------------------------------------------------

function useAmountInput() {
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
      // Check max (999,999.00 pesos)
      if (parseFloat(next) * 100 > MAX_AMOUNT_CENTAVOS) return prev;
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

  return { display, centavos: toCentavos(), onDigit, onDecimal, onBackspace };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AddExpenseScreen() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const pagerRef = useRef<PagerView>(null);

  // Data loading state
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Wizard state
  const [currentPage, setCurrentPage] = useState(0);
  const { display, centavos, onDigit, onDecimal, onBackspace } =
    useAmountInput();
  const [description, setDescription] = useState("");
  const [payerId, setPayerId] = useState<string>("");
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);

  // -----------------------------------------------------------------------
  // Fetch group members
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!groupId) return;
    fetchMembers();
  }, [groupId]);

  async function fetchMembers() {
    try {
      const memberList = await fetchAllMembers(groupId!);

      setMembers(memberList);
      // Default payer to current user
      if (user?.id) {
        setPayerId(user.id);
      }
      // Default all members selected for equal split (includes pending)
      setSelectedMemberIds(memberList.map((m) => m.id));
    } catch {
      Alert.alert("Error", "Failed to load group members");
    } finally {
      setLoading(false);
    }
  }

  // Derived member lists: real members for payer, all members for splits
  const realMembers = members.filter((m) => !m.isPending);
  const allMembers = members;

  // -----------------------------------------------------------------------
  // Member toggle for equal split
  // -----------------------------------------------------------------------

  function handleToggleMember(memberId: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  }

  // -----------------------------------------------------------------------
  // Custom amount change
  // -----------------------------------------------------------------------

  function handleCustomAmountChange(memberId: string, amountCentavos: number) {
    setCustomAmounts((prev) => ({
      ...prev,
      [memberId]: amountCentavos,
    }));
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  const canProceedStep1 = centavos > 0;
  const canProceedStep2 = payerId !== "";

  const canSubmit =
    centavos > 0 &&
    description.trim().length > 0 &&
    payerId !== "" &&
    (splitType === "equal"
      ? selectedMemberIds.length > 0
      : customSplitRemaining(centavos, customAmounts) === 0);

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    try {
      // Build splits -- pending members use pending_member_id instead of user_id
      function buildSplitEntry(memberId: string, amountPesos: number) {
        const member = members.find((m) => m.id === memberId);
        if (member?.isPending) {
          return { pending_member_id: memberId, amount: amountPesos };
        }
        return { user_id: memberId, amount: amountPesos };
      }

      let splits: Array<{ user_id?: string; pending_member_id?: string; amount: number }>;
      if (splitType === "equal") {
        const equalSplits = calculateEqualSplit(centavos, selectedMemberIds);
        splits = Object.entries(equalSplits).map(([id, amt]) =>
          buildSplitEntry(id, amt / 100),
        );
      } else {
        splits = Object.entries(customAmounts)
          .filter(([, amt]) => amt > 0)
          .map(([id, amt]) => buildSplitEntry(id, amt / 100));
      }

      const { error } = await supabase.rpc("create_expense", {
        p_group_id: groupId!,
        p_description: description.trim(),
        p_amount: centavos / 100,
        p_paid_by: payerId,
        p_split_type: splitType,
        p_splits: splits as unknown as import("@/lib/database.types").Json,
      });

      if (error) {
        Alert.alert("Error", error.message || "Failed to create expense");
        setSubmitting(false);
        return;
      }

      router.back();
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------

  function handleNext() {
    if (currentPage < 2) {
      pagerRef.current?.setPage(currentPage + 1);
    }
  }

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // -----------------------------------------------------------------------
  // Derived values for step 3
  // -----------------------------------------------------------------------

  const remaining =
    splitType === "custom" ? customSplitRemaining(centavos, customAmounts) : 0;

  const perPersonAmount =
    splitType === "equal" && selectedMemberIds.length > 0
      ? Math.floor(centavos / selectedMemberIds.length)
      : 0;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <Text variant="h2" color="textSecondary">
            {"\u2715"}
          </Text>
        </Pressable>
        <Text variant="h3" color="textPrimary" style={styles.headerTitle}>
          Add Expense
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Pager */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
      >
        {/* Step 1: Amount + Description */}
        <View key="1" style={styles.page}>
          <AmountDisplay display={display} isEmpty={centavos === 0} />
          <View style={styles.descriptionContainer}>
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              placeholder="What's this for?"
              placeholderTextColor={colors.inputPlaceholder}
              selectionColor={colors.accent}
              maxLength={100}
            />
          </View>
          <View style={styles.numPadWrapper}>
            <NumPad
              onDigit={onDigit}
              onDecimal={onDecimal}
              onBackspace={onBackspace}
            />
          </View>
        </View>

        {/* Step 2: Payer Selection */}
        <View key="2" style={styles.page}>
          <Text
            variant="h2"
            color="textPrimary"
            style={styles.stepTitle}
          >
            Who paid?
          </Text>
          <PayerSelector
            members={realMembers}
            selectedId={payerId}
            onSelect={setPayerId}
          />
        </View>

        {/* Step 3: Split Configuration */}
        <View key="3" style={styles.page}>
          <Text
            variant="h2"
            color="textPrimary"
            style={styles.stepTitle}
          >
            Split between
          </Text>
          <View style={styles.splitToggleContainer}>
            <SplitTypeToggle value={splitType} onChange={setSplitType} />
          </View>

          {splitType === "equal" ? (
            <>
              <MemberSelector
                members={allMembers}
                selectedIds={selectedMemberIds}
                onToggle={handleToggleMember}
              />
              {selectedMemberIds.length > 0 && centavos > 0 && (
                <View style={styles.splitInfo}>
                  <Text variant="bodyMedium" color="accent">
                    Each person pays: {"\u20B1"} {formatPeso(perPersonAmount)}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.remainingContainer}>
                <Text
                  variant="bodyMedium"
                  color={remaining === 0 ? "accent" : "error"}
                >
                  Remaining: {"\u20B1"} {formatPeso(remaining)}
                </Text>
              </View>
              <View style={styles.customSplitList}>
                {allMembers.map((member) => (
                  <CustomSplitRow
                    key={member.id}
                    member={member}
                    amountCentavos={customAmounts[member.id] || 0}
                    onAmountChange={(amt) =>
                      handleCustomAmountChange(member.id, amt)
                    }
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </PagerView>

      {/* Bottom: Dot indicator + action button */}
      <View style={styles.bottomBar}>
        <DotIndicator current={currentPage} total={3} />
        {currentPage < 2 ? (
          <Button
            label="Next"
            variant="primary"
            onPress={handleNext}
            disabled={
              (currentPage === 0 && !canProceedStep1) ||
              (currentPage === 1 && !canProceedStep2)
            }
            style={styles.actionButton}
          />
        ) : (
          <Button
            label="Add Expense"
            variant="primary"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
            style={styles.actionButton}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 44,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  stepTitle: {
    textAlign: "center",
    paddingVertical: spacing[4],
  },
  descriptionContainer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
  },
  descriptionInput: {
    color: colors.inputText,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
    textAlign: "center",
  },
  numPadWrapper: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing[4],
  },
  splitToggleContainer: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
  },
  splitInfo: {
    alignItems: "center",
    paddingVertical: spacing[3],
  },
  remainingContainer: {
    alignItems: "center",
    paddingBottom: spacing[3],
  },
  customSplitList: {
    flex: 1,
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  bottomBar: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
  },
  actionButton: {
    width: "100%",
  },
});
