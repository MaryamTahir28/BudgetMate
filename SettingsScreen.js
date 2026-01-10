//SettingScreen

import { auth, database } from '@/firebaseConfig'; // adjust the path to your firebase config
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  deleteUser,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from 'firebase/auth';
import { get, limitToLast, onValue, query, ref, remove, update } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { THEMES, useAppContext } from '../../AppContext';

const SettingsScreen = () => {
  const router = useRouter();
  const user = auth.currentUser;
  const { isDarkMode, currency, theme, appearance, toggleDarkMode, changeCurrency, changeTheme, changeAppearance, themeColors } = useAppContext();



  // State for profile
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');

  // State for password reset
  const [oldPassword, setOldPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);

  const currencies = ['PKR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];
  const themes = Object.values(THEMES).map(theme => theme.name);

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

  const validatePassword = (password) => {
    // No longer used in new flow; remove detailed password validation here if unused.
    return null;
  };

  const handlePasswordReset = async () => {
    if (!user || !oldPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }

    // Instead of changing password here, send password reset email
    try {
      await sendPasswordResetEmail(auth, user.email);
      Alert.alert(
        'Password Reset Email Sent',
        'A password reset link has been sent to your email address. Please check your inbox and follow the link to set a new password.'
      );
      setShowPasswordModal(false);
      setOldPassword('');
    } catch (error) {
      console.error('Password reset email error:', error);
      let errorMessage = 'Failed to send password reset email. Please try again later.';
      if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests made to change password. Please try again later.';
      }
      Alert.alert('Error', errorMessage);
    }
  };

  const handleSendVerificationEmail = async () => {
    if (!user) return;

    try {
      console.log('Manually sending verification email...');
      await sendEmailVerification(user);
      console.log('Verification email sent successfully');
      Alert.alert('Success', 'Verification email sent! Please check your email and click the verification link.');
    } catch (error) {
      console.error('Send verification error:', error);
      Alert.alert('Error', 'Failed to send verification email. Please try again later.');
    }
  };

  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateConfirmation, setDeactivateConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [showDeactivateConfirmModal, setShowDeactivateConfirmModal] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateConfirmText, setDeactivateConfirmText] = useState('');

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [showActivityLogsModal, setShowActivityLogsModal] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // State for savings goals
  const [savingsGoals, setSavingsGoals] = useState([]);



  // Update selectedTheme when theme changes or modal opens
  useEffect(() => {
    setSelectedTheme(theme);
  }, [theme, showThemeModal]);

  // Load savings goals
  useEffect(() => {
    if (!user) return;
    const savingsRef = ref(database, `users/${user.uid}/savingsGoals`);
    const unsubscribe = onValue(savingsRef, (snapshot) => {
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
    });
    return () => unsubscribe();
  }, [user]);







  const handleDeactivateAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          onPress: () => setShowDeactivateModal(true)
        }
      ]
    );
  };

  const handleDeactivateConfirm = () => {
    setShowDeactivateConfirmModal(true);
  };

  const confirmDeactivateConfirm = async () => {
    setIsDeactivating(true);
    try {
      if (user) {
        // Set deactivated: true in database
        const userRef = ref(database, `users/${user.uid}`);
        await update(userRef, { deactivated: true });

        // Sign out and redirect to login
        await signOut(auth);
        await AsyncStorage.clear();

        Alert.alert(
          'Account Deactivated',
          'Your account has been deactivated. All data is saved and you can reactivate it later.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/login')
            }
          ]
        );
      }
    } catch (error) {
      console.error('Deactivation error:', error);
      Alert.alert('Error', 'Failed to deactivate account. Please try again.');
    } finally {
      setIsDeactivating(false);
      setShowDeactivateConfirmModal(false);
    }
  };

  const confirmDeactivateAccount = async () => {
    if (deactivateConfirmation.toUpperCase() !== 'DELETE') {
      Alert.alert('Error', 'Please type "DELETE" to confirm account deactivation');
      return;
    }

    setIsDeleting(true);
    try {
      if (user) {
        // Delete user data from database
        const userRef = ref(database, `users/${user.uid}`);
        await remove(userRef);

        // Delete user account
        await deleteUser(user);

        // Clear local storage
        await AsyncStorage.clear();

        Alert.alert(
          'Account Deactivated',
          'Your account and all associated data have been permanently deleted.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/login')
            }
          ]
        );
      }
    } catch (error) {
      console.error('Deactivation error:', error);
      let errorMessage = 'Failed to deactivate account. Please try again.';

      if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'For security reasons, please log out and log back in before deactivating your account.';
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setIsDeleting(false);
      setShowDeactivateModal(false);
      setDeactivateConfirmation('');
    }
  };



  const handleCurrencyChange = async (newCurrency) => {
    await changeCurrency(newCurrency);
    Alert.alert('Success', 'Currency updated successfully');
  };

  const handleThemeChange = async (newTheme) => {
    await changeTheme(newTheme);
    Alert.alert('Success', 'Theme updated successfully');
  };

  const fetchActivityLogs = async () => {
    if (!user) return;

    setLoadingLogs(true);
    try {
      const logsRef = ref(database, `users/${user.uid}/activityLogs`);
      const logsQuery = query(logsRef, limitToLast(50));
      const snapshot = await get(logsQuery);

      if (snapshot.exists()) {
        const logsData = snapshot.val();
        const logsArray = Object.values(logsData).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setActivityLogs(logsArray);
      } else {
        setActivityLogs([]);
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      Alert.alert('Error', 'Failed to load activity logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleViewActivityLogs = () => {
    setShowActivityLogsModal(true);
    fetchActivityLogs();
  };



  const styles = getStyles(isDarkMode, themeColors);

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

        {/* Activity Logs Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Logs</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={handleViewActivityLogs}
          >
            <Text style={styles.buttonText}>View Login History</Text>
          </TouchableOpacity>
        </View>

        {/* Currency Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Currency</Text>
          <TouchableOpacity
            style={styles.currencyButton}
            onPress={() => setShowCurrencyModal(true)}
          >
            <Text style={styles.currencyButtonText}>{currency}</Text>
            <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#fff' : '#333'} />
          </TouchableOpacity>
        </View>

        {/* Theme Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <TouchableOpacity
            style={styles.currencyButton}
            onPress={() => setShowThemeModal(true)}
          >
            <Text style={styles.currencyButtonText}>{theme}</Text>
            <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#fff' : '#333'} />
          </TouchableOpacity>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Savings Goals</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/savingsGoals')}
          >
            <Text style={styles.buttonText}>Manage Savings Goals</Text>
          </TouchableOpacity>


        </View>



        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={handleDeactivateConfirm}
          >
            <Text style={styles.buttonText}>Deactivate Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.deleteButton]}
            onPress={() => setShowDeactivateModal(true)}
          >
            <Text style={styles.buttonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logout</Text>
          <TouchableOpacity style={styles.button} onPress={() => setShowLogoutModal(true)}>
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
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, { paddingRight: 150 }]}
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

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.modalButton]}
                  onPress={handlePasswordReset}
                >
                  <Text style={styles.buttonText}>Send Verification Email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowPasswordModal(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Deactivate Account Modal */}
        <Modal
          visible={showDeactivateConfirmModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowDeactivateConfirmModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="warning" size={30} color="#ff6b6b" />
                <Text style={styles.modalTitle}>Deactivate Account</Text>
              </View>

              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  Your account will be deactivated but all your data will be preserved. You can reactivate your account later by logging in.
                </Text>
              </View>

              <View style={styles.confirmationSection}>
                <Text style={styles.confirmationLabel}>
                  Type "DEACTIVATE" to confirm:
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.confirmationInput,
                    deactivateConfirmText.toUpperCase() === 'DEACTIVATE' ? styles.inputValid : styles.inputInvalid
                  ]}
                  value={deactivateConfirmText}
                  onChangeText={setDeactivateConfirmText}
                  placeholder="Type DEACTIVATE here"
                  placeholderTextColor={isDarkMode ? '#aaa' : '#666'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="default"
                  returnKeyType="done"
                />
                {deactivateConfirmText.toUpperCase() === 'DEACTIVATE' && (
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" style={styles.checkIcon} />
                )}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowDeactivateConfirmModal(false);
                    setDeactivateConfirmText('');
                  }}
                  disabled={isDeactivating}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.modalButton,
                    styles.dangerButton,
                    deactivateConfirmText.toUpperCase() === 'DEACTIVATE' ? styles.dangerButtonEnabled : styles.dangerButtonDisabled
                  ]}
                  onPress={confirmDeactivateConfirm}
                  disabled={isDeactivating || deactivateConfirmText.toUpperCase() !== 'DEACTIVATE'}
                >
                  <Text style={styles.buttonText}>
                    {isDeactivating ? 'Deactivating...' : 'Deactivate Account'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Delete Account Modal */}
        <Modal
          visible={showDeactivateModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowDeactivateModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="warning" size={30} color="#ff6b6b" />
                <Text style={styles.modalTitle}>Delete Account</Text>
              </View>

              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  This action cannot be undone. All your data including expenses, budgets, savings goals, and wishlist items will be permanently deleted.
                </Text>
              </View>

              <View style={styles.confirmationSection}>
                <Text style={styles.confirmationLabel}>
                  Type "DELETE" to confirm:
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.confirmationInput,
                    deactivateConfirmation.toUpperCase() === 'DELETE' ? styles.inputValid : styles.inputInvalid
                  ]}
                  value={deactivateConfirmation}
                  onChangeText={setDeactivateConfirmation}
                  placeholder="Type DELETE here"
                  placeholderTextColor={isDarkMode ? '#aaa' : '#666'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="default"
                  returnKeyType="done"
                />
                {deactivateConfirmation.toUpperCase() === 'DELETE' && (
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" style={styles.checkIcon} />
                )}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowDeactivateModal(false);
                    setDeactivateConfirmation('');
                  }}
                  disabled={isDeleting}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                  styles.modalButton,
                    styles.deleteButton,
                    deactivateConfirmation.toUpperCase() === 'DELETE' ? styles.deleteButtonEnabled : styles.deleteButtonDisabled
                  ]}
                  onPress={confirmDeactivateAccount}
                  disabled={isDeleting || deactivateConfirmation.toUpperCase() !== 'DELETE'}
                >
                  <Text style={styles.buttonText}>
                    {isDeleting ? 'Deleting...' : 'Delete Account'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Currency Modal */}
        <Modal
          visible={showCurrencyModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCurrencyModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Currency</Text>
              <ScrollView style={styles.currencyList}>
                {currencies.map((cur) => (
                  <TouchableOpacity
                    key={cur}
                    style={[
                      styles.currencyOption,
                      currency === cur && styles.currencyOptionSelected
                    ]}
                    onPress={() => {
                      handleCurrencyChange(cur);
                      setShowCurrencyModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.currencyOptionText,
                        currency === cur && styles.currencyOptionTextSelected
                      ]}
                    >
                      {cur}
                    </Text>
                    {currency === cur && (
                      <Ionicons name="checkmark" size={20} color={themeColors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowCurrencyModal(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Theme Modal */}
        <Modal
          visible={showThemeModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowThemeModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Theme</Text>
              <ScrollView style={styles.currencyList}>
                {themes.map((thm) => {
                  const themeKey = Object.keys(THEMES).find(key => THEMES[key].name === thm);
                  const localThemeColors = THEMES[themeKey];
                  return (
                    <TouchableOpacity
                      key={thm}
                      style={[
                        styles.currencyOption,
                        selectedTheme === thm && styles.currencyOptionSelected
                      ]}
                      onPress={() => setSelectedTheme(thm)}
                    >
                      <View style={styles.themeOptionContent}>
                        <View style={styles.colorSwatches}>
                          <View style={[styles.colorSwatch, { backgroundColor: localThemeColors.primary }]} />
                          <View style={[styles.colorSwatch, { backgroundColor: localThemeColors.secondary }]} />
                        </View>
                        <Text
                          style={[
                            styles.currencyOptionText,
                            selectedTheme === thm && styles.currencyOptionTextSelected
                          ]}
                        >
                          {thm}
                        </Text>
                      </View>
                      {selectedTheme === thm && (
                        <Ionicons name="checkmark" size={20} color={localThemeColors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowThemeModal(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.modalButton]}
                  onPress={() => {
                    handleThemeChange(selectedTheme);
                    setShowThemeModal(false);
                  }}
                >
                  <Text style={styles.buttonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Logout Modal */}
        <Modal
          visible={showLogoutModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowLogoutModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="warning" size={30} color="#ff6b6b" />
                <Text style={styles.modalTitle}>Logout</Text>
              </View>

              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  Are you sure you want to logout?
                </Text>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowLogoutModal(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.modalButton]}
                  onPress={async () => {
                    try {
                      await AsyncStorage.clear();
                      await signOut(auth);
                      router.replace('/login');
                    } catch (error) {
                      Alert.alert('Logout Error', error.message);
                    }
                  }}
                >
                  <Text style={styles.buttonText}>Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Activity Logs Modal */}
        <Modal
          visible={showActivityLogsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowActivityLogsModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Login History</Text>
              {loadingLogs ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading activity logs...</Text>
                </View>
              ) : activityLogs.length === 0 ? (
                <View style={styles.noLogsContainer}>
                  <Text style={styles.noLogsText}>No login activity found.</Text>
                </View>
              ) : (
                <ScrollView style={styles.logsList}>
                  {activityLogs.map((log, index) => (
                    <View key={index} style={styles.logItem}>
                      <Text style={styles.logText}>
                        <Text style={styles.logLabel}>Device:</Text> {log.device || 'Unknown'}
                      </Text>
                      <Text style={styles.logText}>
                        <Text style={styles.logLabel}>Date:</Text> {new Date(log.timestamp).toLocaleString()}
                      </Text>
                      <Text style={styles.logText}>
                        <Text style={styles.logLabel}>Platform:</Text> {log.platform}
                      </Text>
                      <Text style={styles.logText}>
                        <Text style={styles.logLabel}>Email:</Text> {log.email}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowActivityLogsModal(false)}
                >
                  <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>



      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;

const getStyles = (isDarkMode, themeColors) => StyleSheet.create({
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
    color: isDarkMode ? '#fff' : themeColors.secondary,
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
    color: isDarkMode ? '#fff' : themeColors.secondary,
    marginBottom: 15,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : themeColors.secondary,
    marginBottom: 10,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: isDarkMode ? '#555' : '#ddd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    color: isDarkMode ? '#fff' : themeColors.secondary,
    fontSize: 16,
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
    backgroundColor: themeColors.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: themeColors.primary,
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
    backgroundColor: themeColors.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
    shadowColor: themeColors.primary,
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
    color: isDarkMode ? '#fff' : themeColors.secondary,
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
    backgroundColor: themeColors.secondary,
  },
  dangerButton: {
    backgroundColor: themeColors.primary,
  },
  dangerButtonEnabled: {
    backgroundColor: themeColors.primary,
    shadowColor: themeColors.primary,
  },
  dangerButtonDisabled: {
    backgroundColor: '#cccccc',
    shadowColor: '#cccccc',
  },
  buttonSelected: {
    backgroundColor: themeColors.primary,
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
  warningText: {
    fontSize: 16,
    color: '#ff6b6b',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  confirmationLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
    marginBottom: 10,
  },
  deleteButton: {
    backgroundColor: '#ff6b6b',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  warningContainer: {
    backgroundColor: isDarkMode ? '#2A2A2A' : '#FFF5F5',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  confirmationSection: {
    marginBottom: 20,
  },
  confirmationInput: {
    position: 'relative',
  },
  inputValid: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  inputInvalid: {
    borderColor: isDarkMode ? '#555' : '#ddd',
  },
  checkIcon: {
    position: 'absolute',
    right: 15,
    top: 15,
  },
  deleteButtonEnabled: {
    backgroundColor: '#ff4444',
    shadowColor: '#ff4444',
  },
  deleteButtonDisabled: {
    backgroundColor: '#cccccc',
    shadowColor: '#cccccc',
  },
  currencyButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    borderWidth: 1,
    borderColor: isDarkMode ? '#555' : '#ddd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  currencyButtonText: {
    fontSize: 16,
    color: isDarkMode ? '#fff' : themeColors.secondary,
  },
  currencyList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  currencyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#555' : '#eee',
  },
  currencyOptionSelected: {
    backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
  },
  currencyOptionText: {
    fontSize: 16,
    color: isDarkMode ? '#fff' : themeColors.secondary,
  },
  currencyOptionTextSelected: {
    fontWeight: 'bold',
    color: themeColors.primary,
  },
  themeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorSwatches: {
    flexDirection: 'row',
    marginRight: 15,
  },
  colorSwatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 5,
    borderWidth: 1,
    borderColor: isDarkMode ? '#555' : '#ddd',
  },
  logsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  logItem: {
    backgroundColor: isDarkMode ? '#2A2A2A' : '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: isDarkMode ? '#444' : '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logText: {
    fontSize: 14,
    color: isDarkMode ? '#fff' : themeColors.secondary,
    marginBottom: 5,
    lineHeight: 20,
  },
  logLabel: {
    fontWeight: 'bold',
    color: themeColors.primary,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: isDarkMode ? '#aaa' : '#666',
    fontStyle: 'italic',
  },
  noLogsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noLogsText: {
    fontSize: 16,
    color: isDarkMode ? '#aaa' : '#666',
    fontStyle: 'italic',
  },
});
