//BudgetScreen.js
import { onValue, push, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { Button, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { database } from "../../firebaseConfig";

// const db = getDatabase(database);

export default function BudgetScreen() {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [budgets, setBudgets] = useState([]);

  // Load budgets
  useEffect(() => {
    const budgetsRef = ref(database, "budgets/");
    onValue(budgetsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedBudgets = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setBudgets(loadedBudgets);
      } else {
        setBudgets([]);
      }
    });
  }, []);

  // Add budget
  const addBudget = () => {
    if (!category || !amount) return;
    push(ref(database, "budgets/"), {
      category,
      amount: parseFloat(amount),
      used: 0,
    });
    setCategory("");
    setAmount("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Manage Budgets</Text>

      <TextInput
        style={styles.input}
        placeholder="Category (e.g. Shopping, Food)"
        value={category}
        onChangeText={setCategory}
      />
      <TextInput
        style={styles.input}
        placeholder="Budget Amount"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />
      <Button title="Add Budget" onPress={addBudget} />
      <FlatList
        data={budgets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.category}</Text>
            <Text>Total: {item.amount}</Text>
            <Text>Used: {item.used || 0}</Text>
            <Text>Remaining: {item.amount - (item.used || 0)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  header: { fontSize: 22, fontWeight: "bold", marginBottom: 15 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginVertical: 5,
    borderRadius: 5,
  },
  card: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#ddd",
    marginVertical: 8,
    borderRadius: 8,
  },
  title: { fontWeight: "bold", fontSize: 18 },
});
