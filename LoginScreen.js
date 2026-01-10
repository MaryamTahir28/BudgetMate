import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Linking from 'expo-linking'; // ✅ Import Linking
import { useFocusEffect, useRouter } from 'expo-router';
import {
    isSignInWithEmailLink,
    sendPasswordResetEmail, // Added back in case you need it
    signInWithEmailAndPassword,
    signInWithEmailLink
} from 'firebase/auth';
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
import { auth, database } from '../../firebaseConfig';

const LoginScreen = () => {
    const router = useRouter();
    const { themeColors } = useAppContext();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Blocking Logic State
    const [loginBlocked, setLoginBlocked] = useState(false);
    const [blockTimer, setBlockTimer] = useState(0);
    const [failedAttempts, setFailedAttempts] = useState(0);

    const showAlert = (title, message) => Alert.alert(title, message);

    // Timer for local block
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

    // ✅ NEW: DEEP LINK LISTENER (Handles the click from the email)
    useEffect(() => {
        const handleDeepLink = async ({ url }) => {
            if (!url) return;

            // Check if this is the Reactivation Link from Firebase
            if (isSignInWithEmailLink(auth, url)) {
                setLoading(true);
                try {
                    // Get the email we saved when we sent the link
                    const savedEmail = await AsyncStorage.getItem('reactivationEmail');
                    if (!savedEmail) {
                        showAlert('Error', 'Please enter your email manually to confirm reactivation.');
                        setLoading(false);
                        return;
                    }

                    // 1. Sign in via the Link
                    const result = await signInWithEmailLink(auth, savedEmail, url);
                    const user = result.user;

                    // 2. Reactivate in Database
                    const userRef = ref(database, `users/${user.uid}`);
                    await update(userRef, { deactivated: false });

                    // 3. Clean up and Go Home
                    await AsyncStorage.removeItem('reactivationEmail');
                    showAlert('Success', 'Your account has been successfully reactivated!');
                    router.replace('/home');
                } catch (error) {
                    console.log('Link Error', error);
                    showAlert('Link Expired', 'This link is invalid or expired. Please login to get a new one.');
                } finally {
                    setLoading(false);
                }
            }
        };

        // Listen for links if app is already open
        const subscription = Linking.addEventListener('url', handleDeepLink);

        // Check for link if app was closed and opened via email
        Linking.getInitialURL().then((url) => {
            if (url) handleDeepLink({ url });
        });

        return () => subscription.remove();
    }, []);

    const styles = getStyles(themeColors);

    // Prevent Back Button
    useFocusEffect(() => {
        const backAction = () => true; 
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    });

    const handleLogin = async () => {
        // 1. Basic Checks
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
            // 2. 🔐 Attempt Authentication (Checks if password is correct)
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const currentUser = userCredential.user;

            // 3. 🛑 Check Database for Deactivation
            const userRef = ref(database, `users/${currentUser.uid}`);
            const userSnapshot = await get(userRef);
            const userData = userSnapshot.val();

            // === SPECIAL REACTIVATION LOGIC ===
            if (userData?.deactivated) {
                
                // Check if we previously flagged this user for reactivation on this device
                const pendingReactivation = await AsyncStorage.getItem(`reactivation_pending_${currentUser.email}`);

                if (pendingReactivation === 'true') {
                    // ✅ SUCCESS: User came back after the reset flow!
                    
                    // 1. Reactivate in Database
                    await update(userRef, { deactivated: false });
                    
                    // 2. Clear the local flag
                    await AsyncStorage.removeItem(`reactivation_pending_${currentUser.email}`);
                    
                    showAlert('Account Reactivated', 'Welcome back! Your account has been successfully reactivated.');
                    
                    // Continue to normal login success below...
                } else {
                    // ❌ FIRST ATTEMPT: User is deactivated and hasn't started the flow yet.

                    // 1. Send Password Reset Email
                    await sendPasswordResetEmail(auth, email);

                    // 2. Set the "Flag" in local storage
                    // We save this so when they come back, we know to let them in.
                    await AsyncStorage.setItem(`reactivation_pending_${currentUser.email}`, 'true');

                    // 3. Alert the user
                    showAlert(
                        'Reactivation Required', 
                        'Your account is currently deactivated.\n\nTo reactivate it, we have sent a password reset link to your email.\n\n1. Check your email and reset your password.\n2. Return here and login with your NEW password to unlock your account.'
                    );

                    // 4. Force Logout (Block access)
                    await auth.signOut();
                    setLoading(false);
                    return; // Stop here
                }
            }
            // ==================================

            // 4. ✅ Success: Proceed to Home
            console.log("Logged in:", currentUser.email);
            setFailedAttempts(0);

            // 5. 📝 Log Activity
            try {
                const deviceName = Device.modelName || `${Platform.OS} Device`;
                const activityRef = ref(database, `users/${currentUser.uid}/activityLogs`);
                const newActivityRef = push(activityRef);
                await update(newActivityRef, {
                    action: 'login',
                    timestamp: new Date().toISOString(),
                    platform: Platform.OS,
                    email: currentUser.email,
                    device: deviceName,
                });
            } catch (logError) {
                console.error('Failed to log login activity:', logError);
            }

            setLoading(false);
            router.replace('/home');

        } catch (error) {
            setLoading(false);
            if (error.code === 'auth/too-many-requests') {
                showAlert('Server Cooldown', 'Too many attempts. Please wait a full minute.');
                return;
            }

            // Standard Error Handling
            let errorMessage = 'An error occurred. Please try again.';
            let shouldIncrement = false;

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
                errorMessage = 'This account has been disabled permanently.';
            } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
                shouldIncrement = true;
                errorMessage = 'Invalid email or password.'; // Generic message for security
            }


            if (shouldIncrement) {
                const newFailedAttempts = failedAttempts + 1;
                setFailedAttempts(newFailedAttempts);
                if (newFailedAttempts >= 4) {
                    showAlert('Too Many Failed Attempts', 'Login blocked for 15 seconds.');
                    setLoginBlocked(true);
                    setBlockTimer(15);
                    setFailedAttempts(0);
                    return;
                }
            }
            showAlert('Login Failed', errorMessage);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            showAlert('Missing Email', 'Please enter your registered email to reset your password.');
            return;
        }
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            showAlert('Password Reset Email Sent', 'Check your inbox for the password reset link.');
        } catch (error) {
            showAlert('Reset Failed', error.message);
        } finally {
            setLoading(false);
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
                        source={require('../../assets/images/icon.png')}
                    />
                    <Text style={styles.loginPrompt}>Login to Your Account</Text>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={[styles.input, { color: themeColors.secondary }]}
                            placeholder={loginBlocked ? "Login blocked..." : "Enter Email"}
                            placeholderTextColor={themeColors.secondary}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            selectionColor={themeColors.secondary}
                            editable={!loginBlocked}
                        />
                        <Icon name="envelope" size={20} color={themeColors.secondary} style={styles.iconInsideInput} />
                    </View>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={[styles.input, { color: themeColors.secondary }]}
                            placeholder={loginBlocked ? "Login blocked..." : "Enter Password"}
                            placeholderTextColor={themeColors.secondary}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!passwordVisible}
                            autoCapitalize="none"
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

                    <TouchableOpacity 
                        style={[styles.buttonContainer, loginBlocked && styles.disabledButton]} 
                        onPress={handleLogin} 
                        disabled={loginBlocked}
                    >
                        <Text style={styles.buttonText}>{loginBlocked ? `Wait ${blockTimer}s` : 'Login'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleForgotPassword}>
                        <Text style={styles.link}>Forgot Password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.push('/signup')}>
                        <Text style={styles.link}>Don't have an account? Sign up</Text>
                    </TouchableOpacity>

                    {loading && <ActivityIndicator size="large" color={themeColors.primary} style={styles.loadingIndicator} />}
                </KeyboardAvoidingView>
            </ScrollView>
        </SafeAreaView>
    );
};

export default LoginScreen;
// ... (Your getStyles function remains exactly the same)
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