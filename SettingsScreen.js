//SettingScreen

import { auth, database } from '@/firebaseConfig'; // adjust the path to your firebase config
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
  updateProfile
} from 'firebase/auth';
import { ref, remove } from 'firebase/database';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../../AppContext';

const SettingsScreen = () => {
  const router = useRouter();
  const user = auth.currentUser;
  const { isDarkMode, currency, toggleDarkMode, changeCurrency } = useAppContext();

  // State for profile
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');

  // State for password reset
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const currencies = ['PKR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              await signOut(auth);
              router.replace('/login');
            } catch (error) {
              Alert.alert('Logout Error', error.message);
            }
          }
        }
      ]
    );
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    try {
      await updateProfile(user, { displayName });
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handlePasswordReset = async () => {
    if (!user || !oldPassword || !newPassword || newPassword !== confirmPassword) {
      Alert.alert('Error', 'Please fill all fields correctly');
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      Alert.alert('Success', 'Password updated successfully');
      setShowPasswordModal(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      let errorMessage = 'An error occurred while updating your password';

      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Current password is incorrect. Please try again.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please log out and log back in before changing your password.';
      }

      Alert.alert('Error', errorMessage);
    }
  };

  const handleDeactivateAccount = async () => {
    Alert.alert(
      'Deactivate Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              if (user) {
                // Delete user data from database
                const userRef = ref(database, `users/${user.uid}`);
                await remove(userRef);

                // Delete user account
                await deleteUser(user);
                await AsyncStorage.clear();
                router.replace('/login');
              }
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };



  const handleCurrencyChange = async (newCurrency) => {
    await changeCurrency(newCurrency);
    Alert.alert('Success', 'Currency updated successfully');
  };

  const styles = getStyles(isDarkMode);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Settings</Text>

        {/* Profile Update Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <TextInput
            style={styles.input}
            placeholder="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholderTextColor={isDarkMode ? '#aaa' : '#666'}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={isDarkMode ? '#aaa' : '#666'}
            editable={false} // Email cannot be changed directly
          />
          <TouchableOpacity style={styles.button} onPress={handleUpdateProfile}>
            <Text style={styles.buttonText}>Update Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Password Reset Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => setShowPasswordModal(true)}
          >
            <Text style={styles.buttonText}>Change Password</Text>
          </TouchableOpacity>
        </View>

        {/* Currency Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Currency</Text>
          <Picker
            selectedValue={currency}
            onValueChange={(itemValue) => handleCurrencyChange(itemValue)}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {currencies.map((cur) => (
              <Picker.Item key={cur} label={cur} value={cur} />
            ))}
          </Picker>
        </View>

        {/* Dark Mode Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <TouchableOpacity
            style={[styles.button, isDarkMode && styles.buttonSelected]}
            onPress={toggleDarkMode}
          >
            <Text style={styles.buttonText}>
              {isDarkMode ? 'Disable Dark Mode' : 'Enable Dark Mode'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Wishlist Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wishlist</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/wishlist')}
          >
            <Text style={styles.buttonText}>Manage Wishlist</Text>
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={handleDeactivateAccount}
          >
            <Text style={styles.buttonText}>Deactivate Account</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logout</Text>
          <TouchableOpacity style={styles.button} onPress={handleLogout}>
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </View>
        {/* Password Reset Modal */}
        <Modal
          visible={showPasswordModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPasswordModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Current Password"
                  secureTextEntry={!showOldPassword}
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  placeholderTextColor={isDarkMode ? '#aaa' : '#666'}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowOldPassword(!showOldPassword)}
                >
                  <Ionicons
                    name={showOldPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color={isDarkMode ? '#aaa' : '#666'}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="New Password"
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholderTextColor={isDarkMode ? '#aaa' : '#666'}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color={isDarkMode ? '#aaa' : '#666'}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm New Password"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholderTextColor={isDarkMode ? '#aaa' : '#666'}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color={isDarkMode ? '#aaa' : '#666'}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.modalButton]}
                  onPress={handlePasswordReset}
                >
                  <Text style={styles.buttonText}>Submit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowPasswordModal(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>


      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;

const getStyles = (isDarkMode) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: isDarkMode ? '#121212' : '#F9F9F9',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    padding: 20,
    backgroundColor: isDarkMode ? '#121212' : '#fff',
  },
  heading: {
    fontSize: 24,
    marginBottom: 20,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
    textAlign: 'center',
  },
  section: {
    marginBottom: 30,
    padding: 20,
    backgroundColor: isDarkMode ? '#1E1E1E' : '#f9f9f9',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: isDarkMode ? '#555' : '#ddd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    color: isDarkMode ? '#fff' : '#333',
    fontSize: 16,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    padding: 5,
  },
  button: {
    backgroundColor: '#800080',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#800080',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoutButton: {
    backgroundColor: '#800080',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
    shadowColor: '#800080',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
    padding: 25,
    borderRadius: 15,
    width: '85%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
    marginBottom: 25,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
  },
  dangerButton: {
    backgroundColor: '#800080',
  },
  buttonSelected: {
    backgroundColor: '#800080',
  },
  picker: {
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    borderWidth: 1,
    borderColor: isDarkMode ? '#555' : '#ddd',
    borderRadius: 10,
    marginBottom: 15,
  },
  pickerItem: {
    color: isDarkMode ? '#fff' : '#333',
    fontSize: 16,
  },
});
