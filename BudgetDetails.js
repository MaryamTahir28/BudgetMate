//BudgetDetails.js
import { useLocalSearchParams } from "expo-router";
import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import {
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useAppContext } from "../../AppContext";
import { auth, database } from "../../firebaseConfig";

export default function BudgetDetails() {
  const { id, category } = useLocalSearchParams();
  const { isDarkMode, formatAmount, themeColors } = useAppContext();
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    const userId = auth.currentUser?.uid || "guest";
    const expensesRef = ref(database, `users/${userId}/expenses`);
    onValue(expensesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const filtered = Object.values(data).filter(
          (exp) => exp.category && exp.category.trim().toLowerCase() === category.trim().toLowerCase() &&
                   exp.budgetIds && Array.isArray(exp.budgetIds) && exp.budgetIds.includes(id)
        );
        setExpenses(filtered);
      } else {
        setExpenses([]);
      }
    });
  }, [category, id]);

  const dynamicStyles = getStyles(isDarkMode, themeColors);

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <Text style={dynamicStyles.title}>{category} Expenses</Text>
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={true}
        renderItem={({ item }) => (
          <View style={dynamicStyles.card}>
            <Text style={dynamicStyles.cardTitle}>{item.note || "No Note"}</Text>
            <Text style={dynamicStyles.cardText}>Amount: {formatAmount(item.amount)}</Text>
            <Text style={dynamicStyles.cardText}>Date: {item.date}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const getStyles = (isDarkMode, themeColors) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: isDarkMode ? '#121212' : '#F9F9F9',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: themeColors.primary,
    fontFamily: 'serif',
  },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: themeColors.primary,
    marginVertical: 6,
    borderRadius: 8,
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: themeColors.primary,
    fontFamily: 'serif',
    marginBottom: 4
  },
  cardText: {
    fontSize: 14,
    color: isDarkMode ? '#fff' : themeColors.secondary,
    fontFamily: 'serif',
    marginBottom: 2
  }
});
