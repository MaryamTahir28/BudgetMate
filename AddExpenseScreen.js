// AddExpenseScreen.js
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, push, ref, update } from "firebase/database";
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Keyboard, KeyboardAvoidingView,
  Modal,
  Platform,
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
  const { isDarkMode, theme, themeColors, formatAmount, currency, convertFromPKR, convertToPKR } = useAppContext();

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
  const [showIncomeExceededModal, setShowIncomeExceededModal] = useState(false);
  const [incomeExceededData, setIncomeExceededData] = useState({});

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

    // Check if the selected date is in the current month
    const now = new Date();
    const selectedMonth = date.getMonth();
    const selectedYear = date.getFullYear();
    const nowMonth = now.getMonth();
    const nowYear = now.getFullYear();
    if (selectedMonth !== nowMonth || selectedYear !== nowYear) {
      Alert.alert('Invalid Date', 'You can only add expenses for the current month.');
      return;
    }

    const userId = auth.currentUser?.uid || 'guest';

    // Get current month and year
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const currentMonthPrefix = `${currentYear}-${currentMonth}`;

    // Fetch total income for current month
    const incomeRef = ref(database, `users/${userId}/incomes`);
    const incomeSnapshot = await get(incomeRef);
    let totalIncome = 0;
    if (incomeSnapshot.exists()) {
      const incomes = incomeSnapshot.val();
      for (const key in incomes) {
        const incomeDate = incomes[key].date || '';
        if (incomeDate.startsWith(currentMonthPrefix)) {
          totalIncome += parseFloat(incomes[key].amount || 0);
        }
      }
    }

    // Fetch total expenses for current month
    const expensesRef = ref(database, `users/${userId}/expenses`);
    const expensesSnapshot = await get(expensesRef);
    let totalExpenses = 0;
    if (expensesSnapshot.exists()) {
      const expenses = expensesSnapshot.val();
      for (const key in expenses) {
        const expenseDate = expenses[key].date || '';
        if (expenseDate.startsWith(currentMonthPrefix)) {
          totalExpenses += parseFloat(expenses[key].amount || 0);
        }
      }
    }

    // If editing, subtract the old amount from totalExpenses
    if (params?.firebaseKey) {
      const oldExpenseRef = ref(database, `users/${userId}/expenses/${params.firebaseKey}`);
      const oldExpenseSnapshot = await get(oldExpenseRef);
      if (oldExpenseSnapshot.exists()) {
        const oldAmount = parseFloat(oldExpenseSnapshot.val().amount || 0);
        totalExpenses -= oldAmount;
      }
    }

    // Check if adding this expense exceeds total income
    if (totalExpenses + amountValue > totalIncome) {
      const shouldProceed = await new Promise((resolve) => {
        setIncomeExceededData({
          totalIncome,
          totalExpenses,
          newExpense: amountValue,
          onProceed: () => resolve(true),
          onCancel: () => resolve(false),
        });
        setShowIncomeExceededModal(true);
      });
      if (!shouldProceed) return;
    }

    const expenseData = {
      title,
      amount: amountValue.toString(),
      category: useCustomCategory ? customCategory : selectedCategory,
      note,
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      time: new Date().toTimeString().split(' ')[0],
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

  const styles = getStyles(isDarkMode, themeColors);

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
                  <Text style={{ color: selectedCategory === cat ? '#fff' : themeColors.primary }}>
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
                <MaterialCommunityIcons name="plus" size={18} color={themeColors.primary} />
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

      <Modal
        visible={showIncomeExceededModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowIncomeExceededModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Income Exceeded</Text>
            <Text style={styles.modalText}>
              Adding this expense will exceed your total income.
            </Text>
            <View style={styles.modalDetails}>
              <Text style={styles.modalDetailText}>
                Total Income: {formatAmount(incomeExceededData.totalIncome || 0)}
              </Text>
              <Text style={styles.modalDetailText}>
                Current Expenses: {formatAmount(incomeExceededData.totalExpenses || 0)}
              </Text>
              <Text style={styles.modalDetailText}>
                New Expense: {formatAmount(incomeExceededData.newExpense || 0)}
              </Text>
              <Text style={styles.modalDetailText}>
                Total After Addition: {formatAmount((incomeExceededData.totalExpenses || 0) + (incomeExceededData.newExpense || 0))}
              </Text>
            </View>
            <Text style={styles.modalWarning}>
              Do you want to proceed?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowIncomeExceededModal(false);
                  incomeExceededData.onCancel && incomeExceededData.onCancel();
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalProceedButton}
                onPress={() => {
                  setShowIncomeExceededModal(false);
                  incomeExceededData.onProceed && incomeExceededData.onProceed();
                }}
              >
                <Text style={styles.modalProceedText}>Proceed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default AddExpenseScreen;

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
    color: isDarkMode ? '#fff' : themeColors.primary,
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
    borderColor: isDarkMode ? '#333' : '#D3D3D3',
    padding: 10,
    borderRadius: 5,
    fontSize: 16,
    marginTop: 6,
    backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
    fontFamily: 'serif',
  },
  tealInput: { 
    color: isDarkMode ? '#fff' : themeColors.secondary
  },
  tealText: { 
    color: isDarkMode ? '#fff' : themeColors.secondary, 
    fontFamily: 'serif' 
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  catBox: {
    borderWidth: 1,
    borderColor: themeColors.primary,
    padding: 8,
    margin: 4,
    borderRadius: 8,
    backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
  },
  catBoxSelected: {
    backgroundColor: themeColors.primary,
    borderColor: themeColors.primary,
  },
  saveButton: {
    marginTop: 20,
    width: 150,
    backgroundColor: themeColors.primary,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    alignSelf: 'center',
  },
  saveText: { 
    color: 'white', 
    fontSize: 18, 
    fontFamily: 'serif' 
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    marginTop: 19,
    width: 150,
    backgroundColor: themeColors.secondary,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    alignSelf: 'center',
  },
  cancelText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'serif'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : themeColors.primary,
    fontFamily: 'serif',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    color: isDarkMode ? '#ccc' : '#666',
    textAlign: 'center',
    marginBottom: 15,
    fontFamily: 'serif',
  },
  modalDetails: {
    width: '100%',
    marginBottom: 15,
  },
  modalDetailText: {
    fontSize: 14,
    color: isDarkMode ? '#fff' : '#333',
    marginBottom: 5,
    fontFamily: 'serif',
  },
  modalWarning: {
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'serif',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalCancelButton: {
    backgroundColor: themeColors.secondary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'serif',
  },
  modalProceedButton: {
    backgroundColor: themeColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  modalProceedText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'serif',
  },
});
