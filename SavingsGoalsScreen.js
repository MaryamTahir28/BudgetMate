import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { get, onValue, push, ref, remove, update } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAppContext } from '../../AppContext';
import { auth, database } from '../../firebaseConfig';

const SavingsGoalsScreen = () => {
  const router = useRouter();
  const { isDarkMode, currency, formatAmount, convertToPKR, convertFromPKR, themeColors, selectedDateRange } = useAppContext();
  const user = auth.currentUser;

  // Use global selectedDateRange for consistent filtering
  const startDate = selectedDateRange?.startDate;
  const endDate = selectedDateRange?.endDate;

  // Check if current view is for current month (no date range selected or current month selected)
  const isCurrentMonth = !startDate || !endDate || (() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start.getMonth() === currentMonth && start.getFullYear() === currentYear &&
           end.getMonth() === currentMonth && end.getFullYear() === currentYear;
  })();

  const [savingsGoals, setSavingsGoals] = useState([]);
  const [completedGoals, setCompletedGoals] = useState([]);
  
  // 2. Add State for Filtered Lists
  const [filteredActiveGoals, setFilteredActiveGoals] = useState([]);
  const [filteredCompletedGoals, setFilteredCompletedGoals] = useState([]);

  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Form states
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [timeframe, setTimeframe] = useState('months');
  const [durationValue, setDurationValue] = useState('');
  const [monthlySavingPercent, setMonthlySavingPercent] = useState('');
  const [linkedWishId, setLinkedWishId] = useState(null);
  const [selectedIncomeCategories, setSelectedIncomeCategories] = useState([]);

  const [wishlist, setWishlist] = useState([]);

  // Additional states for updating saved amount modal
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [currentGoal, setCurrentGoal] = useState(null);
  const [newSavedAmount, setNewSavedAmount] = useState('');

  // Additional states for editing goal modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [editGoalName, setEditGoalName] = useState('');
  const [editTargetAmount, setEditTargetAmount] = useState('');
  const [editTimeframe, setEditTimeframe] = useState('months');
  const [editDurationValue, setEditDurationValue] = useState('');
  const [editMonthlySavingPercent, setEditMonthlySavingPercent] = useState('');
  const [editLinkedWishId, setEditLinkedWishId] = useState(null);
  const [editSelectedIncomeCategories, setEditSelectedIncomeCategories] = useState([]);

  // Additional states for income exceeded modal
  const [showIncomeExceededModal, setShowIncomeExceededModal] = useState(false);
  const [incomeExceededData, setIncomeExceededData] = useState({});

  // --- HELPER: Check Date Range ---
  const isGoalInSelectedRange = (goal, isCompleted) => {
    // 1. Safety check
    if (!goal.createdAt) return false;

    // 2. Parse goal creation date
    const createdDate = new Date(goal.createdAt);

    // 3. If NO filter is selected (default view), SHOW ONLY CURRENT MONTH GOALS
    if (!startDate || !endDate) {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const goalMonth = createdDate.getMonth();
      const goalYear = createdDate.getFullYear();
      return goalMonth === currentMonth && goalYear === currentYear;
    }

    // 4. Parse filter dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    // 5. Validate Dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false; // Don't show if dates are invalid
    }

    // 6. Normalize Times (Start of day to End of day)
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // 7. For completed goals, show only those created within the selected range
    if (isCompleted) {
      return createdDate >= start && createdDate <= end;
    }

    // 8. For active goals, show if the selected range is current month or later
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const rangeStartMonth = start.getMonth();
    const rangeStartYear = start.getFullYear();

    if (rangeStartYear > currentYear || (rangeStartYear === currentYear && rangeStartMonth >= currentMonth)) {
      return true; // Show active goals in current or future months
    } else {
      return false; // Don't show active goals in past months
    }
  };

  const openUpdateModal = (goal) => {
    setCurrentGoal(goal);
    setNewSavedAmount('');
    setUpdateModalVisible(true);
  };

  const openEditModal = (goal) => {
    setEditingGoal(goal);
    setEditGoalName(goal.goalName);
    setEditTargetAmount(String(convertFromPKR(goal.targetAmount)));
    setEditTimeframe(goal.timeframe);
    setEditDurationValue(String(goal.durationValue));
    setEditMonthlySavingPercent(String(goal.monthlySavingPercent || 0));
    setEditLinkedWishId(goal.linkedWishId || null);
    setEditSelectedIncomeCategories(goal.selectedIncomeCategories || []);
    setEditModalVisible(true);
  };

  const handleSaveUpdatedAmount = async () => {
    if (!currentGoal || !newSavedAmount) {
      Alert.alert('Error', 'Please enter the saved amount');
      return;
    }
    const parsedAmount = parseFloat(newSavedAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      Alert.alert('Error', 'Please enter a valid non-negative number');
      return;
    }
    const existingSaved = currentGoal.savedAmount ? convertFromPKR(currentGoal.savedAmount) : 0;
    const targetAmount = convertFromPKR(currentGoal.targetAmount);
    const newTotal = existingSaved + parsedAmount;
    if (newTotal > targetAmount) {
      const remaining = targetAmount - existingSaved;
      Alert.alert('Notice', `You only need ${formatAmount(remaining)} ${currency} more to reach your goal. You cannot add more than the remaining amount.`);
      return;
    }

    // Get current month and year
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const currentMonthPrefix = `${currentYear}-${currentMonth}`;

    // Fetch total income for current month
    const incomeRef = ref(database, `users/${user.uid}/incomes`);
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
    const expensesRef = ref(database, `users/${user.uid}/expenses`);
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

    // Check if adding this savings amount exceeds total income
    const deficit = totalExpenses + parsedAmount - totalIncome;
    if (deficit > 0) {
      // Show income exceeded modal
      const shouldProceed = await new Promise((resolve) => {
        setIncomeExceededData({
          totalIncome,
          totalExpenses,
          newExpense: parsedAmount,
          onProceed: () => resolve(true),
          onCancel: () => resolve(false),
        });
        setShowIncomeExceededModal(true);
      });
      if (!shouldProceed) return;
    }

    try {
      await update(ref(database, `users/${user.uid}/savingsGoals/${currentGoal.id}`), {
        savedAmount: convertToPKR(newTotal)
      });
      if (newTotal >= targetAmount) {
        Alert.alert('Congratulations!', `🎉 You have reached your goal: ${currentGoal.goalName}! 🎉`);
      }

      // Determine the date and time for the savings expense to position it correctly
      const today = new Date();
      const savingsDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      const savingsTime = '23:59:59';

      // Automatically create a view-only expense entry for the savings amount
      await push(ref(database, `users/${user.uid}/expenses`), {
        title: '',
        amount: parsedAmount.toString(),
        category: 'Savings',
        note: `Savings for ${currentGoal.goalName}`,
        date: savingsDate,
        time: savingsTime,
        isSavingsExpense: true,
        goalId: currentGoal.id,
      });

      setUpdateModalVisible(false);
      setCurrentGoal(null);
      setNewSavedAmount('');
    } catch (error) {
      Alert.alert('Error', 'Failed to update saved amount: ' + error.message);
    }
  };

  // Load wishlist
  useEffect(() => {
    if (!user) return;
    const wishlistRef = ref(database, `users/${user.uid}/wishlist`);
    onValue(wishlistRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedItems = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setWishlist(loadedItems);
      } else {
        setWishlist([]);
      }
    });
  }, [user]);

  // Load savings goals
  useEffect(() => {
    if (!user) return;
    const savingsRef = ref(database, `users/${user.uid}/savingsGoals`);
    onValue(savingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedGoals = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        }));
        const active = loadedGoals.filter(goal => (goal.savedAmount || 0) < goal.targetAmount);
        const completed = loadedGoals.filter(goal => (goal.savedAmount || 0) >= goal.targetAmount);
        setSavingsGoals(active);
        setCompletedGoals(completed);
      } else {
        setSavingsGoals([]);
        setCompletedGoals([]);
      }
      setLoading(false);
    });
  }, [user]);

  // --- Filter Effect ---
  // This updates whenever the goals change OR the date range changes
  useEffect(() => {
    const activeFiltered = savingsGoals.filter(goal => isGoalInSelectedRange(goal, false)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const completedFiltered = completedGoals.filter(goal => isGoalInSelectedRange(goal, true)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    setFilteredActiveGoals(activeFiltered);
    setFilteredCompletedGoals(completedFiltered);
  }, [savingsGoals, completedGoals, startDate, endDate]);


  const calculateSavingsNeeded = (goal) => {
    if (!goal.targetAmount || !goal.timeframe || !goal.durationValue) return 0;
    const target = parseFloat(goal.targetAmount);
    const duration = parseInt(goal.durationValue);
    if (duration <= 0) return 0;
    return target / duration;
  };

  const getSavingsLabel = (timeframe) => {
    if (timeframe === 'weeks') return 'Weekly';
    if (timeframe === 'months') return 'Monthly';
    if (timeframe === 'years') return 'Yearly';
    return 'Monthly'; // fallback
  };

  const calculateProgress = (goal) => {
    if (!goal.savedAmount || !goal.targetAmount) return 0;
    return Math.min((goal.savedAmount / goal.targetAmount) * 100, 100);
  };

  const addSavingsGoal = async () => {
    if (!user) {
      Alert.alert('Error', 'User not logged in');
      return;
    }
    if (!goalName.trim() || !targetAmount || !durationValue) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    const targetVal = parseFloat(targetAmount);
    const durationVal = parseInt(durationValue);
    if (isNaN(targetVal) || targetVal <= 0) {
      Alert.alert('Error', 'Target amount must be a positive number');
      return;
    }
    if (isNaN(durationVal) || durationVal <= 0) {
      Alert.alert('Error', 'Duration must be a positive integer');
      return;
    }

    try {
      await push(ref(database, `users/${user.uid}/savingsGoals`), {
        goalName: goalName.trim(),
        targetAmount: convertToPKR(targetVal),
        timeframe,
        durationValue: durationVal,
        savedAmount: 0,
        monthlySavingPercent: parseInt(monthlySavingPercent) || 0,
        selectedIncomeCategories: selectedIncomeCategories,
        linkedWishId,
        createdAt: new Date().toISOString()
      });
      Alert.alert('Success', 'Savings goal added');
      setGoalName('');
      setTargetAmount('');
      setDurationValue('');
      setMonthlySavingPercent('');
      setTimeframe('months');
      setLinkedWishId(null);
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to add goal: ' + error.message);
    }
  };

  const deleteGoal = (id) => {
    Alert.alert(
      'Delete Goal',
      'Are you sure you want to delete this savings goal? This will refund the saved amounts back to your total balance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              // Fetch all expenses to find savings expenses for this goal
              const expensesRef = ref(database, `users/${user.uid}/expenses`);
              const expensesSnapshot = await get(expensesRef);
              if (expensesSnapshot.exists()) {
                const expenses = expensesSnapshot.val();
                const savingsExpensesToDelete = Object.keys(expenses).filter(key =>
                  (expenses[key].isSavingsExpense === true || expenses[key].isSavingsExpense === 'true') && expenses[key].goalId == id
                );
                // Refund budgets for each savings expense before removing
                for (const expenseKey of savingsExpensesToDelete) {
                  const expenseData = expenses[expenseKey];
                  const amountToRefund = parseFloat(expenseData.amount || 0);
                  const category = expenseData.category.trim().toLowerCase();
                  const budgetsRef = ref(database, `users/${user.uid}/budgets`);
                  const budgetSnapshot = await get(budgetsRef);
                  if (budgetSnapshot.exists()) {
                    const budgetsData = budgetSnapshot.val();
                    for (const budgetId in budgetsData) {
                      const budgetCategory = budgetsData[budgetId].category.trim().toLowerCase();
                      if (budgetCategory === category) {
                        const budgetRef = ref(database, `/users/${user.uid}/budgets/${budgetId}`);
                        const budgetSnap = await get(budgetRef);
                        if (budgetSnap.exists()) {
                          const budgetData = budgetSnap.val();
                          const currentUsed = budgetData.used || 0;
                          const newUsed = Math.max(0, currentUsed - amountToRefund);
                          await update(budgetRef, { used: newUsed });
                        }
                      }
                    }
                  }
                }
                // Remove each savings expense for this goal
                for (const expenseKey of savingsExpensesToDelete) {
                  await remove(ref(database, `users/${user.uid}/expenses/${expenseKey}`));
                }
              }
              // Now delete the goal
              await remove(ref(database, `users/${user.uid}/savingsGoals/${id}`));
              Alert.alert('Success', 'Savings goal deleted and amounts refunded.');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete goal: ' + error.message);
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  const handleEditGoal = async () => {
    if (!editingGoal) return;
    if (!editGoalName.trim() || !editTargetAmount || !editDurationValue) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    const targetVal = parseFloat(editTargetAmount);
    const durationVal = parseInt(editDurationValue);
    if (isNaN(targetVal) || targetVal <= 0) {
      Alert.alert('Error', 'Target amount must be a positive number');
      return;
    }
    if (isNaN(durationVal) || durationVal <= 0) {
      Alert.alert('Error', 'Duration must be a positive integer');
      return;
    }

    try {
      await update(ref(database, `users/${user.uid}/savingsGoals/${editingGoal.id}`), {
        goalName: editGoalName.trim(),
        targetAmount: convertToPKR(targetVal),
        timeframe: editTimeframe,
        durationValue: durationVal,
        monthlySavingPercent: parseInt(editMonthlySavingPercent) || 0,
        selectedIncomeCategories: editSelectedIncomeCategories,
        linkedWishId: editLinkedWishId,
      });
      Alert.alert('Success', 'Savings goal updated');
      setEditModalVisible(false);
      setEditingGoal(null);
      setEditGoalName('');
      setEditTargetAmount('');
      setEditDurationValue('');
      setEditMonthlySavingPercent('');
      setEditTimeframe('months');
      setEditLinkedWishId(null);
      setEditSelectedIncomeCategories([]);
    } catch (error) {
      Alert.alert('Error', 'Failed to update goal: ' + error.message);
    }
  };

  const styles = getStyles(isDarkMode, themeColors);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Savings Goals</Text>
          <TouchableOpacity
            style={[styles.addButton, !isCurrentMonth && styles.disabledButton]}
            onPress={() => {
              if (!isCurrentMonth) {
                Alert.alert('Restricted', 'You can only add savings goals for the current month.');
                return;
              }
              setModalVisible(true);
            }}
          >
            <MaterialCommunityIcons name="plus" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading...</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {filteredActiveGoals.length === 0 && filteredCompletedGoals.length === 0 ? (
            <Text style={styles.emptyText}>No savings goals found.</Text>
          ) : (
            <>
              {/* Active Goals Section */}
              {filteredActiveGoals.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Active Goals</Text>
                  {filteredActiveGoals.map((item) => {
                    const savingsNeeded = calculateSavingsNeeded(item);
                    const savingsLabel = getSavingsLabel(item.timeframe);
                    const progressPercent = calculateProgress(item);
                    const linkedWish = wishlist.find(w => w.id === item.linkedWishId);

                    return (
                      <View key={item.id} style={styles.card}>
                        <View style={styles.cardHeader}>
                          <Text style={styles.cardTitle}>{item.goalName}</Text>
                          <View style={styles.cardActions}>
                            <TouchableOpacity onPress={() => openEditModal(item)} style={styles.editButton}>
                              <MaterialCommunityIcons name="pencil" size={22} color="blue" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteGoal(item.id)} style={styles.deleteButton}>
                              <MaterialCommunityIcons name="delete" size={22} color="red" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        {linkedWish && (
                          <Text style={styles.linkedWishText}>Linked Wish: {linkedWish.name}</Text>
                        )}
                        <Text style={{color: themeColors.primary}}><Text style={{fontWeight: 'bold'}}>Target Amount:</Text> {formatAmount(convertFromPKR(item.targetAmount))} {currency}</Text>
                        <Text style={{color: themeColors.primary}}><Text style={{fontWeight: 'bold'}}>Timeframe:</Text> {item.durationValue} {item.timeframe}</Text>
                        <Text style={{color: themeColors.primary}}><Text style={{fontWeight: 'bold'}}>Estimated {savingsLabel} Savings Needed:</Text> {formatAmount(savingsNeeded)} {currency}</Text>
                        <Text style={{color: themeColors.primary}}><Text style={{fontWeight: 'bold'}}>Percentage from Income:</Text> {item.monthlySavingPercent || 0}% {item.selectedIncomeCategories && item.selectedIncomeCategories.length > 0 ? `(${item.selectedIncomeCategories.join(', ')})` : ''}</Text>
                        <View style={styles.progressBarBackground}>
                          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                        </View>
                        <Text style={{color: themeColors.primary}}><Text style={{fontWeight: 'bold'}}>Progress:</Text> {progressPercent.toFixed(1)}%</Text>
                        <Text style={{color: themeColors.primary}}><Text style={{fontWeight: 'bold'}}>Remaining Amount:</Text> {formatAmount(convertFromPKR(item.targetAmount - item.savedAmount))} {currency}</Text>

                        <TouchableOpacity style={styles.updateSavedAmountButton} onPress={() => openUpdateModal(item)}>
                          <Text style={styles.updateSavedAmountText}>Add Saved Amount</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </>
              )}

              {/* Completed Goals Section */}
              {filteredCompletedGoals.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Completed Goals</Text>
                  {filteredCompletedGoals.map((item) => {
                    const linkedWish = wishlist.find(w => w.id === item.linkedWishId);

                    return (
                      <View key={item.id} style={[styles.card, styles.completedCard]}>
                        <View style={styles.cardHeader}>
                          <Text style={[styles.cardTitle, styles.completedTitle]}>{item.goalName}</Text>
                          <TouchableOpacity onPress={() => deleteGoal(item.id)} style={styles.deleteButton}>
                            <MaterialCommunityIcons name="delete" size={22} color="red" />
                          </TouchableOpacity>
                        </View>
                        {linkedWish && (
                          <Text style={styles.linkedWishText}>Linked Wish: {linkedWish.name}</Text>
                        )}
                        <Text style={{color: themeColors.primary}}><Text style={{fontWeight: 'bold'}}>Target Amount:</Text> {formatAmount(convertFromPKR(item.targetAmount))} {currency}</Text>
                        <Text style={{color: themeColors.primary}}><Text style={{fontWeight: 'bold'}}>Saved Amount:</Text> {formatAmount(convertFromPKR(item.savedAmount))} {currency}</Text>
                        <Text style={styles.completedText}>Goal Achieved!</Text>
                      </View>
                    );
                  })}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Modal for updating saved amount */}
      <Modal visible={updateModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Saved Amount</Text>

            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={newSavedAmount}
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9.]/g, '');
                const parts = numericValue.split('.');
                if (parts.length > 2) {
                  setNewSavedAmount(parts[0] + '.' + parts.slice(1).join(''));
                } else {
                  setNewSavedAmount(numericValue);
                }
              }}
              placeholder="Enter amount saved"
              placeholderTextColor="#aaa"
              autoCorrect={false}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.button} onPress={handleSaveUpdatedAmount}>
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setUpdateModalVisible(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Savings Goal</Text>
            
            <Text style={styles.label}>Goal Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Trip, Laptop, Emergency Fund"
              value={goalName}
              onChangeText={setGoalName}
              placeholderTextColor="#aaa"
              autoCorrect={false}
            />
            
            <Text style={styles.label}>Target Amount ({currency}) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={targetAmount}
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9.]/g, '');
                const parts = numericValue.split('.');
                if (parts.length > 2) {
                  setTargetAmount(parts[0] + '.' + parts.slice(1).join(''));
                } else {
                  setTargetAmount(numericValue);
                }
              }}
              placeholderTextColor="#aaa"
              autoCorrect={false}
            />
            
            <Text style={styles.label}>Duration *</Text>
            <View style={styles.durationRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 10 }]}
                keyboardType="numeric"
                value={durationValue}
                onChangeText={(text) => {
                  const numericValue = text.replace(/[^0-9]/g, '');
                  setDurationValue(numericValue);
                }}
                placeholderTextColor="#aaa"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.durationOption}
                onPress={() => setTimeframe('weeks')}
              >
                <Text style={timeframe === 'weeks' ? styles.durationSelected : styles.durationText}>Weeks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.durationOption}
                onPress={() => setTimeframe('months')}
              >
                <Text style={timeframe === 'months' ? styles.durationSelected : styles.durationText}>Months</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.durationOption}
                onPress={() => setTimeframe('years')}
              >
                <Text style={timeframe === 'years' ? styles.durationSelected : styles.durationText}>Years</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>Percentage from Income (%)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={monthlySavingPercent}
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9]/g, '');
                setMonthlySavingPercent(numericValue);
              }}
              placeholder="e.g. 10"
              placeholderTextColor="#aaa"
              autoCorrect={false}
            />

            <Text style={styles.label}>Apply to Income Categories</Text>
            <View style={styles.categoryWrap}>
              {['Salary', 'Bonus', 'Freelance', 'Business', 'Gift', 'Interest', 'Other'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catBox,
                    selectedIncomeCategories.includes(cat) && styles.catBoxSelected,
                  ]}
                  onPress={() => {
                    if (selectedIncomeCategories.includes(cat)) {
                      setSelectedIncomeCategories(selectedIncomeCategories.filter(c => c !== cat));
                    } else {
                      setSelectedIncomeCategories([...selectedIncomeCategories, cat]);
                    }
                  }}
                >
                  <Text style={{ color: selectedIncomeCategories.includes(cat) ? '#fff' : themeColors.primary }}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Link to Wishlist Item (Optional)</Text>
            <ScrollView style={styles.wishlistSelector} nestedScrollEnabled={true}>
              {wishlist.length === 0 ? (
                <Text style={styles.emptyText}>No wishlist items available.</Text>
              ) : (
                wishlist.map((wish) => (
                  <TouchableOpacity
                    key={wish.id}
                    style={[
                      styles.wishItem,
                      linkedWishId === wish.id && styles.wishSelected
                    ]}
                    onPress={() => {
                      if (linkedWishId === wish.id) {
                        setLinkedWishId(null);
                      } else {
                        setLinkedWishId(wish.id);
                      }
                    }}
                  >
                    <Text style={styles.wishText}>{wish.name} - {formatAmount(convertFromPKR(wish.amount))} {currency}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.button} onPress={addSavingsGoal}>
                <Text style={styles.buttonText}>Save Goal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setModalVisible(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            
          </ScrollView>
        </View>
      </Modal>

      {/* Modal for editing goal */}
      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Savings Goal</Text>

            <Text style={styles.label}>Goal Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Trip, Laptop, Emergency Fund"
              value={editGoalName}
              onChangeText={setEditGoalName}
              placeholderTextColor="#aaa"
              autoCorrect={false}
            />

            <Text style={styles.label}>Target Amount ({currency}) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={editTargetAmount}
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9.]/g, '');
                const parts = numericValue.split('.');
                if (parts.length > 2) {
                  setEditTargetAmount(parts[0] + '.' + parts.slice(1).join(''));
                } else {
                  setEditTargetAmount(numericValue);
                }
              }}
              placeholderTextColor="#aaa"
              autoCorrect={false}
            />

            <Text style={styles.label}>Duration *</Text>
            <View style={styles.durationRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 10 }]}
                keyboardType="numeric"
                value={editDurationValue}
                onChangeText={(text) => {
                  const numericValue = text.replace(/[^0-9]/g, '');
                  setEditDurationValue(numericValue);
                }}
                placeholderTextColor="#aaa"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.durationOption}
                onPress={() => setEditTimeframe('weeks')}
              >
                <Text style={editTimeframe === 'weeks' ? styles.durationSelected : styles.durationText}>Weeks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.durationOption}
                onPress={() => setEditTimeframe('months')}
              >
                <Text style={editTimeframe === 'months' ? styles.durationSelected : styles.durationText}>Months</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.durationOption}
                onPress={() => setEditTimeframe('years')}
              >
                <Text style={editTimeframe === 'years' ? styles.durationSelected : styles.durationText}>Years</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Percentage from Income (%)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={editMonthlySavingPercent}
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9]/g, '');
                setEditMonthlySavingPercent(numericValue);
              }}
              placeholder="e.g. 10"
              placeholderTextColor="#aaa"
              autoCorrect={false}
            />

            <Text style={styles.label}>Apply to Income Categories</Text>
            <View style={styles.categoryWrap}>
              {['Salary', 'Bonus', 'Freelance', 'Business', 'Gift', 'Interest', 'Other'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catBox,
                    editSelectedIncomeCategories.includes(cat) && styles.catBoxSelected,
                  ]}
                  onPress={() => {
                    if (editSelectedIncomeCategories.includes(cat)) {
                      setEditSelectedIncomeCategories(editSelectedIncomeCategories.filter(c => c !== cat));
                    } else {
                      setEditSelectedIncomeCategories([...editSelectedIncomeCategories, cat]);
                    }
                  }}
                >
                  <Text style={{ color: editSelectedIncomeCategories.includes(cat) ? '#fff' : themeColors.primary }}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Link to Wishlist Item (Optional)</Text>
            <ScrollView style={styles.wishlistSelector} nestedScrollEnabled={true}>
              {wishlist.length === 0 ? (
                <Text style={styles.emptyText}>No wishlist items available.</Text>
              ) : (
                wishlist.map((wish) => (
                  <TouchableOpacity
                    key={wish.id}
                    style={[
                      styles.wishItem,
                      editLinkedWishId === wish.id && styles.wishSelected
                    ]}
                    onPress={() => {
                      if (editLinkedWishId === wish.id) {
                        setEditLinkedWishId(null);
                      } else {
                        setEditLinkedWishId(wish.id);
                      }
                    }}
                  >
                    <Text style={styles.wishText}>{wish.name} - {formatAmount(convertFromPKR(wish.amount))} {currency}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.button} onPress={handleEditGoal}>
                <Text style={styles.buttonText}>Update Goal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </Modal>

      {/* Modal for income exceeded alert */}
      <Modal visible={showIncomeExceededModal} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Income Exceeded</Text>
            <Text style={{ color: themeColors.primary, fontFamily: 'serif', fontSize: 16, marginBottom: 10 }}>
              Adding this savings amount will exceed your total income for the month.
            </Text>
            <Text style={{ color: themeColors.primary, fontFamily: 'serif', fontSize: 16, marginBottom: 5 }}>
              <Text style={{ fontWeight: 'bold' }}>Total Income:</Text> {formatAmount(incomeExceededData.totalIncome)} {currency}
            </Text>
            <Text style={{ color: themeColors.primary, fontFamily: 'serif', fontSize: 16, marginBottom: 5 }}>
              <Text style={{ fontWeight: 'bold' }}>Total Expenses:</Text> {formatAmount(incomeExceededData.totalExpenses)} {currency}
            </Text>
            <Text style={{ color: themeColors.primary, fontFamily: 'serif', fontSize: 16, marginBottom: 20 }}>
              <Text style={{ fontWeight: 'bold' }}>New Savings Amount:</Text> {formatAmount(incomeExceededData.newExpense)} {currency}
            </Text>
            <Text style={{ color: themeColors.primary, fontFamily: 'serif', fontSize: 16, marginBottom: 20 }}>
              <Text style={{ fontWeight: 'bold' }}>After Adding:</Text> {formatAmount(incomeExceededData.totalExpenses + incomeExceededData.newExpense)} {currency} (Exceeds income by {formatAmount((incomeExceededData.totalExpenses + incomeExceededData.newExpense) - incomeExceededData.totalIncome)} {currency})
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  setShowIncomeExceededModal(false);
                  incomeExceededData.onProceed();
                }}
              >
                <Text style={styles.buttonText}>Proceed</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setShowIncomeExceededModal(false);
                  incomeExceededData.onCancel();
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

export default SavingsGoalsScreen;

const getStyles = (isDarkMode, themeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: isDarkMode ? '#121212' : '#F9F9F9',
  },
  header: {
    flexDirection: 'row',
    padding: 18,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    marginTop: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'serif',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  addButton: {
    backgroundColor: themeColors.third,
    borderRadius: 30,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#cccbcbff',
    opacity: 0.5,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'serif',
    color: isDarkMode ? '#ccc' : '#666',
    fontStyle: 'italic',
  },
  emptyText: {
    marginTop: 40,
    textAlign: 'center',
    fontSize: 18,
    fontStyle: 'italic',
    color: isDarkMode ? '#aaa' : '#888',
    fontFamily: 'serif',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 15,
    borderRadius: 15,
    borderColor: themeColors.primary,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    color: themeColors.primary,
    fontFamily: 'serif',
    flex: 1,
    textShadowColor: 'rgba(128, 0, 128, 0.3)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  cardActions: {
    flexDirection: 'row',
  },
  editButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: isDarkMode ? '#2A4A4A' : '#e0f0ff',
    marginRight: 8,
  },
  deleteButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: isDarkMode ? '#4A2A2A' : '#fff0f0',
  },
  linkedWishText: {
    marginTop: 5,
    marginBottom: 5,
    fontStyle: 'italic',
    color: themeColors.primary,
    fontFamily: 'serif',
    fontSize: 16,
  },
  progressBarBackground: {
    backgroundColor: '#ddd',
    height: 12,
    borderRadius: 6,
    marginVertical: 8,
  },
  progressBarFill: {
    backgroundColor: themeColors.secondary,
    height: 12,
    borderRadius: 6,
  },
  label: {
    color: themeColors.primary,
    fontWeight: 'bold',
    fontFamily: 'serif',
    marginBottom: 6,
    marginTop: 15,
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: themeColors.primary,
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
    color: themeColors.primary,
    fontFamily: 'serif',
    backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  durationOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: themeColors.primary,
  },
  durationText: {
    color: themeColors.primary,
    fontFamily: 'serif',
    fontSize: 16,
  },
  durationSelected: {
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'serif',
    backgroundColor: themeColors.primary,
    borderRadius: 15,
    paddingVertical: 2,
    paddingHorizontal: 8,
    overflow: 'hidden',
    fontSize: 16,
  },
  wishlistSelector: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: themeColors.primary,
    borderRadius: 8,
    backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
    marginTop: 5,
  },
  wishItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  wishSelected: {
    backgroundColor: '#f1c5f1ff',
  },
  wishText: {
    color: themeColors.primary,
    fontFamily: 'serif',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
    marginTop: 30,
    marginBottom: 80,
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: themeColors.primary,
    fontFamily: 'serif',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(128, 0, 128, 0.3)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 25,
  },
  button: {
    backgroundColor: themeColors.primary,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    marginHorizontal: 5,
    shadowColor: themeColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  cancelButton: {
    backgroundColor: themeColors.secondary
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'serif',
    textAlign: 'center',
  },
  updateSavedAmountButton: {
    backgroundColor: themeColors.primary,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  updateSavedAmountText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: 'serif',
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
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
  },
  catBoxSelected: {
    backgroundColor: themeColors.primary,
    borderColor: themeColors.primary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: themeColors.primary,
    fontFamily: 'serif',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    textShadowColor: 'rgba(128, 0, 128, 0.3)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  completedCard: {
    backgroundColor: isDarkMode ? '#1A4A1A' : '#E8F5E8',
    borderColor: '#4CAF50',
  },
  completedTitle: {
    color: '#4CAF50',
  },
  completedText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    fontFamily: 'serif',
    textAlign: 'center',
    marginTop: 10,
  },
});