//LoginScreen

import { useRouter } from 'expo-router';
import { sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import { auth } from '../../firebaseConfig'; // adjust path as needed

const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${message}`);
    } else {
        Alert.alert(title, message);
    }
};
const LoginScreen = () => {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
  if (!email || !password) {
    showAlert('Missing Information', 'Please enter both email and password to continue.');
    return;
  }

  setLoading(true);

  try {
    // 🔐 Sign in
    await signInWithEmailAndPassword(auth, email, password);

    // ✅ Refresh user from Firebase
    const currentUser = auth.currentUser;
    await currentUser?.reload(); // reload from server
    const refreshedUser = auth.currentUser; // re-fetch after reload

    if (!refreshedUser?.emailVerified) {
      setLoading(false);

      // 🔁 Handle unverified email (mobile vs web)
      if (Platform.OS === 'web') {
        const resend = confirm('Your email is not verified.\n\nDo you want to resend the verification email?');
        if (resend) {
          try {
            await sendEmailVerification(refreshedUser);
            window.alert('Verification Sent\n\nA verification link has been sent to your email.');
          } catch (err) {
            window.alert('Failed to Send Email\n\n' + err.message);
          }
        }
      } else {
        Alert.alert(
          'Email Not Verified',
          'Please verify your email before logging in.',
          [
            {
              text: 'Resend Email',
              onPress: async () => {
                try {
                  await sendEmailVerification(refreshedUser);
                  showAlert('Verification Sent', 'Check your inbox for the verification link.');
                } catch (err) {
                  showAlert('Failed to Send Email', err.message);
                }
              },
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }

      await auth.signOut();
      return;
    }

    // ✅ Verified: allow login
    console.log("Logged in:", refreshedUser.email);
    setLoading(false);
    router.replace('/home');

  } catch (error) {
    setLoading(false);
    console.log('Login error:', error);
    let message = 'Invalid Credentials. Please check and try again.';
    showAlert('Login Failed', message);
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
        
        await sendPasswordResetEmail(auth, email);
        showAlert(
            'Password Reset Email Sent',
            'A password reset link has been sent to your registered email address. Please check your inbox. Note: Your new password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*(),.?":{}|<>).'
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
                        placeholder="Enter Email"
                        placeholderTextColor="#003366"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        color="#003366"
                    />
                    <Icon name="envelope" size={20} color="#003366" style={styles.iconInsideInput} />
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter Password"
                        placeholderTextColor="#003366"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!passwordVisible}
                        autoCapitalize="none"
                        color="#003366"
                    />
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setPasswordVisible(!passwordVisible)}
                    >
                        <Icon name={passwordVisible ? 'eye' : 'eye-slash'} size={20} color="#003366" />
                    </TouchableOpacity>
                    <Icon name="lock" size={20} color="#003366" style={styles.iconInsideInput} />
                </View>

                <TouchableOpacity style={styles.buttonContainer} onPress={handleLogin}>
                    <Text style={styles.buttonText}>Login</Text>
                </TouchableOpacity>

                <TouchableOpacity  onPress={handleForgotPassword}>
                    <Text style={styles.link}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/signup')}>
                    <Text style={styles.link}>Don't have an account? Sign up</Text>
                </TouchableOpacity>

                {loading && <ActivityIndicator size="large" color="#003366" style={styles.loadingIndicator} />}
            </KeyboardAvoidingView>
        </ScrollView>
        </SafeAreaView>
    );
};

export default LoginScreen;

const styles = StyleSheet.create({
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
        backgroundColor: '#800080',
        color: 'white',
        borderColor: '#800080',
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
        color: '#003366',
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
        color: '#003366',
    },
    buttonContainer: {
        borderRadius: 10,
        backgroundColor: '#800080',
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
        color: '#003366',
        fontSize: 16,
        marginTop: 10,
        textDecorationLine: 'underline',
        fontFamily: 'serif',
    },
    loadingIndicator: {
        marginTop: 20,
    },
});