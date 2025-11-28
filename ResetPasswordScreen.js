import { useLocalSearchParams, useRouter } from 'expo-router';
import { confirmPasswordReset } from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { auth } from '../../firebaseConfig';

const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${message}`);
    } else {
        Alert.alert(title, message);
    }
};

const ResetPasswordScreen = () => {
    const router = useRouter();
    const { mode, oobCode } = useLocalSearchParams();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (mode !== 'resetPassword' || !oobCode) {
            showAlert('Invalid Link', 'The password reset link is invalid or expired.');
            router.replace('/login');
        }
    }, [mode, oobCode]);

    const handleResetPassword = async () => {
        if (!newPassword || !confirmPassword) {
            showAlert('Missing Information', 'Please enter and confirm your new password.');
            return;
        }
        if (newPassword !== confirmPassword) {
            showAlert('Password Mismatch', 'Passwords do not match.');
            return;
        }
        if (newPassword.length < 8 ||
            !/[A-Z]/.test(newPassword) ||
            !/[a-z]/.test(newPassword) ||
            !/[0-9]/.test(newPassword) ||
            !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
            showAlert('Invalid Password', 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
            return;
        }

        setLoading(true);

        try {
            await confirmPasswordReset(auth, oobCode, newPassword);
            showAlert('Password Reset', 'Your password has been successfully reset. You can now log in with your new password.');
            router.replace('/login');
        } catch (error) {
            console.log('Reset error:', error);
            let message = 'Something went wrong. Please try again.';
            if (error.code === 'auth/expired-action-code') {
                message = 'The reset link has expired. Please request a new one.';
            } else if (error.code === 'auth/invalid-action-code') {
                message = 'The reset link is invalid. Please request a new one.';
            } else if (error.code === 'auth/user-disabled') {
                message = 'This user account has been disabled.';
            } else if (error.code === 'auth/user-not-found') {
                message = 'No user found with this email.';
            } else if (error.code === 'auth/weak-password') {
                message = 'The password is too weak.';
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

                    <Text style={styles.resetPrompt}>Reset Your Password</Text>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter New Password"
                            placeholderTextColor="#003366"
                            value={newPassword}
                            onChangeText={setNewPassword}
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

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm New Password"
                            placeholderTextColor="#003366"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!confirmPasswordVisible}
                            autoCapitalize="none"
                            color="#003366"
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                        >
                            <Icon name={confirmPasswordVisible ? 'eye' : 'eye-slash'} size={20} color="#003366" />
                        </TouchableOpacity>
                        <Icon name="lock" size={20} color="#003366" style={styles.iconInsideInput} />
                    </View>

                    <TouchableOpacity style={styles.buttonContainer} onPress={handleResetPassword}>
                        <Text style={styles.buttonText}>Reset Password</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.replace('/login')}>
                        <Text style={styles.link}>Back to Login</Text>
                    </TouchableOpacity>

                    {loading && <ActivityIndicator size="large" color="#003366" style={styles.loadingIndicator} />}
                </KeyboardAvoidingView>
            </ScrollView>
        </SafeAreaView>
    );
};

export default ResetPasswordScreen;

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
    resetPrompt: {
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
