//AddIncomeScreen.js

import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { push, ref, update } from 'firebase/database';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity, TouchableWithoutFeedback, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../../AppContext';
import { auth, database } from '../../firebaseConfig';

const initialCategories = [
  'Salary', 'Bonus', 'Freelance', 'Business', 'Gift', 'Interest', 'Other',
];

const AddIncomeScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isDarkMode, themeColors } = useAppContext();

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const hasPrefilled = useRef(false); // ⬅️ Add this line
  const [customCategory, setCustomCategory] = useState('');
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [categories, setCategories] = useState(initialCategories);

  useEffect(() => {
  if (params?.firebaseKey && !hasPrefilled.current) {
    setAmount(params.amount?.toString() || '');

    setNote(params.note?.toString() || '');
    setDate(params.date ? new Date(params.date) : new Date());
    setSelectedCategory(params.category?.toString() || '');
    hasPrefilled.current = true; // ⬅️ Only run once
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

    const incomeData = {
      amount: amountValue.toString(),
      category: useCustomCategory ? customCategory : selectedCategory,
      note,
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      time: new Date().toLocaleTimeString(),
    };

    try {
      const userId = auth.currentUser?.uid || 'guest';

      if (params?.firebaseKey) {
        await update(ref(database, `users/${userId}/incomes/${params.firebaseKey}`), incomeData);
        Alert.alert('Updated', 'Income updated successfully.');
      } else {
        incomeData.id = Date.now().toString();
        await push(ref(database, `users/${userId}/incomes`), incomeData);
        Alert.alert('Success', 'Income saved.');
      }

      router.replace({ pathname: '/home', params: { type: 'income' } });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save income.');
    }
  }, [amount, selectedCategory, customCategory, note, date, router, params, useCustomCategory]);

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
          keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 30} // adjust if needed
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, padding: 0 }}
            keyboardShouldPersistTaps="handled"
          >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>
          {params?.firebaseKey ? 'Edit Income' : 'Add Income'}
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
              style={[
                styles.catBox,
                selectedCategory === cat && styles.catBoxSelected,
              ]}
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
            style={[
              styles.catBox,
              useCustomCategory && styles.catBoxSelected,
              { borderStyle: 'dashed' },
            ]}
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
              placeholderTextColor="#aaa"
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

export default AddIncomeScreen;

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
    color: isDarkMode ? '#fff' : themeColors.secondary,
  },
  tealText: {
    color: isDarkMode ? '#fff' : themeColors.secondary,
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
  saveButton: {
    marginTop: 20,
    width: 150,
    backgroundColor: themeColors.primary,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  saveText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'serif',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  cancelText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'serif',
  },
});
