import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from "expo-router";
import { onValue, push, ref, remove } from "firebase/database";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useAppContext } from "../../AppContext";
import { auth, database } from "../../firebaseConfig";

export default function BudgetScreen() {

  const router = useRouter();
  const { isDarkMode, formatAmount, convertToPKR, themeColors } = useAppContext();
  const { startDate, endDate } = useLocalSearchParams();

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [budgets, setBudgets] = useState([]);
  const [filteredBudgets, setFilteredBudgets] = useState([]);

  // Check if adding budget is disabled for previous months
  const isDisabled = endDate ? new Date(endDate) < new Date() : false;

  // Load budgets from Firebase
  useEffect(() => {
    const userId = auth.currentUser?.uid || "guest";
    const budgetsRef = ref(database, `users/${userId}/budgets`);
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

  // Filter budgets based on the selected date range
  // This updates whenever the master list (budgets) or the date params change
  useEffect(() => {
    const filtered = budgets.filter((budget) => isBudgetInSelectedRange(budget));
    setFilteredBudgets(filtered);
  }, [budgets, startDate, endDate]);

  // Add budget
  const addBudget = () => {
    if (!category || !amount) return;
    const userId = auth.currentUser?.uid || "guest";
    const amountInPKR = convertToPKR(amount);
    push(ref(database, `users/${userId}/budgets`), {
      category,
      amount: amountInPKR,
      used: 0,
      createdAt: new Date().toISOString(),
    });
    setCategory("");
    setAmount("");
  };

  // Handle budget deletion
  const handleDelete = (id) => {
    Alert.alert(
      "Delete Budget",
      "Are you sure you want to delete this budget?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: () => {
            const userId = auth.currentUser?.uid || "guest";
            remove(ref(database, `users/${userId}/budgets/${id}`));
          }
        }
      ]
    );
  };

  // Helper function to check if a budget is in the selected date range
  const isBudgetInSelectedRange = (budget) => {
    if (!budget.createdAt) return false;
    const createdDate = new Date(budget.createdAt);
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      // Set time to ensure full day coverage
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      createdDate.setHours(0, 0, 0, 0); // Compare based on date only
      
      return createdDate >= start && createdDate <= end;
    } else {
      // Default to current month if no params are passed
      const today = new Date();
      return createdDate.getMonth() === today.getMonth() && createdDate.getFullYear() === today.getFullYear();
    }
  };

  const styles = getStyles(isDarkMode, themeColors);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={filteredBudgets}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Manage Budgets</Text>

            <Text style={styles.label}>Category</Text>
            <TextInput
              style={[styles.input, styles.tealInput]}
              placeholder="e.g. Shopping, Food"
              value={category}
              onChangeText={setCategory}
              placeholderTextColor="#aaa"
            />

            <Text style={styles.label}>Budget Amount</Text>
            <TextInput
              style={[styles.input, styles.tealInput]}
              placeholder="Enter amount"
              keyboardType="numeric"
              value={amount}
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9.]/g, '');
                const parts = numericValue.split('.');
                if (parts.length > 2) {
                  setAmount(parts[0] + '.' + parts.slice(1).join(''));
                } else {
                  setAmount(numericValue);
                }
              }}
              placeholderTextColor="#aaa"
            />

            <TouchableOpacity style={[styles.saveButton, isDisabled && styles.disabledButton]} onPress={addBudget} disabled={isDisabled}>
              <Text style={[styles.saveText, isDisabled && styles.disabledText]}>Add Budget</Text>
            </TouchableOpacity>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({
              pathname: "/budgetDetails",
              params: { id: item.id, category: item.category }
            })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.category}</Text>
              <View style={styles.iconContainer}>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/editBudget", params: { id: item.id } })}
                  style={styles.editButton}
                >
                  <MaterialCommunityIcons name="pencil" size={20} color={themeColors.secondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  style={styles.deleteButton}
                >
                  <MaterialCommunityIcons name="delete" size={20} color="red" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.cardText}>Total: {formatAmount(item.amount)}</Text>
            <Text style={styles.cardText}>Used: {formatAmount(item.used || 0)}</Text>
            <Text style={styles.cardText}>Remaining: {formatAmount(item.amount - (item.used || 0))}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.container}
      />
    </SafeAreaView>
  );
}

const getStyles = (isDarkMode, themeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: isDarkMode ? '#121212' : '#F9F9F9',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    padding: 20,
    backgroundColor: isDarkMode ? '#121212' : '#F9F9F9',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: themeColors.primary,
    fontFamily: 'serif',
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    color: isDarkMode ? '#fff' : themeColors.secondary,
    marginTop: 12,
    fontFamily: 'serif',
  },
  input: {
    borderWidth: 1,
    borderColor: isDarkMode ? '#555' : '#D3D3D3',
    padding: 10,
    borderRadius: 5,
    fontSize: 16,
    marginTop: 6,
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    fontFamily: 'serif',
  },
  tealInput: {
    color: isDarkMode ? '#fff' : themeColors.secondary
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: themeColors.primary,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    alignSelf: 'center',
    minWidth: 150,
  },
  saveText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'serif',
    fontWeight: 'bold'
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  disabledText: {
    color: '#999',
  },
  card: {
    padding: 15,
    borderWidth: 1,
    borderColor: themeColors.primary,
    marginVertical: 8,
    borderRadius: 8,
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    color: themeColors.primary,
    fontFamily: 'serif',
    flex: 1,
  },
  iconContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  editButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: isDarkMode ? '#333' : '#f0f8ff',
  },
  deleteButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: isDarkMode ? '#4A2A2A' : '#fff0f0',
  },
  cardText: {
    fontSize: 16,
    color: isDarkMode ? '#fff' : themeColors.secondary,
    fontFamily: 'serif',
    marginBottom: 4
  },
});