import { ScrollView, View, StyleSheet } from "react-native";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Avatar, EMOJI_LIST } from "@/components/ui/Avatar";
import { colors, spacing } from "@/theme";

export default function GroupsScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text variant="h1" color="textPrimary">
        MoneySplit
      </Text>

      <Text variant="moneyLarge" color="accent">
        {"\u20B1"}1,234.56
      </Text>

      <Card>
        <Text variant="body" color="textPrimary">
          This is a card with body text. Cards use surface differentiation
          instead of borders.
        </Text>
      </Card>

      <Card elevated>
        <Text variant="bodyMedium" color="textSecondary">
          Elevated card variant for higher visual prominence.
        </Text>
      </Card>

      <View style={styles.avatarRow}>
        <Avatar emoji={EMOJI_LIST[0]} size="lg" />
        <Avatar emoji={EMOJI_LIST[1]} size="md" />
        <Avatar emoji={EMOJI_LIST[2]} size="sm" />
        <Avatar size="md" />
      </View>

      <View style={styles.buttonGroup}>
        <Button label="Primary Action" variant="primary" />
        <Button label="Secondary" variant="secondary" />
        <Button label="Ghost Button" variant="ghost" />
        <Button label="Loading..." variant="primary" loading />
        <Button label="Disabled" variant="primary" disabled />
      </View>

      <Input label="Full Name" placeholder="Enter your name" />
      <Input
        label="Phone Number"
        placeholder="+63 900 000 0000"
        keyboardType="phone-pad"
      />
      <Input
        label="With Error"
        placeholder="Type something"
        error="This field is required"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing[6],
    paddingTop: spacing[16],
    gap: spacing[6],
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
  },
  buttonGroup: {
    gap: spacing[3],
  },
});
