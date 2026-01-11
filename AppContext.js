import AsyncStorage from '@react-native-async-storage/async-storage';
import { get, onValue, ref } from 'firebase/database';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { auth, database } from './firebaseConfig';

// Currency conversion rates (relative to PKR)
const CURRENCY_RATES = {
  PKR: 1, USD: 0.0036, EUR: 0.0033, GBP: 0.0028, JPY: 0.54, CAD: 0.0048, AUD: 0.0054,
};

// Color themes
const THEMES = {
  default: { name: 'Purple/Blue', primary: '#800080', secondary: '#003366', third: '#520052', fourth: '#F5E3FF' },
  Teal: { name: 'Green/Teal', primary: '#009688', secondary: '#229226ff', third: '#00695C', fourth: '#E0F2F1' },
  orange: { name: 'Orange/Red', primary: '#FF9800', secondary: '#F44336', third: '#E65100', fourth: '#FFF3E0' },
  pink: { name: 'Pink/Lavender', primary: '#d8638aff', secondary: '#4f1477ff', third: '#880E4F', fourth: '#FCE4EC' },
  dark: { name: 'Dark/Charcoal', primary: '#212121', secondary: '#5c5858ff', third: '#000000', fourth: '#424242' },
  blue: { name: 'Blue/Cyan', primary: '#2196F3', secondary: '#00BCD4', third: '#0D47A1', fourth: '#E3F2FD' },
  green: { name: 'Green/Lime', primary: '#609b38ff', secondary: '#CDDC39', third: '#2E7D32', fourth: '#E8F5E8' },
  red: { name: 'Red/Crimson', primary: '#F44336', secondary: '#DC143C', third: '#B71C1C', fourth: '#FFEBEE' },
  yellow: { name: 'Yellow/Gold', primary: '#FFEB3B', secondary: '#FFD700', third: '#F57F17', fourth: '#FFFDE7' },
  indigo: { name: 'Indigo/Violet', primary: '#3F51B5', secondary: '#a0499cff', third: '#1A237E', fourth: '#E8EAF6' },
  brown: { name: 'Brown/Tan', primary: '#795548', secondary: '#D2B48C', third: '#3E2723', fourth: '#EFEBE9' },
  turquoise: { name: 'Turquoise/Aqua', primary: '#00CED1', secondary: '#20B2AA', third: '#00695C', fourth: '#E0F2F1' },
  magenta: { name: 'Magenta/Fuchsia', primary: '#FF00FF', secondary: '#FF1493', third: '#C2185B', fourth: '#FCE4EC' },
  olive: { name: 'Olive/Khaki', primary: '#808000', secondary: '#F0E68C', third: '#4B4B00', fourth: '#F5F5DC' },
  navy: { name: 'Navy/Slate', primary: '#000080', secondary: '#708090', third: '#000051', fourth: '#E8EAF6' },
  coral: { name: 'Coral/Salmon', primary: '#FF7F50', secondary: '#FA8072', third: '#D84315', fourth: '#FCE4EC' },
  lavender: { name: 'Lavender/Plum', primary: '#bebefaff', secondary: '#DDA0DD', third: '#BA68C8', fourth: '#F3E5F5' },
  mint: { name: 'Mint/Emerald', primary: '#98FB98', secondary: '#00FF7F', third: '#388E3C', fourth: '#E8F5E8' },
};

