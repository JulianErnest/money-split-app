import React from "react";
import { View, StyleSheet } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Text } from "@/components/ui/Text";
import { colors, radius } from "@/theme";

export interface AvatarStackMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface AvatarStackProps {
  members: AvatarStackMember[];
  max?: number;
}

export function AvatarStack({ members, max = 3 }: AvatarStackProps) {
  const visible = members.slice(0, max);
  const overflow = members.length - max;

  return (
    <View style={styles.container}>
      {visible.map((member, index) => (
        <View
          key={member.id}
          style={[
            styles.wrapper,
            {
              marginLeft: index === 0 ? 0 : -8,
              zIndex: max - index,
            },
          ]}
        >
          <Avatar emoji={member.avatar_url || undefined} size="sm" />
        </View>
      ))}
      {overflow > 0 && (
        <View style={[styles.overflow, { marginLeft: -8 }]}>
          <Text variant="caption" color="textSecondary">
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  wrapper: {
    borderWidth: 2,
    borderColor: "#0D0D0D",
    borderRadius: radius.full,
  },
  overflow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0D0D0D",
  },
});
