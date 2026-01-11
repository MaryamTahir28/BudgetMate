import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, push, ref, remove, update } from "firebase/database";
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
  const { isDarkMode, themeColors, formatAmount, refreshExpenses } = useAppContext();

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const hasPrefilled = useRef(false);
  const [customCategory, setCustomCategory] = useState('');
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  
  // Modal State
  const [showExceededModal, setShowExceededModal] = useState(false);
  const [modalConfig, setModalConfig] = useState(null);

  // ---------------------------------------------------------
  // 1. SMART SAVE FUNCTION (Self-Cleaning)
  // ---------------------------------------------------------
  const saveExpense = useCallback(async (expenseData, exceedingAmount) => {
    try {
      const userId = auth.currentUser?.uid || 'guest';
      const expenseKey = params?.id;

      // A. AUTO-CLEANUP: If Editing, Delete Old Associations First
      if (expenseKey) {
        const oldExpenseRef = ref(database, `users/${userId}/expenses/${expenseKey}`);
        const oldSnapshot = await get(oldExpenseRef);

        if (oldSnapshot.exists()) {
          const oldData = oldSnapshot.val();

          // 1. Delete linked Savings Usage
          if (oldData.savingsUsageKey) {
            console.log("Auto-deleting old savings usage:", oldData.savingsUsageKey);
            await remove(ref(database, `users/${userId}/savingsUsage/${oldData.savingsUsageKey}`));
          }

          // 2. Refund Old Budgets
          if (oldData.budgetIds && Array.isArray(oldData.budgetIds)) {
             for (const budgetId of oldData.budgetIds) {
                const bRef = ref(database, `users/${userId}/budgets/${budgetId}`);
                const bSnap = await get(bRef);
                if (bSnap.exists()) {
                   const bData = bSnap.val();
                   const refundedUsed = Math.max(0, (bData.used || 0) - parseFloat(oldData.amount));
                   await update(bRef, { used: refundedUsed });
                }
             }
          }
        }
      }

      // B. BUDGET CHECK
      const budgetsRef = ref(database, `users/${userId}/budgets`);
      const snapshot = await get(budgetsRef);
      const budgetsData = snapshot.exists() ? snapshot.val() : {};

      const category = expenseData.category.trim();
      const amountValue = parseFloat(expenseData.amount);

      // C. CHARGE NEW BUDGETS
      const newBudgetIds = [];
      for (const budgetId in budgetsData) {
        const budgetCategory = budgetsData[budgetId].category.trim().toLowerCase();
        if (budgetCategory === category.toLowerCase()) {
          const currentUsed = budgetsData[budgetId].used || 0;
          const budgetLimit = parseFloat(budgetsData[budgetId].amount || 0);

          let newUsed = currentUsed + amountValue;

          // Auto-increase limit if we exceeded
          if (newUsed > budgetLimit) {
             await update(ref(database, `users/${userId}/budgets/${budgetId}`), { amount: newUsed.toString() });
          }

          await update(ref(database, `users/${userId}/budgets/${budgetId}`), { used: newUsed });
          newBudgetIds.push(budgetId);
        }
      }
      expenseData.budgetIds = newBudgetIds;

      // D. CREATE NEW SAVINGS USAGE
      if (exceedingAmount > 0) {
        const savingsUsageRef = await push(ref(database, `users/${userId}/savingsUsage`), {
          amount: exceedingAmount.toString(),
          date: expenseData.date,
          category: 'Goal savings',
          note: `Deducted for expense exceeding income by ${formatAmount(exceedingAmount)}`,
          time: expenseData.time,
        });
        expenseData.savingsUsageKey = savingsUsageRef.key;
      } else {
        expenseData.savingsUsageKey = null;
      }

      // E. SAVE EXPENSE RECORD
      if (expenseKey) {
        await update(ref(database, `users/${userId}/expenses/${expenseKey}`), expenseData);
        Alert.alert('Updated', 'Expense updated successfully.');
      } else {
        await push(ref(database, `users/${userId}/expenses`), expenseData);
        Alert.alert('Success', 'Expense saved.');
      }

      // Refresh expenses to ensure updated data is shown
      await refreshExpenses();

      router.back();

    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save expense.');
    }
  }, [router, params, formatAmount]);

  useEffect(() => {
    if (params?.id && !hasPrefilled.current) {
      setAmount(params.amount?.toString() || '');
      setNote(params.note?.toString() || '');
      setDate(params.date ? new Date(params.date) : new Date());
      setSelectedCategory(params.category?.toString() || '');
      hasPrefilled.current = true;
    }
  }, [params]);

  // ---------------------------------------------------------
  // 2. HANDLE SAVE UI LOGIC
  // ---------------------------------------------------------
  const handleSave = useCallback(async () => {
    // A. Validation
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
    const now = new Date();
    if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) {
      Alert.alert('Invalid Date', 'You can only add expenses for the current month.');
      return;
    }

    const userId = auth.currentUser?.uid || 'guest';
    const currentYear = date.getFullYear();
    const currentMonth = String(date.getMonth() + 1).padStart(2, '0');
    const currentMonthPrefix = `${currentYear}-${currentMonth}`;

    // B. Fetch Totals
    const incomeRef = ref(database, `users/${userId}/incomes`);
    const incomeSnapshot = await get(incomeRef);
    let totalIncome = 0;
    let totalSavingsIncome = 0;

    if (incomeSnapshot.exists()) {
      const incomes = incomeSnapshot.val();
      for (const key in incomes) {
        const incomeDate = incomes[key].date || '';
        const category = incomes[key].category || '';
        if (incomeDate.startsWith(currentMonthPrefix) && category !== 'Savings') {
          totalIncome += parseFloat(incomes[key].amount || 0);
        }
        if (category === 'Savings') {
          totalSavingsIncome += parseFloat(incomes[key].amount || 0);
        }
      }
    }

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

    // C. Edit Logic (Calculate True Impact)
    let oldSavingsAmount = 0;
    const expenseKey = params?.id;
    if (expenseKey) {
      const oldExpenseRef = ref(database, `users/${userId}/expenses/${expenseKey}`);
      const oldExpenseSnapshot = await get(oldExpenseRef);
      if (oldExpenseSnapshot.exists()) {
        const oldExpense = oldExpenseSnapshot.val();

        // Remove old amount from Total Expenses
        totalExpenses -= parseFloat(oldExpense.amount || 0);

        // Find old savings amount (just for math)
        if (oldExpense.savingsUsageKey) {
           const oldUsageSnap = await get(ref(database, `users/${userId}/savingsUsage/${oldExpense.savingsUsageKey}`));
           if (oldUsageSnap.exists()) {
              oldSavingsAmount = parseFloat(oldUsageSnap.val().amount || 0);
           }
        }
      }
    }

    const expenseData = {
      amount: amountValue,
      category: useCustomCategory ? customCategory : selectedCategory,
      note,
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      time: new Date().toTimeString().split(' ')[0],
    };

    // D. CHECK BUDGET EXCEEDANCE FIRST
    const budgetsRef = ref(database, `users/${userId}/budgets`);
    const budgetsSnapshot = await get(budgetsRef);
    const budgetsData = budgetsSnapshot.exists() ? budgetsSnapshot.val() : {};
    const category = expenseData.category.trim();
    let budgetExceedingAmount = 0;

    for (const budgetId in budgetsData) {
      const budgetCategory = budgetsData[budgetId].category.trim().toLowerCase();
      if (budgetCategory === category.toLowerCase()) {
        const currentUsed = budgetsData[budgetId].used || 0;
        const budgetLimit = parseFloat(budgetsData[budgetId].amount || 0);
        const newUsed = currentUsed + amountValue;
        if (newUsed > budgetLimit) {
          budgetExceedingAmount = Math.min(amountValue, newUsed - budgetLimit);
          break; // Assuming one budget per category
        }
      }
    }

    if (budgetExceedingAmount > 0) {
      // Calculate available savings
      const savingsUsageRef = ref(database, `users/${userId}/savingsUsage`);
      const savingsUsageSnapshot = await get(savingsUsageRef);
      let totalSavingsUsed = 0;
      if (savingsUsageSnapshot.exists()) {
        const usages = savingsUsageSnapshot.val();
        for (const key in usages) {
          totalSavingsUsed += parseFloat(usages[key].amount || 0);
        }
      }
      // "Refund" the old savings usage locally
      totalSavingsUsed -= oldSavingsAmount;
      const availableSavings = totalSavingsIncome - totalSavingsUsed;

      setModalConfig({
        type: 'budget',
        budgetExceedingAmount,
        availableSavings,
        canProceed: budgetExceedingAmount <= availableSavings,
        onProceed: async () => {
          if (budgetExceedingAmount <= availableSavings) {
            setShowExceededModal(false);
            await saveExpense(expenseData, budgetExceedingAmount);
            setModalConfig(null);
          }
        },
        onCancel: () => {
          setModalConfig(null);
        },
      });

      setShowExceededModal(true);
      return;
    }

    // E. CHECK INCOME EXCEEDANCE
    if (totalExpenses + amountValue > totalIncome) {
      
      // 1. Calculate TOTAL deficit
      const totalDeficit = (totalExpenses + amountValue) - totalIncome;

      // 2. THE FIX: Cap the deduction at the expense amount itself
      // If we are deep in debt, we only deduct what we just spent (10), not the whole deficit (37).
      const exceedingAmount = Math.min(amountValue, totalDeficit);

      console.log(`🧮 [handleSave] Total Deficit: ${totalDeficit}`);
      console.log(`✂️ [handleSave] Capped Deduction: ${exceedingAmount}`);

      const savingsUsageRef = ref(database, `users/${userId}/savingsUsage`);
      const savingsUsageSnapshot = await get(savingsUsageRef);
      let totalSavingsUsed = 0;
      if (savingsUsageSnapshot.exists()) {
        const usages = savingsUsageSnapshot.val();
        for (const key in usages) {
          totalSavingsUsed += parseFloat(usages[key].amount || 0);
        }
      }

      // "Refund" the old savings usage locally
      totalSavingsUsed -= oldSavingsAmount;

      const availableSavings = totalSavingsIncome - totalSavingsUsed;

      setModalConfig({
        type: 'income',
        totalIncome,
        totalExpenses,
        newExpense: amountValue,
        exceedingAmount, 
        availableSavings,
        canProceed: exceedingAmount <= availableSavings,
        onProceed: async () => {
          if (exceedingAmount <= availableSavings) {
            setShowExceededModal(false);
            await saveExpense(expenseData, exceedingAmount);
            setModalConfig(null);
          }
        },
        onCancel: () => {
          setModalConfig(null);
        },
      });

      setShowExceededModal(true);
      return;
    }

    await saveExpense(expenseData, 0);

  }, [amount, selectedCategory, customCategory, note, date, router, params, useCustomCategory, saveExpense]);

  const handleSaveCustomCategory = () => {
    if (customCategory.trim() !== '') {
      setCategories([...categories, customCategory]);
      setSelectedCategory(customCategory);
      setUseCustomCategory(false);
      setCustomCategory('');
    }
  };

  const handleAmountChange = (text) => {
    // Replace commas with dots
    let cleanedText = text.replace(/,/g, '.');
    
    if (cleanedText === '') {
      setAmount('');
      return;
    }

    // Allow typing numbers and dots
    const numericRegex = /^[0-9]*\.?[0-9]{0,2}$/;
    
    if (numericRegex.test(cleanedText)) {
      setAmount(cleanedText);
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
              {params?.id ? 'Edit Expense' : 'Add Expense'}
            </Text>

            <Text style={styles.label}>Amount</Text>
            <TextInput
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad" 
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
                <Text style={styles.saveText}>{params?.id ? 'Update' : 'Save'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      {/* MODAL */}
      <Modal
        visible={showExceededModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExceededModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {modalConfig && (
              <>
                <Text style={styles.modalTitle}>
                  {modalConfig.type === 'budget' ? 'Budget Exceeded' : 'Deduct from Savings'}
                </Text>
                <Text style={styles.modalText}>
                  {modalConfig.type === 'budget'
                    ? `This expense exceeds your budget by ${formatAmount(modalConfig.budgetExceedingAmount)}. You have ${formatAmount(modalConfig.availableSavings)} available in savings.`
                    : `This expense exceeds your income by ${formatAmount(modalConfig.exceedingAmount)}. You have ${formatAmount(modalConfig.availableSavings)} available in savings.`
                  }
                </Text>
                {modalConfig.type === 'income' && (
                  <View style={styles.modalDetails}>
                    <Text style={styles.modalDetailText}>
                      Total Income: {formatAmount(modalConfig.totalIncome || 0)}
                    </Text>
                    <Text style={styles.modalDetailText}>
                      Current Expenses: {formatAmount(modalConfig.totalExpenses || 0)}
                    </Text>
                    <Text style={styles.modalDetailText}>
                      New Expense: {formatAmount(modalConfig.newExpense || 0)}
                    </Text>
                    <Text style={styles.modalDetailText}>
                      Total After Addition: {formatAmount((modalConfig.totalExpenses || 0) + (modalConfig.newExpense || 0))}
                    </Text>
                    {modalConfig.exceedingAmount > 0 && (
                      <Text style={styles.modalDetailText}>
                        Exceeding Amount: {formatAmount(modalConfig.exceedingAmount)}
                      </Text>
                    )}
                  </View>
                )}
                <Text style={styles.modalWarning}>
                  Proceed?
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => {
                      setShowExceededModal(false);
                      setModalConfig(null);
                    }}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalProceedButton, !modalConfig.canProceed && styles.modalProceedButtonDisabled]}
                    onPress={() => {
                      if (modalConfig.canProceed) {
                        modalConfig.onProceed();
                      }
                    }}
                    disabled={!modalConfig.canProceed}
                  >
                    <Text style={[styles.modalProceedText, !modalConfig.canProceed && styles.modalProceedTextDisabled]}>
                      {modalConfig.canProceed ? 'Proceed' : 'Insufficient Savings'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  modalProceedButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalProceedText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'serif',
  },
  modalProceedTextDisabled: {
    color: '#999',
  },
});