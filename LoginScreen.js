//LoginScreen

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { get, push, ref, update } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useAppContext } from '../../AppContext';
import { auth, database } from '../../firebaseConfig'; // adjust path as needed

const LoginScreen = () => {
    const router = useRouter();
    const { themeColors } = useAppContext();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loginBlocked, setLoginBlocked] = useState(false);
    const [blockTimer, setBlockTimer] = useState(0);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const showAlert = (title, message) => {
        Alert.alert(title, message);
    };

    useEffect(() => {
        if (loginBlocked) {
            const interval = setInterval(() => {
                setBlockTimer((prev) => {
                    if (prev <= 1) {
                        setLoginBlocked(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [loginBlocked]);

    const styles = getStyles(themeColors);

    useFocusEffect(() => {
        const backAction = () => {
            // Prevent back navigation on login screen
            return true;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

        return () => {
            backHandler.remove();
        };
    });

    const handleLogin = async () => {
  if (loginBlocked) {
    showAlert('Login Blocked', `Please wait ${blockTimer} seconds before trying again.`);
    return;
  }

  if (!email || !password) {
    showAlert('Missing Information', 'Please enter both email and password to continue.');
    return;
  }

  setLoading(true);

  try {
    console.log("Attempting to sign in with email:", email);
    // 🔐 Sign in
    await signInWithEmailAndPassword(auth, email, password);
    console.log("Sign in successful");

    // ✅ Refresh user from Firebase
    const currentUser = auth.currentUser;
    await currentUser?.reload(); // reload from server
    const refreshedUser = auth.currentUser; // re-fetch after reload
    console.log("User refreshed:", refreshedUser?.email);

    // Check if account is deactivated
    const userRef = ref(database, `users/${refreshedUser.uid}`);
    const userSnapshot = await get(userRef);
    const userData = userSnapshot.val();
    console.log("User data:", userData);

    if (userData?.deactivated) {
      setLoading(false);
      showAlert('Account Deactivated', 'Your account has been deactivated. Please reactivate your account to continue.');
      await auth.signOut();
      return;
    }

    // ✅ Verified and active: allow login
    console.log("Logged in:", refreshedUser.email);

    // Reset failed attempts on successful login
    setFailedAttempts(0);

    // Log login activity
    try {
      const activityRef = ref(database, `users/${refreshedUser.uid}/activityLogs`);
      const newActivityRef = push(activityRef);
      await update(newActivityRef, {
        action: 'login',
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
        email: refreshedUser.email,
      });
      console.log("Login activity logged");
    } catch (logError) {
      console.error('Failed to log login activity:', logError);
    }

    setLoading(false);
    console.log("Navigating to home");
    router.replace('/home');

  } catch (error) {
    setLoading(false);
    console.log('Login error:', error);
    let shouldIncrement = false;
    let errorMessage = 'Invalid Credentials. Please check and try again.';
    if (error.code === 'auth/user-not-found') {
      shouldIncrement = true;
      errorMessage = 'No account found with this email address.';
    } else if (error.code === 'auth/wrong-password') {
      shouldIncrement = true;
      errorMessage = 'Incorrect password. Please try again.';
    } else if (error.code === 'auth/invalid-email') {
      shouldIncrement = true;
      errorMessage = 'Please enter a valid email address.';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'This account has been disabled.';
    } else if (error.code === 'auth/too-many-requests') {
      shouldIncrement = true;
      errorMessage = 'Too many failed login attempts.';
    }

    if (shouldIncrement) {
      const newFailedAttempts = failedAttempts + 1;
      setFailedAttempts(newFailedAttempts);
      console.log('Failed attempts:', newFailedAttempts);
      if (newFailedAttempts >= 3) {
        console.log('Blocking login for 15 seconds');
        showAlert('Too Many Failed Attempts', 'You have exceeded the maximum number of login attempts. Login is blocked for 15 seconds.');
        setLoginBlocked(true);
        setBlockTimer(15);
        setFailedAttempts(0);
        return; // Do not show the "Login Failed" alert when blocking
      }
    }

    showAlert('Login Failed', errorMessage);
  }
};



    //forget password handle
    const handleForgotPassword = async () => {
    if (!email) {
        showAlert('Missing Email', 'Please enter your registered email to reset your password.');
        return;
    }

    setLoading(true);

    try {
        const actionCodeSettings = {
            url: 'https://budgetmate-a7900.firebaseapp.com/__/auth/action',
            handleCodeInApp: true,
        };
        await sendPasswordResetEmail(auth, email, actionCodeSettings);
        showAlert(
            'Password Reset Email Sent',
            'A password reset link has been sent to your registered email address. Please check your inbox and click the link to reset your password within the app. Note: Your new password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*(),.?":{}|<>).'
        );
    } catch (error) {
        let message = 'Something went wrong. Please try again.';
        if (error.code === 'auth/user-not-found') {
            message = 'No user found with this email.';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Please enter a valid email address.';
        }
        showAlert('Reset Failed', message);
    } finally {
        setLoading(false);
    }
};

    const handleReactivateAccount = async () => {
        if (!email || !password) {
            showAlert('Missing Information', 'Please enter both email and password to reactivate your account.');
            return;
        }

        setLoading(true);

        try {
            // Sign in with email and password
            await signInWithEmailAndPassword(auth, email, password);

            // Refresh user
            const currentUser = auth.currentUser;
            await currentUser?.reload();
            const refreshedUser = auth.currentUser;

            if (!refreshedUser?.emailVerified) {
                setLoading(false);
                // Send verification email
                try {
                    await sendEmailVerification(refreshedUser);
                    showAlert('Verification Email Sent', 'A verification link has been sent to your email. Please click the link to verify your email, then try reactivating again.');
                } catch (error) {
                    showAlert('Error', 'Failed to send verification email. Please try again.');
                }
                await auth.signOut();
                return;
            }

            // Check if account is deactivated
            const userRef = ref(database, `users/${refreshedUser.uid}`);
            const userSnapshot = await get(userRef);
            const userData = userSnapshot.val();

            if (!userData?.deactivated) {
                setLoading(false);
                showAlert('Account Already Active', 'Your account is already active. You can log in normally.');
                await auth.signOut();
                return;
            }

            // Reactivate account
            await update(userRef, { deactivated: false });

            // Clear any stored data and proceed to home
            await AsyncStorage.clear();
            setLoading(false);
            showAlert('Account Reactivated', 'Your account has been successfully reactivated.');
            router.replace('/home');

        } catch (error) {
            setLoading(false);
            console.log('Reactivation error:', error);
            let message = 'Failed to reactivate account. Please try again.';
            if (error.code === 'auth/user-not-found') {
                message = 'No account found with this email address.';
            } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                message = 'Incorrect email or password. Please try again.';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Please enter a valid email address.';
            } else if (error.code === 'auth/user-disabled') {
                message = 'This account has been disabled.';
            } else if (error.code === 'auth/too-many-requests') {
                message = 'Too many failed attempts. Please try again later.';
            }
            showAlert('Reactivation Failed', message);
        }
    };



    return (
        <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.container}
            >
                <Text style={styles.title}>BudgetMate</Text>

                <Image
                    style={styles.logo}
                    source={{ uri: 'https://i.pinimg.com/736x/01/33/ff/0133ffbaeb8fa0c1e881f64d0c93e571.jpg' }}
                />

                <Text style={styles.loginPrompt}>Login to Your Account</Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder={loginBlocked ? "Login blocked, please wait..." : "Enter Email"}
                        placeholderTextColor={themeColors.secondary}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        color={themeColors.secondary}
                        selectionColor={themeColors.secondary}
                        editable={!loginBlocked}
                    />
                    <Icon name="envelope" size={20} color={themeColors.secondary} style={styles.iconInsideInput} />
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder={loginBlocked ? "Login blocked, please wait..." : "Enter Password"}
                        placeholderTextColor={themeColors.secondary}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!passwordVisible}
                        autoCapitalize="none"
                        color={themeColors.secondary}
                        selectionColor={themeColors.secondary}
                        editable={!loginBlocked}
                    />
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setPasswordVisible(!passwordVisible)}
                        disabled={loginBlocked}
                    >
                        <Icon name={passwordVisible ? 'eye' : 'eye-slash'} size={20} color={themeColors.secondary} />
                    </TouchableOpacity>
                    <Icon name="lock" size={20} color={themeColors.secondary} style={styles.iconInsideInput} />
                </View>

                <TouchableOpacity style={[styles.buttonContainer, loginBlocked && styles.disabledButton]} onPress={handleLogin} disabled={loginBlocked}>
                    <Text style={styles.buttonText}>{loginBlocked ? `Wait ${blockTimer}s` : 'Login'}</Text>
                </TouchableOpacity>

                <TouchableOpacity  onPress={handleForgotPassword}>
                    <Text style={styles.link}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/signup')}>
                    <Text style={styles.link}>Don't have an account? Sign up</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleReactivateAccount}>
                    <Text style={styles.link}>Reactivate Account</Text>
                </TouchableOpacity>



                {loading && <ActivityIndicator size="large" color={themeColors.primary} style={styles.loadingIndicator} />}
            </KeyboardAvoidingView>
        </ScrollView>
        </SafeAreaView>
    );
};

export default LoginScreen;

const getStyles = (themeColors) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F9F9F9',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        backgroundColor: '#F9F9F9',
    },
    container: {
        flex: 1,
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        backgroundColor: themeColors.primary,
        color: 'white',
        borderColor: themeColors.primary,
        borderWidth: 1,
        padding: 10,
        alignSelf: 'stretch',
        textAlign: 'center',
        fontFamily: 'serif',
    },
    logo: {
        width: 100,
        height: 100,
        marginBottom: 20,
        borderRadius: 50,
    },
    loginPrompt: {
        fontSize: 18,
        marginBottom: 10,
        color: themeColors.primary,
        fontFamily: 'serif',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        position: 'relative',
        width: '100%',
    },
    iconInsideInput: {
        position: 'absolute',
        left: 10,
        zIndex: 10,
    },
    eyeIcon: {
        position: 'absolute',
        right: 10,
        zIndex: 10,
    },
    input: {
        flex: 1,
        height: 45,
        borderWidth: 1,
        borderColor: '#D3D3D3',
        paddingLeft: 40,
        paddingRight: 40,
        borderRadius: 5,
        backgroundColor: 'white',
        fontSize: 16,
        fontFamily: 'serif',
        color: themeColors.secondary,
    },
    buttonContainer: {
        borderRadius: 10,
        backgroundColor: themeColors.primary,
        paddingVertical: 10,
        paddingHorizontal: 20,
        marginVertical: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    disabledButton: {
        backgroundColor: '#ccc',
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontFamily: 'serif',
    },
    link: {
        color: themeColors.primary,
        fontSize: 16,
        marginTop: 10,
        textDecorationLine: 'underline',
        fontFamily: 'serif',
    },
    loadingIndicator: {
        marginTop: 20,
    },
});