import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { isValidPHPhone } from "@/lib/group-members";
import { colors, fontFamily, fontSize, radius, spacing } from "@/theme";

interface AddMemberModalProps {
  visible: boolean;
  groupId: string;
  onClose: () => void;
  onAdded: () => void;
}

export function AddMemberModal({
  visible,
  groupId,
  onClose,
  onAdded,
}: AddMemberModalProps) {
  const [rawDigits, setRawDigits] = useState("");
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

  function handleClose() {
    setRawDigits("");
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
      handleClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const isValid = isValidPHPhone(rawDigits);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            {/* Drag handle */}
            <View style={styles.handle} />

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
                <TextInput
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
                onPress={handleClose}
                style={styles.cancelButton}
              />
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  keyboardView: {
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.backgroundElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[10],
    paddingTop: spacing[3],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface,
    alignSelf: "center",
    marginBottom: spacing[4],
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
