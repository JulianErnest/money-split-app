import React, { forwardRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import {
  AppBottomSheet,
  BottomSheetTextInput,
} from "@/components/ui/BottomSheet";
import { supabase } from "@/lib/supabase";
import { isValidPHPhone } from "@/lib/group-members";
import { colors, fontFamily, fontSize, spacing } from "@/theme";

interface AddMemberSheetProps {
  groupId: string;
  onClose: () => void;
  onAdded: () => void;
}

const AddMemberSheet = forwardRef<BottomSheetModal, AddMemberSheetProps>(
  function AddMemberSheet({ groupId, onClose, onAdded }, ref) {
    const [rawDigits, setRawDigits] = useState("");
    const [nickname, setNickname] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    function formatDisplay(digits: string): string {
      if (digits.length <= 3) return digits;
      if (digits.length <= 6)
        return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }

    function handleChangeText(text: string) {
      const digits = text.replace(/\D/g, "").slice(0, 10);
      setRawDigits(digits);
      if (error) setError("");
    }

    function handleDismiss() {
      setRawDigits("");
      setNickname("");
      setError("");
      setLoading(false);
      onClose();
    }

    async function handleSubmit() {
      if (!isValidPHPhone(rawDigits) || loading) return;

      setLoading(true);
      setError("");

      try {
        const { error: rpcError } = await supabase.rpc("add_pending_member", {
          p_group_id: groupId,
          p_phone_number: `+63${rawDigits}`,
          p_nickname: nickname.trim() || null,
        });

        if (rpcError) {
          const msg = rpcError.message.toLowerCase();
          if (msg.includes("already a member")) {
            setError("This person is already a member of this group.");
          } else if (msg.includes("already pending")) {
            setError("This phone number is already pending in this group.");
          } else {
            setError(rpcError.message);
          }
          return;
        }

        onAdded();
        handleDismiss();
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    const isValid = isValidPHPhone(rawDigits);

    return (
      <AppBottomSheet
        ref={ref}
        snapPoints={["60%"]}
        onDismiss={handleDismiss}
      >
        <View style={styles.sheet}>
          <Text variant="h2" color="textPrimary" style={styles.title}>
            Add Member by Phone
          </Text>

          <Text
            variant="body"
            color="textSecondary"
            style={styles.subtitle}
          >
            Enter a Philippine mobile number. If they have not signed up yet,
            they will be added as a pending member.
          </Text>

          {/* Phone input */}
          <View style={styles.inputSection}>
            <Text variant="label" color="textTertiary" style={styles.label}>
              Phone number
            </Text>
            <View style={styles.phoneRow}>
              <Text style={styles.prefix}>+63</Text>
              <BottomSheetTextInput
                style={styles.phoneInput}
                value={formatDisplay(rawDigits)}
                onChangeText={handleChangeText}
                keyboardType="number-pad"
                maxLength={12}
                placeholder="9XX XXX XXXX"
                placeholderTextColor={colors.inputPlaceholder}
                selectionColor={colors.accent}
                cursorColor={colors.accent}
                autoFocus
              />
            </View>

            {error ? (
              <Text variant="caption" color="error" style={styles.error}>
                {error}
              </Text>
            ) : null}
          </View>

          {/* Nickname input */}
          <View style={styles.inputSection}>
            <Text variant="label" color="textTertiary" style={styles.label}>
              Nickname (optional)
            </Text>
            <BottomSheetTextInput
              style={styles.nicknameInput}
              value={nickname}
              onChangeText={setNickname}
              maxLength={30}
              placeholder="e.g. Mom, Dave, Landlord"
              placeholderTextColor={colors.inputPlaceholder}
              selectionColor={colors.accent}
              cursorColor={colors.accent}
            />
            <Text
              variant="caption"
              color="textTertiary"
              style={styles.hint}
            >
              A temporary name shown until they sign up.
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              label={loading ? "Adding..." : "Add Member"}
              variant="primary"
              onPress={handleSubmit}
              disabled={!isValid}
              loading={loading}
              style={styles.submitButton}
            />
            <Button
              label="Cancel"
              variant="ghost"
              onPress={handleDismiss}
              style={styles.cancelButton}
            />
          </View>
        </View>
      </AppBottomSheet>
    );
  },
);

// Keep backward-compatible named export
export { AddMemberSheet, AddMemberSheet as AddMemberModal };

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
  },
  title: {
    marginBottom: spacing[2],
  },
  subtitle: {
    marginBottom: spacing[6],
  },
  inputSection: {
    marginBottom: spacing[6],
  },
  label: {
    marginBottom: spacing[2],
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
  },
  prefix: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontFamily: fontFamily.semiBold,
    marginRight: spacing[2],
    paddingVertical: spacing[3],
  },
  phoneInput: {
    flex: 1,
    color: colors.inputText,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.lg,
    paddingVertical: spacing[3],
  },
  error: {
    marginTop: spacing[2],
  },
  nicknameInput: {
    color: colors.inputText,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.lg,
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
  },
  hint: {
    marginTop: spacing[1],
  },
  actions: {
    gap: spacing[2],
  },
  submitButton: {
    width: "100%",
  },
  cancelButton: {
    width: "100%",
  },
});
