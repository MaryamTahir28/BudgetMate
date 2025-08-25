// AddExpenseScreen.js
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from "@react-native-picker/picker"; // ✅ for web
import { useLocalSearchParams, useRouter } from 'expo-router';
import { onValue, push, ref, update } from "firebase/database";
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View
} from 'react-native';
import { Dropdown } from "react-native-paper-dropdown";

import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, database } from '../../firebaseConfig';

const initialCategories = [
  'Food', 'Social', 'Traffic', 'Shopping', 'Grocery', 'Education',
  'Bills', 'Rentals', 'Medical', 'Investment', 'Gift', 'Other',
];

const AddExpenseScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const hasPrefilled = useRef(false);
  const [customCategory, setCustomCategory] = useState('');
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  const [budgets, setBudgets] = useState([]);
  const [showDropDown, setShowDropDown] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null); // ✅ added
  const [rent, setRent] = useState(''); // ✅ added

  // Load budgets from Firebase
  useEffect(() => {
    const budgetsRef = ref(database, "budgets/");
    onValue(budgetsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedBudgets = Object.keys(data).map((key) => ({
          label: `${data[key].category} (Remaining: ${data[key].amount - (data[key].used || 0)})`,
          value: key,
          ...data[key],
        }));
        setBudgets(loadedBudgets);
      } else {
        setBudgets([]);
      }
    });
  }, []);

  useEffect(() => {
    if (params?.firebaseKey && !hasPrefilled.current) {
      setAmount(params.amount?.toString() || '');
      setNote(params.note?.toString() || '');
      setDate(params.date ? new Date(params.date) : new Date());
      setSelectedCategory(params.category?.toString() || '');
      hasPrefilled.current = true;
    }
  }, [params]);

  const handleSave = useCallback(async () => {
    if (!amount || (!selectedCategory && !customCategory)) {
      Alert.alert('Validation Error', 'Amount and Category are required.');
      return;
    }

    const amountValue = Number(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number.');
      setAmount('');
      return;
    }

    const expenseData = {
      title,
      amount: amountValue.toString(),
      category: useCustomCategory ? customCategory : selectedCategory,
      note,
      rent: rent ? parseFloat(rent) : 0,
      budgetId: selectedBudget,
      date: date.toISOString().split('T')[0],
      time: new Date().toLocaleTimeString(),
    };

    try {
      const userId = auth.currentUser?.uid || 'guest';

      if (params?.firebaseKey) {
        await update(ref(database, `users/${userId}/expenses/${params.firebaseKey}`), expenseData);
        Alert.alert('Updated', 'Expense updated successfully.');
      } else {
        expenseData.id = Date.now().toString();
        await push(ref(database, `users/${userId}/expenses`), expenseData);
        Alert.alert('Success', 'Expense saved.');

        // ✅ Update budget if linked
        // ✅ Safe find with optional chaining
if (selectedBudget && Array.isArray(budgets)) {
  const budget = budgets.find((b) => String(b.value) === String(selectedBudget));
  if (budget) {
    const newUsed = (budget.used || 0) + amountValue;
    await update(ref(database, `budgets/${selectedBudget}`), { used: newUsed });
  } else {
    console.warn("⚠️ Budget not found for:", selectedBudget);
  }
} else {
  console.warn("⚠️ No budgets available or no budget selected");
}

      }

      router.replace('/home');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save expense.');
    }
  }, [title, amount, selectedCategory, customCategory, note, date, rent, selectedBudget, budgets, router, params, useCustomCategory]);

  const handleSaveCustomCategory = () => {
    if (customCategory.trim() !== '') {
      setCategories([...categories, customCategory]);
      setSelectedCategory(customCategory);
      setUseCustomCategory(false);
      setCustomCategory('');
    }
  };

  const handleAmountChange = (text) => {
    const numericRegex = /^[0-9]*(\.[0-9]{0,2})?$/;
    if (numericRegex.test(text)) {
      setAmount(text);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'android' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 30}
        >
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 0 }} keyboardShouldPersistTaps="handled">
            <ScrollView contentContainerStyle={styles.container}>
              <Text style={styles.title}>
                {params?.firebaseKey ? 'Edit Expense' : 'Add Expense'}
              </Text>

              <Text style={styles.label}>Amount</Text>
              <TextInput
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
                style={[styles.input, styles.tealInput]}
                placeholder="Enter amount"
                placeholderTextColor="#aaa"
              />

              <Text style={styles.label}>Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.input, styles.tealInput]}>
                <Text style={styles.tealText}>{date.toDateString()}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={(event, selected) => {
                    setShowDatePicker(false);
                    if (selected) setDate(selected);
                  }}
                />
              )}

              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryWrap}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catBox, selectedCategory === cat && styles.catBoxSelected]}
                    onPress={() => {
                      setSelectedCategory(cat);
                      setUseCustomCategory(false);
                    }}
                  >
                    <Text style={{ color: selectedCategory === cat ? '#fff' : '#800080' }}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={[styles.catBox, useCustomCategory && styles.catBoxSelected, { borderStyle: 'dashed' }]}
                  onPress={() => {
                    setUseCustomCategory(true);
                    setSelectedCategory('');
                  }}
                >
                  <MaterialCommunityIcons name="plus" size={18} color="#800080" />
                </TouchableOpacity>
              </View>

              {useCustomCategory && (
                <>
                  <TextInput
                    style={[styles.input, styles.tealInput]}
                    placeholder="Enter custom category"
                    value={customCategory}
                    onChangeText={setCustomCategory}
                    placeholderTextColor="#aaa"
                  />
                  <TouchableOpacity style={styles.saveButton} onPress={handleSaveCustomCategory}>
                    <Text style={styles.saveText}>Save Category</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Budget Dropdown */}
              {Platform.OS === "web" ? (
  // 👉 Web: Simple Picker
  <View style={[styles.input, { padding: 0 }]}>
    <Picker
      selectedValue={selectedBudget}
      onValueChange={(itemValue) => setSelectedBudget(itemValue)}
    >
      <Picker.Item label="Select Budget" value={null} />
      {budgets.map((b) => (
        <Picker.Item
          key={b.value}
          label={`${b.category} (Remaining: ${b.amount - (b.used || 0)})`}
          value={b.value}
        />
      ))}
    </Picker>
  </View>
) : (
  // 👉 Mobile: Paper Dropdown
  <Dropdown
    label={"Select Budget (optional)"}
    mode={"outlined"}
    visible={showDropDown}
    showDropDown={() => setShowDropDown(true)}
    onDismiss={() => setShowDropDown(false)}
    value={selectedBudget}
    setValue={setSelectedBudget}
    list={budgets || []}
  />
)}

              {/* Rent Input */}
              <Text style={styles.label}>Rent (optional)</Text>
              <TextInput
                value={rent}
                onChangeText={setRent}
                keyboardType="numeric"
                style={[styles.input, styles.tealInput]}
                placeholder="Enter rent (if any)"
                placeholderTextColor="#aaa"
              />

              <Text style={styles.label}>Note</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                style={[styles.input, styles.tealInput, { height: 80 }]}
                placeholder="Add description (optional)"
                placeholderTextColor="#aaa"
                multiline
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveText}>{params?.firebaseKey ? 'Update' : 'Save'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

export default AddExpenseScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    padding: 20,
    backgroundColor: '#F9F9F9',
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
    color: '#003366',
    marginTop: 12,
    fontFamily: 'serif',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D3D3D3',
    padding: 10,
    borderRadius: 5,
    fontSize: 16,
    marginTop: 6,
    backgroundColor: '#fff',
    fontFamily: 'serif',
  },
  tealInput: { color: '#003366' },
  tealText: { color: '#003366', fontFamily: 'serif' },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  catBox: {
    borderWidth: 1,
    borderColor: '#800080',
    padding: 8,
    margin: 4,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  catBoxSelected: {
    backgroundColor: '#800080',
    borderColor: '#800080',
  },
  saveButton: {
    marginTop: 20,
    width: 150,
    backgroundColor: '#800080',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    alignSelf: 'center',
  },
  saveText: { color: 'white', fontSize: 18, fontFamily: 'serif' },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    marginTop: 19,
    width: 150,
    backgroundColor: '#003366',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    alignSelf: 'center',
  },
  cancelText: { color: 'white', fontSize: 18, fontFamily: 'serif' },
});
