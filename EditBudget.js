//EditBudget.js
import { useLocalSearchParams, useRouter } from "expo-router";
import { onValue, ref, update } from "firebase/database";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useAppContext } from "../../AppContext";
import { auth, database } from "../../firebaseConfig";

export default function EditBudget() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { isDarkMode, convertFromPKR, convertToPKR, currency } = useAppContext();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);

  // Load existing budget data
  useEffect(() => {
    const userId = auth.currentUser?.uid || "guest";
    const budgetRef = ref(database, `users/${userId}/budgets/${id}`);
    onValue(budgetRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCategory(data.category);
        setAmount(convertFromPKR(data.amount).toString());
      }
      setLoading(false);
    });
  }, [id, convertFromPKR]);

  // Update budget
  const updateBudget = () => {
    if (!category || !amount) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    const userId = auth.currentUser?.uid || "guest";
    const amountInPKR = convertToPKR(amountValue);
    update(ref(database, `users/${userId}/budgets/${id}`), {
      category,
      amount: amountInPKR,
    }).then(() => {
      Alert.alert("Success", "Budget updated successfully");
      router.back();
    }).catch((error) => {
      Alert.alert("Error", "Failed to update budget");
      console.error(error);
    });
  };

  const styles = getStyles(isDarkMode);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Edit Budget</Text>

        <Text style={styles.label}>Category</Text>
        <TextInput
          style={[styles.input, styles.tealInput]}
          placeholder="Category"
          value={category}
          onChangeText={setCategory}
          placeholderTextColor="#aaa"
        />

        <Text style={styles.label}>Budget Amount ({currency})</Text>
        <TextInput
          style={[styles.input, styles.tealInput]}
          placeholder="Amount"
          keyboardType="numeric"
          value={amount}
          onChangeText={(text) => {
            // Only allow positive numbers and decimals
            const numericValue = text.replace(/[^0-9.]/g, '');
            // Prevent multiple decimal points
            const parts = numericValue.split('.');
            if (parts.length > 2) {
              setAmount(parts[0] + '.' + parts.slice(1).join(''));
            } else {
              setAmount(numericValue);
            }
          }}
          placeholderTextColor="#aaa"
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.saveButton} onPress={updateBudget}>
            <Text style={styles.saveText}>Update Budget</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (isDarkMode) => StyleSheet.create({
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
    color: '#800080',
    fontFamily: 'serif',
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    color: isDarkMode ? '#fff' : '#003366',
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
  tealInput: { color: isDarkMode ? '#fff' : '#003366' },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  saveButton: {
    backgroundColor: '#800080',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderRadius: 8,
  },
  saveText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'serif',
    fontWeight: 'bold'
  },
  cancelButton: {
    backgroundColor: '#003366',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderRadius: 8,
  },
  cancelText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'serif',
    fontWeight: 'bold'
  },
});
