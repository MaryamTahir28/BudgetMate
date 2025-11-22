import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

// Currency conversion rates (relative to PKR)
const CURRENCY_RATES = {
  PKR: 1,
  USD: 0.0036,
  EUR: 0.0033,
  GBP: 0.0028,
  JPY: 0.54,
  CAD: 0.0048,
  AUD: 0.0054,
};

const AppContext = createContext();

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currency, setCurrency] = useState('PKR');
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [savedDarkMode, savedCurrency] = await Promise.all([
          AsyncStorage.getItem('darkMode'),
          AsyncStorage.getItem('currency'),
        ]);

        if (savedDarkMode !== null) {
          setIsDarkMode(JSON.parse(savedDarkMode));
        }
        if (savedCurrency) {
          setCurrency(savedCurrency);
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Save dark mode preference
  const toggleDarkMode = async () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    try {
      await AsyncStorage.setItem('darkMode', JSON.stringify(newDarkMode));
    } catch (error) {
      console.error('Error saving dark mode preference:', error);
    }
  };

  // Save currency preference
  const changeCurrency = async (newCurrency) => {
    setCurrency(newCurrency);
    try {
      await AsyncStorage.setItem('currency', newCurrency);
    } catch (error) {
      console.error('Error saving currency preference:', error);
    }
  };

  // Convert amount from PKR to selected currency
  const convertFromPKR = (amount, targetCurrency = currency) => {
  if (!amount || isNaN(amount)) return 0;

  const pkrAmount = parseFloat(amount);
  const rate = CURRENCY_RATES[targetCurrency] || 1;
  const converted = pkrAmount * rate;

  // Return value rounded to 2 decimal places
  return parseFloat(converted.toFixed(2));
};


  // Convert amount to PKR from selected currency
  const convertToPKR = (amount, sourceCurrency = currency) => {
    if (!amount || isNaN(amount)) return 0;
    const sourceAmount = parseFloat(amount);
    const rate = CURRENCY_RATES[sourceCurrency] || 1;
    return sourceAmount / rate;
  };

  // Format amount with currency symbol
  const formatAmount = (amount, targetCurrency = currency) => {
    if (!amount || isNaN(amount)) return '0';

    const convertedAmount = convertFromPKR(amount, targetCurrency);
    const currencySymbols = {
      PKR: 'PKR',
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      CAD: 'C$',
      AUD: 'A$',
    };

    const symbol = currencySymbols[targetCurrency] || targetCurrency;
    return `${symbol} ${convertedAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatConvertedAmount = (amount) => {
  const currencySymbols = {
    PKR: 'PKR',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'C$',
    AUD: 'A$',
  };
  const symbol = currencySymbols[currency] || currency;
  return `${symbol} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};


  const value = {
    isDarkMode,
    currency,
    isLoading,
    toggleDarkMode,
    changeCurrency,
    convertFromPKR,
    convertToPKR,
    formatAmount,
    formatConvertedAmount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
