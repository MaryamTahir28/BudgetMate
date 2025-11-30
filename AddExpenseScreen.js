// AddExpenseScreen.js
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, push, ref, update } from "firebase/database";
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Keyboard, KeyboardAvoidingView, Platform,
  StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../../AppContext';
import { auth, database } from '../../firebaseConfig';

const initialCategories = [
  'Food', 'Social', 'Traffic', 'Shopping', 'Grocery', 'Education',
  'Bills', 'Rentals', 'Medical', 'Investment', 'Gift', 'Other',
];

const AddExpenseScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isDarkMode } = useAppContext();

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
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      time: new Date().toLocaleTimeString(),
    };

    try {
      const userId = auth.currentUser?.uid || 'guest';

      // Helper function to check budget exceedance and handle alert
      const checkBudgetExceedance = (budgetsData, category, amountValue) => {
        return new Promise((resolve) => {
          const exceedingCategories = [];
          for (const budgetId in budgetsData) {
            const budgetCategory = budgetsData[budgetId].category.trim().toLowerCase();
            if (budgetCategory === category.toLowerCase()) {
              const currentUsed = budgetsData[budgetId].used || 0;
              const budgetAmount = parseFloat(budgetsData[budgetId].amount || 0);
              if (currentUsed + amountValue > budgetAmount) {
                exceedingCategories.push(budgetsData[budgetId].category);
              }
            }
          }
          if (exceedingCategories.length > 0) {
            Alert.alert(
              'Budget Limit Exceeded',
              `Adding this expense will exceed the budget limit for: ${exceedingCategories.join(', ')}. Do you want to proceed and automatically increase the budget?`,
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Proceed', onPress: () => resolve(true) },
              ]
            );
          } else {
            resolve(true);
          }
        });
      };

      // Helper function to increase budget amounts for exceeding categories
      const increaseBudgets = async (budgetsData, category, amountValue) => {
        for (const budgetId in budgetsData) {
          const budgetCategory = budgetsData[budgetId].category.trim().toLowerCase();
          if (budgetCategory === category.toLowerCase()) {
            const currentUsed = budgetsData[budgetId].used || 0;
            const budgetAmount = parseFloat(budgetsData[budgetId].amount || 0);
            if (currentUsed + amountValue > budgetAmount) {
              const newAmount = currentUsed + amountValue;
              await update(ref(database, `users/${userId}/budgets/${budgetId}`), { amount: newAmount.toString() });
            }
          }
        }
      };

      if (params?.firebaseKey) {
        // Update existing expense
        const oldExpenseRef = ref(database, `users/${userId}/expenses/${params.firebaseKey}`);
        const oldExpenseSnapshot = await get(oldExpenseRef);
        if (oldExpenseSnapshot.exists()) {
          const oldExpense = oldExpenseSnapshot.val();
          const oldAmount = parseFloat(oldExpense.amount || 0);
          const oldCategory = oldExpense.category;

          // Refund old amount from old budgets
          if (oldExpense.budgetIds && Array.isArray(oldExpense.budgetIds)) {
            for (const budgetId of oldExpense.budgetIds) {
              const budgetRef = ref(database, `users/${userId}/budgets/${budgetId}`);
              const budgetSnapshot = await get(budgetRef);
              if (budgetSnapshot.exists()) {
                const budgetData = budgetSnapshot.val();
                const currentUsed = budgetData.used || 0;
                const newUsed = Math.max(0, currentUsed - oldAmount);
                await update(budgetRef, { used: newUsed });
              }
            }
          }
        }

        // Check for budget exceedance before deducting new amount
        const budgetsRef = ref(database, `users/${userId}/budgets`);
        const snapshot = await get(budgetsRef);
        if (snapshot.exists()) {
          const budgetsData = snapshot.val();
          const category = (useCustomCategory ? customCategory : selectedCategory).trim();
          const shouldProceed = await checkBudgetExceedance(budgetsData, category, amountValue);
          if (!shouldProceed) return;

          // Increase budgets if proceeding
          await increaseBudgets(budgetsData, category, amountValue);
        }

        // Deduct new amount from matching budgets
        const budgetIds = [];
        if (snapshot.exists()) {
          const budgetsData = snapshot.val();
          const category = (useCustomCategory ? customCategory : selectedCategory).trim();
          console.log('Update expense category:', category);
          for (const budgetId in budgetsData) {
            const budgetCategory = budgetsData[budgetId].category.trim().toLowerCase();
            console.log('Budget category:', budgetCategory, 'for budgetId:', budgetId);
            if (budgetCategory === category.toLowerCase()) {
              const newUsed = (budgetsData[budgetId].used || 0) + amountValue;
              await update(ref(database, `users/${userId}/budgets/${budgetId}`), { used: newUsed });
              budgetIds.push(budgetId);
              console.log('Deducted from budget:', budgetId, 'new used:', newUsed);
            }
          }
        }
        expenseData.budgetIds = budgetIds;
        await update(ref(database, `users/${userId}/expenses/${params.firebaseKey}`), expenseData);
        Alert.alert('Updated', 'Expense updated successfully.');
      } else {
        // Add new expense
        expenseData.id = Date.now().toString();

        // Check for budget exceedance before deducting
        const budgetsRef = ref(database, `users/${userId}/budgets`);
        const snapshot = await get(budgetsRef);
        if (snapshot.exists()) {
          const budgetsData = snapshot.val();
          const category = (useCustomCategory ? customCategory : selectedCategory).trim();
          const shouldProceed = await checkBudgetExceedance(budgetsData, category, amountValue);
          if (!shouldProceed) return;

          // Increase budgets if proceeding
          await increaseBudgets(budgetsData, category, amountValue);
        }

        // Auto-deduct from all matching budgets
        const budgetIds = [];
        if (snapshot.exists()) {
          const budgetsData = snapshot.val();
          const category = (useCustomCategory ? customCategory : selectedCategory).trim();
          console.log('Expense category:', category);
          for (const budgetId in budgetsData) {
            const budgetCategory = budgetsData[budgetId].category.trim().toLowerCase();
            console.log('Budget category:', budgetCategory, 'for budgetId:', budgetId);
            if (budgetCategory === category.toLowerCase()) {
              const newUsed = (budgetsData[budgetId].used || 0) + amountValue;
              await update(ref(database, `users/${userId}/budgets/${budgetId}`), { used: newUsed });
              budgetIds.push(budgetId); // Collect all matching budget IDs
              console.log('Deducted from budget:', budgetId, 'new used:', newUsed);
            }
          }
        }
        expenseData.budgetIds = budgetIds; // Store budget IDs on the expense
        await push(ref(database, `users/${userId}/expenses`), expenseData);
        Alert.alert('Success', 'Expense saved.');
      }

      router.replace('/home');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save expense.');
    }
  }, [title, amount, selectedCategory, customCategory, note, date, router, params, useCustomCategory]);

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

  const styles = getStyles(isDarkMode);

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'android' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 30}
        >
          <View style={styles.container}>
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
              placeholderTextColor={isDarkMode ? '#ccc' : '#aaa'}
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
                  placeholderTextColor={isDarkMode ? '#ccc' : '#aaa'}
                />
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveCustomCategory}>
                  <Text style={styles.saveText}>Save Category</Text>
                </TouchableOpacity>
              </>
            )}



            <Text style={styles.label}>Note</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              style={[styles.input, styles.tealInput, { height: 80 }]}
              placeholder="Add description (optional)"
              placeholderTextColor={isDarkMode ? '#ccc' : '#aaa'}
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
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

export default AddExpenseScreen;

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
    color: isDarkMode ? '#fff' : '#800080',
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
    borderColor: isDarkMode ? '#333' : '#D3D3D3',
    padding: 10,
    borderRadius: 5,
    fontSize: 16,
    marginTop: 6,
    backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
    fontFamily: 'serif',
  },
  tealInput: { color: isDarkMode ? '#fff' : '#003366' },
  tealText: { color: isDarkMode ? '#fff' : '#003366', fontFamily: 'serif' },
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
    backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
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
