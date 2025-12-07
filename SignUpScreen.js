//SignUpScreen

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import { auth } from '../../firebaseConfig'; // Adjust the path as needed

const showAlert = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const SignupScreen = ({ themeColors }) => {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const styles = getStyles(themeColors);

    const validatePassword = (password) => {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (password.length < minLength) {
            return 'Password must be at least 8 characters long';
        }
        if (!hasUpperCase) {
            return 'Password must contain at least one uppercase letter';
        }
        if (!hasLowerCase) {
            return 'Password must contain at least one lowercase letter';
        }
        if (!hasNumbers) {
            return 'Password must contain at least one number';
        }
        if (!hasSpecialChar) {
            return 'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)';
        }
        return null; // Valid password
    };

    const handleSignUp = async () => {
  setError(null);

  if (!email || !password || !confirmPassword) {
    setError('Please fill in all fields.');
    return;
  }

  if (password !== confirmPassword) {
    setError('Passwords do not match.');
    return;
  }

  // Validate password strength
  const passwordError = validatePassword(password);
  if (passwordError) {
    setError(passwordError);
    return;
  }

  setLoading(true);

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await sendEmailVerification(user);

    await signOut(auth); // <-- force user to log in manually after email verification

    showAlert(
      'Verify Your Email',
      'We have sent a verification email to your inbox. Please verify before logging in.'
    );

    setLoading(false);
    router.push('/login'); // ensure this path is correct in your router
  } catch (error) {
    setLoading(false);
    showAlert('Signup Failed', error.message);
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

                <Text style={styles.signUpPrompt}>Sign Up for an Account</Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter Email"
                        placeholderTextColor={themeColors.secondary}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        color={themeColors.secondary}
                    />
                    <Icon name="envelope" size={20} color={themeColors.secondary} style={styles.iconInsideInput} />
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter Password"
                        placeholderTextColor={themeColors.secondary}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!passwordVisible}
                        autoCapitalize="none"
                        color={themeColors.secondary}
                    />
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setPasswordVisible(!passwordVisible)}
                    >
                        <Icon name={passwordVisible ? 'eye' : 'eye-slash'} size={20} color={themeColors.secondary} />
                    </TouchableOpacity>
                    <Icon name="lock" size={20} color={themeColors.secondary} style={styles.iconInsideInput} />
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Confirm Password"
                        placeholderTextColor={themeColors.secondary}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!confirmPasswordVisible}
                        autoCapitalize="none"
                        color={themeColors.secondary}
                    />
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                    >
                        <Icon name={confirmPasswordVisible ? 'eye' : 'eye-slash'} size={20} color={themeColors.secondary} />
                    </TouchableOpacity>
                    <Icon name="lock" size={20} color={themeColors.secondary} style={styles.iconInsideInput} />
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity style={styles.buttonContainer} onPress={handleSignUp}>
                    <Text style={styles.buttonText}>Sign Up</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/login')}>
                    <Text style={styles.link}>Already have an account? Login</Text>
                </TouchableOpacity>

                {loading && <ActivityIndicator size="large" color={themeColors.secondary} style={styles.loadingIndicator} />}
            </KeyboardAvoidingView>
        </ScrollView>
        </SafeAreaView>
    );
};

export default SignupScreen;

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
    signUpPrompt: {
        fontSize: 18,
        marginBottom: 10,
        color: themeColors.secondary,
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
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontFamily: 'serif',
    },
    link: {
        color: themeColors.secondary,
        fontSize: 16,
        marginTop: 10,
        textDecorationLine: 'underline',
        fontFamily: 'serif',
    },
    loadingIndicator: {
        marginTop: 20,
    },
    errorText: {
        color: 'red',
        marginBottom: 10,
        textAlign: 'center',
        fontFamily: 'serif',
    },
});
