//HomeScreen

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, getDatabase, off, onValue, ref, remove, update } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { app, auth, database } from '../../firebaseConfig';

const categoryIcons = {
  Food: 'food',
  Social: 'account-group',
  Traffic: 'car',
  Shopping: 'shopping',
  Grocery: 'cart',
  Education: 'book',
  Bills: 'file-document',
  Rentals: 'home-city',
  Medical: 'hospital-box',
  Investment: 'chart-bar',
  Gift: 'gift',
  Other: 'dots-horizontal',
};

import { useAppContext } from '../../AppContext';

// Helper function to get local date string in YYYY-MM-DD format
const getLocalDateString = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const HomeScreen = () => {
  const router = useRouter();
  const { currency, formatAmount, isDarkMode } = useAppContext();
  const [activeScreen, setActiveScreen] = useState('home');
  const [activeTab, setActiveTab] = useState('expenses');
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [expandedItems, setExpandedItems] = useState({});
  const { type } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(null); // 0-11
  const [selectedDate, setSelectedDate] = useState(null); // day of month or null
  const [selectedDateRange, setSelectedDateRange] = useState(() => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: getLocalDateString(startDate),
      endDate: getLocalDateString(endDate)
    };
  });
  const [currentMonthText, setCurrentMonthText] = useState(() => {
    const now = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  });
  // For override filter to show expenses of a specific month/year ignoring global date filter
  const [expensesMonthOverride, setExpensesMonthOverride] = useState(null); // {month: 1-12, year: number} or null

  // Function to handle month selection
  const handleMonthSelect = (monthIndex) => {
    setSelectedMonth(monthIndex);
    setSelectedDate(null); // Clear date if month is selected
  };

  // Function to handle date selection from calendar
  const handleDateSelect = (day) => {
    const selectedDateObj = new Date(day.dateString);
    setSelectedDate(selectedDateObj.getDate());
    setSelectedMonth(selectedDateObj.getMonth());
  };

  // Function to apply filter
  const applyFilter = () => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    if (selectedDate !== null) {
      // Specific date filter
      const dateObj = new Date(currentYear, selectedMonth, selectedDate);
      const dateStr = getLocalDateString(dateObj);
      setSelectedDateRange({
        startDate: dateStr,
        endDate: dateStr
      });
      setCurrentMonthText(`${monthNames[selectedMonth]} ${selectedDate}, ${currentYear} `);
    } else if (selectedMonth !== null) {
      // Month filter
      const startDate = new Date(currentYear, selectedMonth, 1);
      const endDate = new Date(currentYear, selectedMonth + 1, 0);
      setSelectedDateRange({
        startDate: getLocalDateString(startDate),
        endDate: getLocalDateString(endDate)
      });
      setCurrentMonthText(`${monthNames[selectedMonth]} ${currentYear} `);
    }

    setShowFilterModal(false);
    setExpensesMonthOverride(null);
  };

  // Function to clear filter and reset to current month
  const clearFilter = () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setSelectedDateRange({
      startDate: getLocalDateString(startDate),
      endDate: getLocalDateString(endDate)
    });
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    setCurrentMonthText(`${monthNames[now.getMonth()]} ${now.getFullYear()} `);
    setSelectedMonth(null);
    setSelectedDate(null);
    setShowFilterModal(false);
    setExpensesMonthOverride(null);
  };

  useEffect(() => {
    if (type === 'income' || type === 'expense') {
      setActiveTab(type);
    }
  }, [type]);

  useEffect(() => {
    const db = getDatabase(app);
    const userId = auth.currentUser?.uid || 'guest';
    const incomeRef = ref(db, `/users/${userId}/incomes`);

    const handleIncome = (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const parsed = Object.entries(data).map(([key, value]) => ({
          ...value,
          firebaseKey: key,
        }));
        setIncome(parsed);
      } else {
        setIncome([]);
      }
    };

    onValue(incomeRef, handleIncome);

    return () => off(incomeRef, 'value', handleIncome);
  }, []);

  useEffect(() => {
    const userId = auth.currentUser?.uid || 'guest';
    const dbRef = ref(database, `/users/${userId}/expenses`);

    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const parsed = Object.entries(data).map(([key, value]) => ({
          ...value,
          firebaseKey: key,
        }));
        setExpenses(parsed);
      } else {
        setExpenses([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const toggleNote = (id) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const clearAsyncStorage = async () => {
    try {
      await AsyncStorage.clear();
      console.log('✅ Storage cleared');
    } catch (e) {
      console.log('❌ Error clearing AsyncStorage:', e);
    }
  };

  const deleteItem = (firebaseKey, type) => {
    const userId = auth.currentUser?.uid || 'guest';
    const deleteRef = ref(database, `/users/${userId}/${type}/${firebaseKey}`);

    // Find the item to get its details for budget update
    const itemToDelete = list.find(item => item.firebaseKey === firebaseKey);

    const confirmAndDelete = () => {
      remove(deleteRef)
        .then(async () => {
          // If it's an expense, refund amount to associated budgets
          if (type === 'expenses') {
            const amountToRefund = parseFloat(itemToDelete.amount || 0);
            if (itemToDelete?.budgetIds && Array.isArray(itemToDelete.budgetIds)) {
              // Use stored budgetIds
              for (const budgetId of itemToDelete.budgetIds) {
                const budgetRef = ref(database, `/users/${userId}/budgets/${budgetId}`);
                const budgetSnapshot = await get(budgetRef);
                if (budgetSnapshot.exists()) {
                  const budgetData = budgetSnapshot.val();
                  const currentUsed = budgetData.used || 0;
                  const newUsed = Math.max(0, currentUsed - amountToRefund);
                  await update(budgetRef, { used: newUsed });
                }
              }
            } else {
              // Fallback: find budgets by category
              const budgetsRef = ref(database, `users/${userId}/budgets`);
              const snapshot = await get(budgetsRef);
              if (snapshot.exists()) {
                const budgetsData = snapshot.val();
                const category = itemToDelete.category.trim().toLowerCase();
                console.log('Delete expense category:', category);
                for (const budgetId in budgetsData) {
                  const budgetCategory = budgetsData[budgetId].category.trim().toLowerCase();
                  console.log('Budget category:', budgetCategory, 'for budgetId:', budgetId);
                  if (budgetCategory === category) {
                    const budgetRef = ref(database, `/users/${userId}/budgets/${budgetId}`);
                    const budgetSnapshot = await get(budgetRef);
                    if (budgetSnapshot.exists()) {
                      const budgetData = budgetSnapshot.val();
                      const currentUsed = budgetData.used || 0;
                      const newUsed = Math.max(0, currentUsed - amountToRefund);
                      await update(budgetRef, { used: newUsed });
                      console.log('Refunded to budget:', budgetId, 'new used:', newUsed);
                    }
                  }
                }
              }
            }
          }

          const successMsg = `${type === 'expenses' ? 'Expense' : 'Income'} deleted successfully.`;
          if (Platform.OS === 'web') {
            window.alert(successMsg);
          } else {
            Alert.alert('Deleted', successMsg);
          }
        })
        .catch((err) => {
          const errorMsg = err.message;
          if (Platform.OS === 'web') {
            window.alert('Error: ' + errorMsg);
          } else {
            Alert.alert('Error', errorMsg);
          }
        });
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Do you want to delete this ${type.slice(0, -1)}?`)) {
        confirmAndDelete();
      }
    } else {
      Alert.alert(
        'Confirm Deletion',
        `Do you want to delete this ${type.slice(0, -1)}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: confirmAndDelete },
        ],
        { cancelable: true }
      );
    }
  };

  const groupedByDate = {};
  const list = activeTab === 'expenses' ? expenses : income;
  const sortedList = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
  sortedList.forEach(item => {
    const date = new Date(item.date);
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const label = date.toLocaleDateString(undefined, options);
    if (!groupedByDate[label]) groupedByDate[label] = [];
    groupedByDate[label].push(item);
  });

  // Helper function to check if a date matches the override month/year
  const isInOverrideMonth = (dateStr) => {
    if (!expensesMonthOverride) return true;
    const date = new Date(dateStr);
    const month = date.getMonth();
    const year = date.getFullYear();
    return month === (expensesMonthOverride.month - 1) && year === expensesMonthOverride.year;
  };

  // Helper function to check if date is within filter range
  const isWithinSelectedDateRange = (dateStr) => {
    if (!selectedDateRange.startDate || !selectedDateRange.endDate) return true;
    const itemDate = new Date(dateStr);
    const startDate = new Date(selectedDateRange.startDate);
    const endDate = new Date(selectedDateRange.endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    itemDate.setHours(0, 0, 0, 0);
    return itemDate >= startDate && itemDate <= endDate;
  };

  // Sum of income within the selected date range or override if set (or all if no filter)
  const incomeTotal = income
    .filter(item => {
      if (expensesMonthOverride) {
        const date = new Date(item.date);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        return month === expensesMonthOverride.month && year === expensesMonthOverride.year;
      }
      return isWithinSelectedDateRange(item.date);
    })
    .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

  // Sum of expenses considering override or date filter
  const expenseTotal = expenses
    .filter(item => (expensesMonthOverride ? isInOverrideMonth(item.date) : isWithinSelectedDateRange(item.date)))
    .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

  const totalBalance = incomeTotal - expenseTotal;

  // List for rendering considering override or date filter and search filter
  const filteredList = list.filter(item => 
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // New function to handle when income item is clicked to show all expenses of that month
  const handleIncomeClick = (item) => {
    const date = new Date(item.date);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    setExpensesMonthOverride({ month, year });
    setActiveTab('expenses');
    setCurrentMonthText(`Expenses for ${month}/${year} `);
  };

  const renderGroupedExpenses = () => {
    const groupedData = {};
    let itemsToRender = searchQuery ? filteredList : sortedList;

    // Apply override month filter for expensesMonthOverride
    if (expensesMonthOverride) {
      itemsToRender = itemsToRender.filter(item => {
        const date = new Date(item.date);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        return month === expensesMonthOverride.month && year === expensesMonthOverride.year;
      });
    }

    // Apply date filter if dates are selected
    if (selectedDateRange.startDate && selectedDateRange.endDate) {
      itemsToRender = itemsToRender.filter((item) => {
        const itemDate = new Date(item.date);
        const startDate = new Date(selectedDateRange.startDate);
        const endDate = new Date(selectedDateRange.endDate);

        // Set time to midnight for proper date comparison
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        itemDate.setHours(0, 0, 0, 0);

        console.log('Filtering:', {
          itemDate: getLocalDateString(itemDate),
          startDate: getLocalDateString(startDate),
          endDate: getLocalDateString(endDate),
          originalItemDate: item.date,
          isInRange: itemDate >= startDate && itemDate <= endDate,
        });

        return itemDate >= startDate && itemDate <= endDate;
      });
    }

    itemsToRender.forEach((item) => {
      const date = new Date(item.date);
      const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
      const label = date.toLocaleDateString(undefined, options);
      if (!groupedData[label]) groupedData[label] = [];
      groupedData[label].push(item);
    });

    return Object.entries(groupedData).map(([dateLabel, items]) => (
      <View key={dateLabel}>
        <Text style={styles.dateGroupLabel}>{dateLabel}</Text>
        {items.map((item) => (
          <TouchableOpacity
            key={item.firebaseKey}
            onPress={() => {
              if (activeTab === 'income') {
                handleIncomeClick(item);
              } else {
                toggleNote(item.firebaseKey);
              }
            }}
            style={styles.expenseItem}
            activeOpacity={0.9}
          >
            <View style={styles.expenseLeft}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons
                  name={categoryIcons[item.category] || 'wallet'}
                  size={20}
                  color="#fff"
                />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.expenseCategory}>{item.category}</Text>
                <Text style={styles.expenseTime}>{item.time}</Text>
                {expandedItems[item.firebaseKey] && item.note ? (
                  <Text style={styles.expenseNote}>Note: {item.note}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.expenseRight}>
              <Text
                style={[
                  styles.expenseAmount,
                  activeTab === 'income' && { color: 'green' },
                ]}
              >
                {activeTab === 'expenses' ? '-' : '+'}
                {formatAmount(item.amount)}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => {
                    router.push({
                      pathname: activeTab === 'expenses' ? '/addexpense' : '/addincome',
                      params: { ...item },
                    });
                  }}
                  style={styles.editButton}
                >
                  <MaterialCommunityIcons name="pencil" size={20} color="#003366" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteItem(item.firebaseKey, activeTab === 'expenses' ? 'expenses' : 'incomes')}
                  style={styles.deleteButton}
                >
                  <MaterialCommunityIcons name="delete" size={20} color="red" />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    ));
  };

  const styles = getStyles(isDarkMode);

  return (
    <>
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.filterModalContainer}>
            <View style={styles.filterModalTitleContainer}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.filterModalTitle}>{currentMonthText}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDateModal(true)} style={styles.titleCalendarIcon}>
                <MaterialCommunityIcons name="calendar" size={24} color={isDarkMode ? '#fff' : '#003366'} />
              </TouchableOpacity>
            </View>

            <View style={styles.yearNavigation}>
              <TouchableOpacity onPress={() => setCurrentYear(currentYear - 1)}>
                <Text style={styles.navigationButton}>{'<'}</Text>
              </TouchableOpacity>
              <View style={styles.yearContainer}>
                <Text style={styles.yearText}>{currentYear}</Text>
              </View>
              <TouchableOpacity onPress={() => setCurrentYear(currentYear + 1)}>
                <Text style={styles.navigationButton}>{'>'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.monthsGrid}>
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => (
                <TouchableOpacity
                  key={month}
                  onPress={() => handleMonthSelect(index)}
                  style={[
                    styles.monthButton,
                    selectedMonth === index && styles.selectedMonthButton
                  ]}
                >
                  <Text style={[
                    styles.monthText,
                    selectedMonth === index && styles.selectedMonthText
                  ]}>
                    {month}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>



            <View style={styles.filterButtons}>
              <TouchableOpacity onPress={clearFilter} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Clear Filter</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyFilter} style={styles.applyButton}>
                <Text style={styles.applyButtonText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.dateModalContainer}>
            <Calendar
              current={`${currentYear}-${String(selectedMonth !== null ? selectedMonth + 1 : new Date().getMonth() + 1).padStart(2, '0')}-01`}
              onDayPress={(day) => {
                handleDateSelect(day);
                setShowDateModal(false);
              }}
              markedDates={{
                ...(selectedDate !== null && selectedMonth !== null ? {
                  [`${currentYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`]: {
                    selected: true,
                    selectedColor: '#800080'
                  }
                } : {})
              }}
              theme={{
                backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
                calendarBackground: isDarkMode ? '#2A2A2A' : '#fff',
                textSectionTitleColor: isDarkMode ? '#fff' : '#003366',
                selectedDayBackgroundColor: '#800080',
                selectedDayTextColor: '#fff',
                todayTextColor: '#800080',
                dayTextColor: isDarkMode ? '#fff' : '#003366',
                textDisabledColor: isDarkMode ? '#555' : '#d9e1e8',
                dotColor: '#800080',
                selectedDotColor: '#fff',
                arrowColor: '#800080',
                disabledArrowColor: isDarkMode ? '#555' : '#d9e1e8',
                monthTextColor: isDarkMode ? '#fff' : '#003366',
                indicatorColor: '#800080',
                textDayFontFamily: 'serif',
                textMonthFontFamily: 'serif',
                textDayHeaderFontFamily: 'serif',
                textDayFontWeight: 'bold',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: 'bold',
                textDayFontSize: 16,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 14,
              }}
            />
            <View style={styles.calendarButtons}>
              <TouchableOpacity onPress={() => setShowDateModal(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SafeAreaView style={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image
              source={{ uri: 'https://i.pinimg.com/736x/01/33/ff/0133ffbaeb8fa0c1e881f64d0c93e571.jpg' }}
              style={styles.logo}
            />
            <Text style={styles.headerText}>BudgetMate</Text>
          </View>
          <TouchableOpacity style={styles.headerMonthButton} onPress={() => setShowFilterModal(true)}>
            <Text style={styles.headerMonthButtonText}>{currentMonthText}</Text>
            <Ionicons name="chevron-down" size={18} color="#003366" />
          </TouchableOpacity>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceText}>Total Balance</Text>
          <View style={styles.balanceAmount}>
            <Text style={styles.asterisks}>
              {balanceVisible ? formatAmount(totalBalance) : '******'}
            </Text>
            <TouchableOpacity onPress={() => setBalanceVisible(!balanceVisible)}>
              <Ionicons
                name={balanceVisible ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#F9F9F9"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'expenses' && styles.tabActive]}
            onPress={() => setActiveTab('expenses')}
          >
            <Text style={activeTab === 'expenses' ? styles.tabTextActive : styles.tabText}>
              Expenses
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'income' && styles.tabActive]}
            onPress={() => setActiveTab('income')}
          >
            <Text style={activeTab === 'income' ? styles.tabTextActive : styles.tabText}>
              Income
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.middleSection}>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {list.length > 0 ? (
            <>
              <TextInput
                style={styles.searchBar}
                placeholder="Search by category..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>
                  {activeTab === 'expenses' ? 'Total expenditure' : 'Total income'}
                </Text>
                <Text style={styles.totalAmount}>
                  {formatAmount(activeTab === 'expenses' ? expenseTotal : incomeTotal)}
                </Text>
              </View>

              {renderGroupedExpenses()}
            </>
          ) : (
            <View style={styles.emptyMessage}>
              <Image
                source={{ uri: 'https://i.ibb.co/wNcxVmf9/41f3f160-3c33-4ffe-8979-4dbaf899059e-removalai-preview.png' }}
                style={styles.emptyImage}
                resizeMode="contain"
              />
              <Text style={styles.emptyText}>
                {activeTab === 'expenses'
                  ? 'Add your first expense to get started!'
                  : 'Add your first income to begin tracking!'}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerItem}
          onPress={() => setActiveScreen('home')}
        >
          <Icon name="home" size={24} color={activeScreen === 'home' ? '#003366' : (isDarkMode ? '#ccc' : '#333')} />
          <Text style={[styles.iconLabel, activeScreen === 'home' && { color: '#003366', fontWeight: 'bold' }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerItem}
          onPress={() => router.push('/budget')}
        >
          <Icon name="cash-multiple" size={24} color={activeScreen === 'budget' ? '#003366' : (isDarkMode ? '#ccc' : '#333')} />
          <Text style={[styles.iconLabel, activeScreen === 'budget' && { color: '#003366', fontWeight: 'bold' }]}>Budget</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.plusButton}
          onPress={() => {
            if (activeTab === 'expenses') {
              router.push('/addexpense');
            } else if (activeTab === 'income') {
              router.push('/addincome');
            }
          }}
        >
          <Icon name="plus" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerItem}
          onPress={() => router.push('/statistics')}
        >
          <Icon name="chart-line" size={24} color={activeScreen === 'statistics' ? '#003366' : (isDarkMode ? '#ccc' : '#333')} />
          <Text style={[styles.iconLabel, activeScreen === 'statistics' && { color: '#003366', fontWeight: 'bold' }]}>Statistics</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerItem}
         onPress={() => router.push('/settings')}
        >
          <Icon name="cog" size={24} color={activeScreen === 'settings' ? '#003366' : (isDarkMode ? '#ccc' : '#333')} />
          <Text style={[styles.iconLabel, activeScreen === 'settings' && { color: '#003366', fontWeight: 'bold' }]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </>
  );
};

