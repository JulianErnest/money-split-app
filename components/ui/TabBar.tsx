import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors, fontFamily, fontSize, spacing } from "@/theme";
import { Text } from "./Text";

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  index: { active: "people", inactive: "people-outline" },
  add: { active: "add", inactive: "add" },
  profile: { active: "person", inactive: "person-outline" },
};

const TAB_LABELS: Record<string, string> = {
  index: "Groups",
  add: "Add",
  profile: "Profile",
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: insets.bottom || spacing[2] },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const isCenter = index === 1;
        const iconSet = TAB_ICONS[route.name] || {
          active: "help",
          inactive: "help-outline",
        };
        const iconName = isFocused ? iconSet.active : iconSet.inactive;
        const label = TAB_LABELS[route.name] || route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (isCenter) {
          return (
            <View key={route.key} style={styles.centerContainer}>
              <Pressable
                onPress={onPress}
                style={({ pressed }) => [
                  styles.fab,
                  pressed && styles.fabPressed,
                ]}
              >
                <Ionicons
                  name="add"
                  size={28}
                  color={colors.textInverse}
                />
              </Pressable>
            </View>
          );
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tab}
          >
            <Ionicons
              name={iconName as keyof typeof Ionicons.glyphMap}
              size={24}
              color={isFocused ? colors.tabActive : colors.tabInactive}
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color: isFocused ? colors.tabActive : colors.tabInactive,
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: colors.tabBarBorder,
    paddingTop: spacing[2],
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tabLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.8,
  },
});
