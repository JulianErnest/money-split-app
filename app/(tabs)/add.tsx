import { View, Text, StyleSheet } from "react-native";

export default function AddExpenseScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Add Expense</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
