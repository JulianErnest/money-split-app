import React from "react";
import { View, Pressable, ScrollView, StyleSheet } from "react-native";
import { Text } from "@/components/ui/Text";
import { Avatar } from "@/components/ui/Avatar";
import { colors, spacing, radius } from "@/theme";

interface Member {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface PayerSelectorProps {
  members: Member[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function PayerSelector({
  members,
  selectedId,
  onSelect,
}: PayerSelectorProps) {
  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {members.map((member) => {
        const isSelected = member.id === selectedId;
        return (
          <Pressable
            key={member.id}
            style={[styles.row, isSelected && styles.rowSelected]}
            onPress={() => onSelect(member.id)}
          >
            <Avatar emoji={member.avatar_url || undefined} size="sm" />
            <Text
              variant="bodyMedium"
              color="textPrimary"
              style={styles.name}
              numberOfLines={1}
            >
              {member.display_name}
            </Text>
            <View
              style={[styles.radio, isSelected && styles.radioSelected]}
            >
              {isSelected && <View style={styles.radioInner} />}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  rowSelected: {
    backgroundColor: colors.accentSubtle,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  name: {
    flex: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: colors.accent,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
});
