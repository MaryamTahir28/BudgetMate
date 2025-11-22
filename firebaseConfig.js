//firebaseConfig.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyAwfIQZNQ3jZ_J0BKEx4bdMbd2le9un2Jo',
  authDomain: 'budgetmate-a7900.firebaseapp.com',
  databaseURL: 'https://budgetmate-a7900-default-rtdb.firebaseio.com',
  projectId: 'budgetmate-a7900',
  storageBucket: 'budgetmate-a7900.appspot.com',
  messagingSenderId: '395061986506',
  appId: '1:395061986506:web:783011a9adf2a14ba62033',
  measurementId: 'G-7DY34KGPX2',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let auth;

if (Platform.OS === 'web') {
  // Web: just getAuth, no persistence config needed, uses browser storage automatically
  auth = getAuth(app);
} else {
  // React Native: use initializeAuth with AsyncStorage persistence
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if (error.code === 'auth/already-initialized') {
      auth = getAuth(app);
    } else {
      throw error;
    }
  }
}
const database = getDatabase(app);

export { auth, database };

