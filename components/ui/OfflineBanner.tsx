import { Text, StyleSheet } from "react-native";
import Animated, { SlideInUp, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetwork } from "@/lib/network-context";
import { colors, spacing } from "@/theme";

export function OfflineBanner() {
  const { isOnline } = useNetwork();
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <Animated.View
      entering={SlideInUp}
      exiting={SlideOutUp}
      style={[
        styles.container,
        { paddingTop: insets.top + spacing[1] },
      ]}
    >
      <Text style={styles.text}>You're offline</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.warning,
    paddingBottom: spacing[2],
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  text: {
    color: colors.textInverse,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
  },
});
