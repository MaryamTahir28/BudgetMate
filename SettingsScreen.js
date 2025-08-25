//SettingScreen

import { auth } from '@/firebaseConfig'; // adjust the path to your firebase config
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { signOut } from 'firebase/auth';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SettingsScreen = () => {
  const router = useRouter();

  const handleLogout = async () => {
  try {
    await AsyncStorage.clear();  // 🧹 Clear all local data
    await signOut(auth);         // 🔒 Sign out from Firebase
    router.replace('/login');    // 🚪 Redirect to login screen
  } catch (error) {
    Alert.alert('Logout Error', error.message);
  }
};

  return (
    <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      <Text style={styles.heading}>Settings</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
    </SafeAreaView>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F9F9F9',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  heading: {
    color: '#003366',
    fontSize: 24,
    marginBottom: 40,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: '#800080',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
