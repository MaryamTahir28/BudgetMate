import { getDatabase, onValue, ref } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppContext } from '../../AppContext';
import { app, auth } from '../../firebaseConfig';

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

const StatisticsScreen = () => {
  const { isDarkMode, formatAmount, currency, convertFromPKR } = useAppContext();

  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState({});
  const [netBalance, setNetBalance] = useState(0);
  const [timeFilter, setTimeFilter] = useState('monthly'); // 'weekly', 'monthly', 'yearly'
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    const userId = auth.currentUser?.uid || 'guest';
    const incomeRef = ref(getDatabase(app), `/users/${userId}/incomes`);
    const expensesRef = ref(getDatabase(app), `/users/${userId}/expenses`);

    const handleIncome = (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const parsed = Object.entries(data).map(([key, value]) => ({
          ...value,
          firebaseKey: key,
        }));
        setIncome(parsed);
        const incomeTotal = parsed.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
        setTotalIncome(incomeTotal);
        setNetBalance(incomeTotal - totalExpenses);
      }
    };

    const handleExpenses = (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const parsed = Object.entries(data).map(([key, value]) => ({
          ...value,
          firebaseKey: key,
        }));
        setExpenses(parsed);
        
        const expenseTotal = parsed.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
        setTotalExpenses(expenseTotal);
        setNetBalance(totalIncome - expenseTotal);
        
        // Calculate category breakdown
        const breakdown = {};
        parsed.forEach(item => {
          const category = item.category || 'Other';
          const amount = parseFloat(item.amount || 0);
          if (breakdown[category]) {
            breakdown[category] += amount;
          } else {
            breakdown[category] = amount;
          }
        });
        setCategoryBreakdown(breakdown);
      }
    };

    onValue(incomeRef, handleIncome);
    onValue(expensesRef, handleExpenses);

    return () => {
      // Cleanup listeners if necessary
    };
  }, [totalIncome, totalExpenses]);

  useEffect(() => {
    const budgetsRef = ref(getDatabase(app), 'budgets/');
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

  const getFilteredData = (data) => {
    const now = new Date();
    let startDate;
    if (timeFilter === 'weekly') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeFilter === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeFilter === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      return data; // all time
    }
    return data.filter(item => new Date(item.date) >= startDate);
  };

  const filteredIncome = getFilteredData(income);
  const filteredExpenses = getFilteredData(expenses);

  const filteredTotalIncome = filteredIncome.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  const filteredTotalExpenses = filteredExpenses.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  const filteredNetBalance = filteredTotalIncome - filteredTotalExpenses;

  const filteredCategoryBreakdown = {};
  filteredExpenses.forEach(item => {
    const category = item.category || 'Other';
    const amount = convertFromPKR(parseFloat(item.amount || 0), currency);
    if (filteredCategoryBreakdown[category]) {
      filteredCategoryBreakdown[category] += amount;
    } else {
      filteredCategoryBreakdown[category] = amount;
    }
  });

  const getCategoryPercentage = (categoryAmount) => {
    if (filteredTotalExpenses === 0) return 0;
    return ((categoryAmount / filteredTotalExpenses) * 100).toFixed(1);
  };

  const getBalanceColor = () => {
    return filteredNetBalance >= 0 ? '#28a745' : '#dc3545';
  };

  const getBarChartData = () => {
    const now = new Date();
    let labels = [];
    let data = [];

    if (timeFilter === 'weekly') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        labels.push(dayName);
        const dayExpenses = filteredExpenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate.toDateString() === date.toDateString();
        }).reduce((sum, expense) => sum + convertFromPKR(parseFloat(expense.amount || 0), currency), 0);
        data.push(dayExpenses);
      }
    } else if (timeFilter === 'monthly') {
      // Current month days
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        labels.push(day.toString());
        const dayExpenses = filteredExpenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate.getDate() === day && expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
        }).reduce((sum, expense) => sum + convertFromPKR(parseFloat(expense.amount || 0), currency), 0);
        data.push(dayExpenses);
      }
    } else if (timeFilter === 'yearly') {
      // Months of the year
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let month = 0; month < 12; month++) {
        labels.push(monthNames[month]);
        const monthExpenses = filteredExpenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate.getMonth() === month && expenseDate.getFullYear() === now.getFullYear();
        }).reduce((sum, expense) => sum + convertFromPKR(parseFloat(expense.amount || 0), currency), 0);
        data.push(monthExpenses);
      }
    }

    return {
      labels,
      datasets: [{
        data,
      }],
    };
  };

  const pieData = Object.entries(filteredCategoryBreakdown).map(([category, amount], index) => ({
    name: category,
    amount,
    color: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'][index % 6],
    legendFontColor: isDarkMode ? '#fff' : '#333',
    legendFontSize: 15,
  }));

  const barChartData = getBarChartData();

  const styles = getStyles(isDarkMode);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#121212' : '#F9F9F9' }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.headerSpacer} />
        <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#003366' }]}>📊 Statistics</Text>

        {/* Time Filters */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, timeFilter === 'weekly' && styles.filterActive]}
            onPress={() => setTimeFilter('weekly')}
          >
            <Text style={[styles.filterText, timeFilter === 'weekly' && styles.filterTextActive]}>Weekly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, timeFilter === 'monthly' && styles.filterActive]}
            onPress={() => setTimeFilter('monthly')}
          >
            <Text style={[styles.filterText, timeFilter === 'monthly' && styles.filterTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, timeFilter === 'yearly' && styles.filterActive]}
            onPress={() => setTimeFilter('yearly')}
          >
            <Text style={[styles.filterText, timeFilter === 'yearly' && styles.filterTextActive]}>Yearly</Text>
          </TouchableOpacity>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: isDarkMode ? '#1E1E1E' : '#fff' }]}>
            <Text style={[styles.summaryLabel, { color: isDarkMode ? '#ccc' : '#666' }]}>Total Income</Text>
            <Text style={[styles.summaryAmount, { color: '#28a745' }]}>
              {formatAmount(filteredTotalIncome)}
            </Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: isDarkMode ? '#1E1E1E' : '#fff' }]}>
            <Text style={[styles.summaryLabel, { color: isDarkMode ? '#ccc' : '#666' }]}>Total Expenses</Text>
            <Text style={[styles.summaryAmount, { color: '#dc3545' }]}>
              {formatAmount(filteredTotalExpenses)}
            </Text>
          </View>
        </View>

        {/* Net Balance */}
        <View style={[styles.balanceCard, { backgroundColor: getBalanceColor() }]}>
          <Text style={styles.balanceLabel}>Net Balance</Text>
          <Text style={styles.balanceAmount}>
            {formatAmount(filteredNetBalance)}
          </Text>
        </View>

        {/* Bar Chart for Expenses Over Time */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#1E1E1E' : 'white', marginBottom: 20 }]}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#003366' }]}>Expenses Over Time</Text>
          {barChartData.labels.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.chartScrollView}>
              <BarChart
                data={barChartData}
                width={Math.max(Dimensions.get('window').width - 40, barChartData.labels.length * 50)} // dynamic width for scrolling
                height={220}
                yAxisLabel={`${currency} `}
                chartConfig={{
                  backgroundColor: isDarkMode ? '#121212' : '#fff',
                  backgroundGradientFrom: isDarkMode ? '#121212' : '#fff',
                  backgroundGradientTo: isDarkMode ? '#121212' : '#fff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => (isDarkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`),
                  labelColor: (opacity = 1) => (isDarkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`),
                  style: {
                    borderRadius: 16,
                  },
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: '#800080',
                  },
                }}
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
                fromZero
                showValuesOnTopOfBars
              />
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>No expenses recorded yet</Text>
          )}
        </View>

        {/* Category Breakdown */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#1E1E1E' : 'white' }]}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#003366' }]}>Expenses by Category</Text>
          {pieData.length > 0 ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.chartScrollView}>
                <PieChart
                  data={pieData}
                  width={Math.max(300, pieData.length * 80)} // dynamic width for scrolling
                  height={220}
                  chartConfig={{
                    backgroundColor: isDarkMode ? '#121212' : '#fff',
                    backgroundGradientFrom: isDarkMode ? '#121212' : '#fff',
                    backgroundGradientTo: isDarkMode ? '#121212' : '#fff',
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    labelColor: (opacity = 1) => (isDarkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`),
                  }}
                  accessor="amount"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              </ScrollView>
              {Object.entries(filteredCategoryBreakdown)
                .sort(([,a], [,b]) => b - a)
                .map(([category, amount]) => (
                  <TouchableOpacity key={category} style={styles.categoryItem} onPress={() => setSelectedCategory(category)}>
                    <View style={styles.categoryLeft}>
                      <View style={styles.categoryIcon}>
                        <Icon
                          name={categoryIcons[category] || 'wallet'}
                          size={20}
                          color="#fff"
                        />
                      </View>
                      <Text style={[styles.categoryName, { color: isDarkMode ? '#fff' : '#333' }]}>{category}</Text>
                    </View>
                    <View style={styles.categoryRight}>
                      <Text style={styles.categoryAmount}>
                        {formatAmount(amount)}
                      </Text>
                      <Text style={styles.categoryPercentage}>
                        {getCategoryPercentage(amount)}%
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              }
            </>
          ) : (
            <Text style={styles.emptyText}>No expenses recorded yet</Text>
          )}
        </View>

        {/* Quick Stats */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#1E1E1E' : 'white' }]}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#003366' }]}>Quick Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: isDarkMode ? '#fff' : '#003366' }]}>{filteredIncome.length}</Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? '#ccc' : '#666' }]}>Income Entries</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: isDarkMode ? '#fff' : '#003366' }]}>{filteredExpenses.length}</Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? '#ccc' : '#666' }]}>Expense Entries</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: isDarkMode ? '#fff' : '#003366' }]}>
                {Object.keys(filteredCategoryBreakdown).length}
              </Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? '#ccc' : '#666' }]}>Categories Used</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#121212' : '#F9F9F9',
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  headerSpacer: {
    height: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#003366',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'serif',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  filterButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
  },
  filterActive: {
    backgroundColor: '#800080',
  },
  filterText: {
    fontSize: 14,
    color: isDarkMode ? '#ccc' : '#666',
    fontFamily: 'serif',
  },
  filterTextActive: {
    color: '#fff',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 15,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryLabel: {
    fontSize: 14,
    color: isDarkMode ? '#ccc' : '#666',
    marginBottom: 8,
    fontFamily: 'serif',
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'serif',
  },
  balanceCard: {
    backgroundColor: '#800080',
    padding: 25,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  balanceLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'serif',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'serif',
  },
  section: {
    backgroundColor: isDarkMode ? '#1E1E1E' : 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#003366',
    marginBottom: 15,
    fontFamily: 'serif',
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#333' : '#f0f0f0',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    backgroundColor: '#800080',
    padding: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    color: isDarkMode ? '#fff' : '#333',
    fontFamily: 'serif',
  },
  categoryRight: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#dc3545',
    fontFamily: 'serif',
  },
  categoryPercentage: {
    fontSize: 12,
    color: isDarkMode ? '#ccc' : '#666',
    fontFamily: 'serif',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#003366',
    fontFamily: 'serif',
  },
  statLabel: {
    fontSize: 12,
    color: isDarkMode ? '#ccc' : '#666',
    marginTop: 4,
    fontFamily: 'serif',
  },
  emptyText: {
    textAlign: 'center',
    color: isDarkMode ? '#ccc' : '#999',
    fontStyle: 'italic',
    fontFamily: 'serif',
    marginVertical: 20,
  },
  chartScrollView: {
    borderRadius: 16,
    marginBottom: 20,
  },
  categoryScrollView: {
    borderRadius: 16,
    maxHeight: 300, // Limit height to enable vertical scrolling
  },
});

export default StatisticsScreen;