const AppContext = createContext();

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export { THEMES };

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Tracks the logged-in user
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currency, setCurrency] = useState('PKR');
  const [theme, setTheme] = useState('Purple/Blue');
  const [appearance, setAppearance] = useState('Light');
  const [isLoading, setIsLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [savingsUsage, setSavingsUsage] = useState([]);
  const [selectedDateRange, setSelectedDateRange] = useState(() => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const getLocalDateString = (date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    return {
      startDate: getLocalDateString(startDate),
      endDate: getLocalDateString(endDate)
    };
  });

  // 1. Listen for Auth Changes (Login/Logout)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setExpenses([]);
        setSavingsUsage([]);
      }
    });
    return unsubscribe;
  }, []);

  // 2. Load Preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [savedDarkMode, savedCurrency, savedAppearance, savedTheme] = await Promise.all([
          AsyncStorage.getItem('darkMode'),
          AsyncStorage.getItem('currency'),
          AsyncStorage.getItem('appearance'),
          AsyncStorage.getItem('theme'),
        ]);

        if (savedDarkMode !== null) setIsDarkMode(JSON.parse(savedDarkMode));
        if (savedCurrency) setCurrency(savedCurrency);
        if (savedAppearance) setAppearance(savedAppearance);
        if (savedTheme) setTheme(savedTheme);
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // 3. Load Expenses (Depends on 'user')
  useEffect(() => {
    if (!user) return; // Wait until user is logged in

    const expensesRef = ref(database, `users/${user.uid}/expenses`);
    const unsubscribe = onValue(expensesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedExpenses = Object.entries(data).map(([key, value]) => ({
          id: key,
          firebaseKey: key,
          ...value
        }));
        setExpenses(loadedExpenses);
      } else {
        setExpenses([]);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const refreshExpenses = useCallback(async () => {
    if (!user) return;
    const expensesRef = ref(database, `users/${user.uid}/expenses`);
    const snapshot = await get(expensesRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const loadedExpenses = Object.entries(data).map(([key, value]) => ({
        id: key,
        firebaseKey: key,
        ...value
      }));
      setExpenses(loadedExpenses);
    } else {
      setExpenses([]);
    }
  }, [user]);

  // 4. Load savingsUsage (Depends on 'user')
  useEffect(() => {
    if (!user) return; // Wait until user is logged in

    const savingsUsageRef = ref(database, `users/${user.uid}/savingsUsage`);
    const unsubscribe = onValue(savingsUsageRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedSavingsUsage = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        }));
        setSavingsUsage(loadedSavingsUsage);
      } else {
        setSavingsUsage([]);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // --- Helper Functions ---
  const toggleDarkMode = async () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    try { await AsyncStorage.setItem('darkMode', JSON.stringify(newDarkMode)); } 
    catch (error) { console.error('Error saving dark mode preference:', error); }
  };

  const changeCurrency = async (newCurrency) => {
    setCurrency(newCurrency);
    try { await AsyncStorage.setItem('currency', newCurrency); } 
    catch (error) { console.error('Error saving currency preference:', error); }
  };

  const changeTheme = async (newTheme) => {
    setTheme(newTheme);
    try { await AsyncStorage.setItem('theme', newTheme); } 
    catch (error) { console.error('Error saving theme preference:', error); }
  };

  const changeAppearance = async (newAppearance) => {
    setAppearance(newAppearance);
    try {
      await AsyncStorage.setItem('appearance', newAppearance);
      if (newAppearance === 'Light') {
        setIsDarkMode(false);
        await AsyncStorage.setItem('darkMode', 'false');
      } else if (newAppearance === 'Dark') {
        setIsDarkMode(true);
        await AsyncStorage.setItem('darkMode', 'true');
      } else {
        setIsDarkMode(false);
        await AsyncStorage.setItem('darkMode', 'false');
      }
    } catch (error) { console.error('Error saving appearance preference:', error); }
  };

  const convertFromPKR = (amount, targetCurrency = currency) => {
    if (!amount || isNaN(amount)) return 0;
    const pkrAmount = parseFloat(amount);
    const rate = CURRENCY_RATES[targetCurrency] || 1;
    const converted = pkrAmount * rate;
    return parseFloat(converted.toFixed(2));
  };

  const convertToPKR = (amount, sourceCurrency = currency) => {
    if (!amount || isNaN(amount)) return 0;
    const sourceAmount = parseFloat(amount);
    const rate = CURRENCY_RATES[sourceCurrency] || 1;
    return sourceAmount / rate;
  };

  const formatAmount = (amount, targetCurrency = currency) => {
    if (!amount || isNaN(amount)) return '0';
    const convertedAmount = convertFromPKR(amount, targetCurrency);
    const currencySymbols = { PKR: 'PKR', USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'C$', AUD: 'A$' };
    const symbol = currencySymbols[targetCurrency] || targetCurrency;
    return `${symbol} ${convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatConvertedAmount = (amount) => {
    const currencySymbols = { PKR: 'PKR', USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'C$', AUD: 'A$' };
    const symbol = currencySymbols[currency] || currency;
    return `${symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const themeKey = Object.keys(THEMES).find(key => THEMES[key].name === theme);
  const themeColors = THEMES[themeKey] || THEMES.default;

  const value = {
    user,
    isDarkMode, currency, theme, appearance, themeColors, isLoading,
    expenses, savingsUsage, selectedDateRange, setSelectedDateRange,
    toggleDarkMode, changeCurrency, changeTheme, changeAppearance,
    convertFromPKR, convertToPKR, formatAmount, formatConvertedAmount,
    refreshExpenses,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};