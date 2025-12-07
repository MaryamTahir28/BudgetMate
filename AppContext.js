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

// Color themes
const THEMES = {
  default: {
    name: 'Purple/Blue',
    primary: '#800080',
    secondary: '#003366',
    third: '#520052',
    fourth: '#F5E3FF',
  },
  Teal: {
    name: 'Green/Teal',
    primary: '#009688',
    secondary: '#229226ff',
    third: '#00695C',
    fourth: '#E0F2F1',
  },
  orange: {
    name: 'Orange/Red',
    primary: '#FF9800',
    secondary: '#F44336',
    third: '#E65100',
    fourth: '#FFF3E0',
  },
  pink: {
    name: 'Pink/Lavender',
    primary: '#d8638aff',
    secondary: '#4f1477ff',
    third: '#880E4F',
    fourth: '#FCE4EC',
  },
  dark: {
    name: 'Dark/Charcoal',
    primary: '#212121',
    secondary: '#5c5858ff',
    third: '#000000',
    fourth: '#424242',
  },
  blue: {
    name: 'Blue/Cyan',
    primary: '#2196F3',
    secondary: '#00BCD4',
    third: '#0D47A1',
    fourth: '#E3F2FD',
  },
  green: {
    name: 'Green/Lime',
    primary: '#609b38ff',
    secondary: '#CDDC39',
    third: '#2E7D32',
    fourth: '#E8F5E8',
  },
  red: {
    name: 'Red/Crimson',
    primary: '#F44336',
    secondary: '#DC143C',
    third: '#B71C1C',
    fourth: '#FFEBEE',
  },
  yellow: {
    name: 'Yellow/Gold',
    primary: '#FFEB3B',
    secondary: '#FFD700',
    third: '#F57F17',
    fourth: '#FFFDE7',
  },
  indigo: {
    name: 'Indigo/Violet',
    primary: '#3F51B5',
    secondary: '#a0499cff',
    third: '#1A237E',
    fourth: '#E8EAF6',
  },
  brown: {
    name: 'Brown/Tan',
    primary: '#795548',
    secondary: '#D2B48C',
    third: '#3E2723',
    fourth: '#EFEBE9',
  },
  turquoise: {
    name: 'Turquoise/Aqua',
    primary: '#00CED1',
    secondary: '#20B2AA',
    third: '#00695C',
    fourth: '#E0F2F1',
  },
  magenta: {
    name: 'Magenta/Fuchsia',
    primary: '#FF00FF',
    secondary: '#FF1493',
    third: '#C2185B',
    fourth: '#FCE4EC',
  },
  olive: {
    name: 'Olive/Khaki',
    primary: '#808000',
    secondary: '#F0E68C',
    third: '#4B4B00',
    fourth: '#F5F5DC',
  },
  navy: {
    name: 'Navy/Slate',
    primary: '#000080',
    secondary: '#708090',
    third: '#000051',
    fourth: '#E8EAF6',
  },
  coral: {
    name: 'Coral/Salmon',
    primary: '#FF7F50',
    secondary: '#FA8072',
    third: '#D84315',
    fourth: '#FCE4EC',
  },
  lavender: {
    name: 'Lavender/Plum',
    primary: '#bebefaff',
    secondary: '#DDA0DD',
    third: '#BA68C8',
    fourth: '#F3E5F5',
  },
  mint: {
    name: 'Mint/Emerald',
    primary: '#98FB98',
    secondary: '#00FF7F',
    third: '#388E3C',
    fourth: '#E8F5E8',
  },
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
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currency, setCurrency] = useState('PKR');
  const [theme, setTheme] = useState('Purple/Blue');
  const [appearance, setAppearance] = useState('Light');
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [savedDarkMode, savedCurrency, savedAppearance, savedTheme] = await Promise.all([
          AsyncStorage.getItem('darkMode'),
          AsyncStorage.getItem('currency'),
          AsyncStorage.getItem('appearance'),
          AsyncStorage.getItem('theme'),
        ]);

        if (savedDarkMode !== null) {
          setIsDarkMode(JSON.parse(savedDarkMode));
        }
        if (savedCurrency) {
          setCurrency(savedCurrency);
        }
        if (savedAppearance) {
          setAppearance(savedAppearance);
        }
        if (savedTheme) {
          setTheme(savedTheme);
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

  // Save theme preference
  const changeTheme = async (newTheme) => {
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem('theme', newTheme);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  // Save appearance preference
  const changeAppearance = async (newAppearance) => {
    setAppearance(newAppearance);
    try {
      await AsyncStorage.setItem('appearance', newAppearance);
      // Set isDarkMode based on appearance
      if (newAppearance === 'Light') {
        setIsDarkMode(false);
        await AsyncStorage.setItem('darkMode', 'false');
      } else if (newAppearance === 'Dark') {
        setIsDarkMode(true);
        await AsyncStorage.setItem('darkMode', 'true');
      } else if (newAppearance === 'System') {
        // For System, we could use device appearance, but for now set to light
        setIsDarkMode(false);
        await AsyncStorage.setItem('darkMode', 'false');
      }
    } catch (error) {
      console.error('Error saving appearance preference:', error);
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


  // Get current theme colors
  const themeKey = Object.keys(THEMES).find(key => THEMES[key].name === theme);
  const themeColors = THEMES[themeKey] || THEMES.default;

  const value = {
    isDarkMode,
    currency,
    theme,
    appearance,
    themeColors,
    isLoading,
    toggleDarkMode,
    changeCurrency,
    changeTheme,
    changeAppearance,
    convertFromPKR,
    convertToPKR,
    formatAmount,
    formatConvertedAmount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