export default HomeScreen;

const getStyles = (isDarkMode) => StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: isDarkMode ? '#121212' : '#F9F9F9',
  },
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#121212' : '#F9F9F9',
  },
  topSection: {
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  middleSection: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: isDarkMode ? '#1E1E1E' : '#F5E3FF',
  },
  iconCircle: {
    backgroundColor: '#800080',
    padding: 8,
    borderRadius: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
   header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  headerText: {
    color: isDarkMode ? '#fff' : '#003366',
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'serif',
  },
  headerMonthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    borderWidth: 1,
    borderColor: '#003366',
  },
  headerMonthButtonText: {
    color: '#003366',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 6,
    fontFamily: 'serif',
  },

  dateGroupLabel: {
    fontSize: 16,
    marginTop: 20,
    marginBottom: 8,
    color: isDarkMode ? '#ccc' : '#555',
    fontWeight: 'bold',
    fontFamily: 'serif',
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    borderRadius: 12,
    marginBottom: 10,
    borderColor: isDarkMode ? '#555' : '#D3D3D3',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseCategory: {
    color: isDarkMode ? '#fff' : '#003366',
    fontWeight: 'bold',
    fontFamily: 'serif',
  },
  expenseDate: {
    color: isDarkMode ? '#ccc' : '#999',
    fontSize: 12,
    fontFamily: 'serif',
  },
  expenseAmount: {
    color: 'red',
    fontWeight: 'bold',
    fontFamily: 'serif',
  },
  expenseTime: {
    fontSize: 12,
    color: isDarkMode ? '#ccc' : '#888',
    fontFamily: 'serif',
  },
  expenseNote: {
  marginTop: 4,
  fontSize: 12,
  color: isDarkMode ? '#ccc' : '#333',
  fontStyle: 'italic',
  fontFamily: 'serif',
},
  actions: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 10,
  },
  editButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: isDarkMode ? '#3A3A3A' : '#f0f8ff',
  },
  deleteButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: isDarkMode ? '#3A3A3A' : '#fff0f0',
  },
  totalCard: {
    marginTop: 20,
    flexDirection: 'row',
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderColor: '#800880',
    borderWidth: 2,
  },
  totalLabel: {
    color: isDarkMode ? '#fff' : '#003366',
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 10,
    flex: 1,
    fontFamily: 'serif',
  },
  totalAmount: {
    color: isDarkMode ? '#fff' : '#003366',
    fontWeight: 'bold',
    fontFamily: 'serif',
  },
  balanceCard: {
    backgroundColor: '#800080',
    marginTop: 20,
    padding: 20,
    borderRadius: 15,
  },
  balanceText: {
    color: '#F9F9F9',
    fontSize: 16,
    fontFamily: 'serif',
  },
  balanceAmount: {
    flexDirection: 'row',
    marginTop: 10,
    alignItems: 'center',
    fontFamily: 'italic',
  },
  asterisks: {
    fontSize: 22,
    color: '#F9F9F9',
    letterSpacing: 2,
    fontFamily: 'serif'
  },
  tabRow: {
    flexDirection: 'row',
    marginTop: 20,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    paddingVertical: 5,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderRadius: 30,
  },
  tabActive: {
    backgroundColor: '#800080',
    borderRadius: 30,
    marginHorizontal: 4,
  },
  tabText: {
    color: isDarkMode ? '#fff' : '#003366',
    marginLeft: 6,
    fontWeight: 'bold',
    fontFamily: 'serif',
  },
  tabTextActive: {
    color: '#F9F9F9',
    marginLeft: 6,
    fontWeight: 'bold',
    fontFamily: 'serif',
  },
  emptyMessage: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyImage: {
    width: 200,
    height: 200,
    marginTop: 20,
  },
  emptyText: {
    color: isDarkMode ? '#ccc' : '#888',
    fontSize: 16,
    fontStyle: 'italic',
    fontFamily: 'serif',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
    borderTopWidth: 1,
    borderColor: isDarkMode ? '#555' : '#D3D3D3',
  },
  footerItem: {
    alignItems: 'center',
  },
  iconLabel: {
    fontSize: 12,
    color: isDarkMode ? '#ccc' : '#333',
    marginTop: 4,
    fontFamily: 'serif',
  },
  plusWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
    plusButton: {
    backgroundColor: '#800080',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
   bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
    borderTopWidth: 1,
    borderColor: isDarkMode ? '#555' : '#D3D3D3',
    marginTop: 30,
  },
  searchBar: {
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    padding: 12,
    borderRadius: 25,
    marginTop: 15,
    borderWidth: 1,
    borderColor: isDarkMode ? '#555' : '#003366',
    fontSize: 16,
    color: isDarkMode ? '#fff' : '#003366',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDarkMode 
      ? 'rgba(0, 0, 0, 0.7)' 
      : 'rgba(0, 0, 0, 0.5)',
    paddingTop: 0,   
  },
  calendarButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  clearButton: {
    backgroundColor: '#800080',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#003366',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  monthSelectorContainer: {
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  yearNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  navigationButton: {
    fontSize: 24,
    color: isDarkMode ? '#fff' : '#003366',
    paddingHorizontal: 10,
  },
  yearText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#003366',
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  monthButton: {
    width: '30%',
    padding: 10,
    marginVertical: 5,
    backgroundColor: '#800080',
    borderRadius: 8,
    alignItems: 'center',
  },
  monthText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'serif',
  },
  switchToDateButton: {
    backgroundColor: '#003366',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  switchToDateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'serif',

  },
  filterModalContainer: {
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  filterModalTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#003366',
    fontFamily: 'serif',
  },
  titleCalendarIcon: {
    padding: 5,
  },
  selectedMonthButton: {
    backgroundColor: '#003366',
  },
  selectedMonthText: {
    color: '#F9F9F9',
  },
  filterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  applyButton: {
    backgroundColor: '#003366',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dateCalendarButton: {
    backgroundColor: '#800080',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  dateCalendarButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  yearContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIcon: {
    marginLeft: 10,
    padding: 5,
  },
  dateModalContainer: {
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
});
