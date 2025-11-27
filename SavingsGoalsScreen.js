import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onValue, push, ref, remove, update } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
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
  const { isDarkMode, currency, formatAmount, convertToPKR, convertFromPKR } = useAppContext();
  const user = auth.currentUser;

  const [savingsGoals, setSavingsGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Form states
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [timeframe, setTimeframe] = useState('months'); // weeks, months, years
  const [durationValue, setDurationValue] = useState('');
  const [monthlySavingPercent, setMonthlySavingPercent] = useState(''); // Optional percentage from income (not implemented fully now)
  const [linkedWishId, setLinkedWishId] = useState(null);

  const [wishlist, setWishlist] = useState([]);

  // Additional states for updating saved amount modal
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [currentGoal, setCurrentGoal] = useState(null);
  const [newSavedAmount, setNewSavedAmount] = useState('');

  const openUpdateModal = (goal) => {
    setCurrentGoal(goal);
    setNewSavedAmount(goal.savedAmount ? String(convertFromPKR(goal.savedAmount)) : '');
    setUpdateModalVisible(true);
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
    try {
      await update(ref(database, `users/${user.uid}/savingsGoals/${currentGoal.id}`), {
        savedAmount: convertToPKR(parsedAmount)
      });
      setUpdateModalVisible(false);
      setCurrentGoal(null);
      setNewSavedAmount('');
    } catch (error) {
      Alert.alert('Error', 'Failed to update saved amount: ' + error.message);
    }
  };

  // Load wishlist for linking savings goals optionally
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
        setSavingsGoals(loadedGoals);
      } else {
        setSavingsGoals([]);
      }
      setLoading(false);
    });
  }, [user]);

  // Helper: calculate monthly savings needed based on target, timeframe
  const calculateMonthlySavings = (goal) => {
    if (!goal.targetAmount || !goal.timeframe || !goal.durationValue) return 0;
    const target = parseFloat(goal.targetAmount);
    const duration = parseInt(goal.durationValue);
    let months = duration;
    if (goal.timeframe === 'weeks') {
      months = duration / 4.345;
    } else if (goal.timeframe === 'years') {
      months = duration * 12;
    }
    if (months <= 0) return 0;
    return target / months;
  };

  // Helper: calculate progress percentage
  const calculateProgress = (goal) => {
    if (!goal.savedAmount || !goal.targetAmount) return 0;
    return Math.min((goal.savedAmount / goal.targetAmount) * 100, 100);
  };

  // Add new savings goal
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
        targetAmount: convertToPKR(targetVal), // store in PKR internally
        timeframe,
        durationValue: durationVal,
        savedAmount: 0,
        linkedWishId,
        createdAt: new Date().toISOString()
      });
      Alert.alert('Success', 'Savings goal added');
      setGoalName('');
      setTargetAmount('');
      setDurationValue('');
      setTimeframe('months');
      setLinkedWishId(null);
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to add goal: ' + error.message);
    }
  };

  // Delete savings goal
  const deleteGoal = (id) => {
    Alert.alert(
      'Delete Goal',
      'Are you sure you want to delete this savings goal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await remove(ref(database, `users/${user.uid}/savingsGoals/${id}`));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete goal: ' + error.message);
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  // Update savedAmount manually (for demo, this could link to actual saved income allocation)
  // For now, not implemented auto tracking, can be expanded later.

  const styles = getStyles(isDarkMode);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Savings Goals</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <MaterialCommunityIcons name="plus" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading...</Text>
      ) : savingsGoals.length === 0 ? (
        <Text style={styles.emptyText}>No savings goals yet. Tap + to add one.</Text>
      ) : (
        <FlatList
          data={savingsGoals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => {
            const monthlyNeeded = calculateMonthlySavings(item);
            const progressPercent = calculateProgress(item);
            const linkedWish = wishlist.find(w => w.id === item.linkedWishId);

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.goalName}</Text>
                  <TouchableOpacity onPress={() => deleteGoal(item.id)} style={styles.deleteButton}>
                    <MaterialCommunityIcons name="delete" size={22} color="red" />
                  </TouchableOpacity>
                </View>
                {linkedWish && (
                  <Text style={styles.linkedWishText}>Linked Wish: {linkedWish.name}</Text>
                )}
                <Text>Target Amount: {formatAmount(convertFromPKR(item.targetAmount))} {currency}</Text>
                <Text>Timeframe: {item.durationValue} {item.timeframe}</Text>
                <Text>Estimated Monthly Savings Needed: {formatAmount(monthlyNeeded)} {currency}</Text>
                <View style={styles.progressBarBackground}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
                <Text>Progress: {progressPercent.toFixed(1)}%</Text>

                <TouchableOpacity style={styles.updateSavedAmountButton} onPress={() => openUpdateModal(item)}>
                  <Text style={styles.updateSavedAmountText}>Update Saved Amount</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* Modal for updating saved amount */}
      <Modal visible={updateModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Saved Amount</Text>

            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={newSavedAmount}
              onChangeText={(text) => {
                // Allow only numbers and decimal point
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
    </SafeAreaView>
  );
};

export default SavingsGoalsScreen;

const getStyles = (isDarkMode) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: isDarkMode ? '#121212' : '#F9F9F9',
  },
  header: {
    flexDirection: 'row',
    padding: 18,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#800080',
    marginTop: 50,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'serif',
  },
  addButton: {
    backgroundColor: '#520052',
    borderRadius: 30,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'serif',
  },
  emptyText: {
    marginTop: 40,
    textAlign: 'center',
    fontSize: 16,
    fontStyle: 'italic',
    color: '#888',
    fontFamily: 'serif',
  },
  card: {
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 15,
    borderRadius: 15,
    borderColor: '#800080',
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
    fontSize: 18,
    color: '#800080',
    fontFamily: 'serif',
    flex: 1,
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
    color: '#800080',
    fontFamily: 'serif',
  },
  progressBarBackground: {
    backgroundColor: '#ddd',
    height: 12,
    borderRadius: 6,
    marginVertical: 8,
  },
  progressBarFill: {
    backgroundColor: '#800080',
    height: 12,
    borderRadius: 6,
  },
  label: {
    color: '#800080',
    fontWeight: 'bold',
    fontFamily: 'serif',
    marginBottom: 6,
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#800080',
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
    color: '#800080',
    fontFamily: 'serif',
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
    borderColor: '#800080',
  },
  durationText: {
    color: '#800080',
    fontFamily: 'serif',
  },
  durationSelected: {
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'serif',
    backgroundColor: '#800080',
    borderRadius: 15,
    paddingVertical: 2,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  wishlistSelector: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#800080',
    borderRadius: 8,
    backgroundColor: '#fff',
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
    color: '#800080',
    fontFamily: 'serif',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#800080',
    fontFamily: 'serif',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 25,
  },
  button: {
    backgroundColor: '#800080',
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#003366'
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'serif',
    textAlign: 'center',
  },
});
