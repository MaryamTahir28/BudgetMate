// firebaseConfig.js (outside app/ folder)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';

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

const app = initializeApp(firebaseConfig);


const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
console.log('Firebase initialized. Auth:', auth);

export { app, auth };

