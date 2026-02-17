import { colors } from "@/theme";
import React from "react";
import { StyleSheet, Text as RNText, View } from "react-native";

export const EMOJI_LIST = [
  "\u{1F60E}", // sunglasses
  "\u{1F525}", // fire
  "\u{1F680}", // rocket
  "\u{1F308}", // rainbow
  "\u{1F381}", // gift
  "\u{1F3B5}", // music note
  "\u{1F4A1}", // lightbulb
  "\u{1F331}", // seedling
  "\u{2B50}", // star
  "\u{1F436}", // dog
  "\u{1F431}", // cat
  "\u{1F98B}", // butterfly
  "\u{1F34A}", // orange
  "\u{1F370}", // cake
  "\u{1F3AE}", // game controller
  "\u{26BD}", // soccer
  "\u{1F3A8}", // art palette
  "\u{1F4DA}", // books
  "\u{1F30E}", // globe
  "\u{1F48E}", // gem
] as const;

type AvatarSize = "sm" | "md" | "lg" | "xl";

const sizeMap: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 120,
};

const fontSizeMap: Record<AvatarSize, number> = {
  sm: 14,
  md: 18,
  lg: 28,
  xl: 56,
};

interface AvatarProps {
  emoji?: string;
  size?: AvatarSize;
  backgroundColor?: string;
}

export function Avatar({
  emoji,
  size = "md",
  backgroundColor = colors.surface,
}: AvatarProps) {
  const dimension = sizeMap[size];
  const emojiSize = fontSizeMap[size];
  const displayEmoji = emoji || "\u{1F60E}";

  return (
    <View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor,
        },
      ]}
    >
      <RNText style={{ fontSize: emojiSize, lineHeight: emojiSize * 1.15 }}>
        {displayEmoji}
      </RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
