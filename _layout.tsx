//_layout.tsx
// app/_layout.tsx or app/layout.tsx (same thing in Expo Router)
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import 'react-native-reanimated';

import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { ref, update } from 'firebase/database';
import { AppProvider, useAppContext } from '../AppContext';
import { auth, database } from '../firebaseConfig';

function RootLayoutContent() {
  const { isDarkMode, themeColors } = useAppContext();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      if (isSignInWithEmailLink(auth, url)) {
        // Get the email from local storage or prompt user
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
          // If email not found, prompt user to enter it
          email = prompt('Please provide your email for confirmation');
        }

        if (!email) {
          Alert.alert('Error', 'Email is required to complete sign-in.');
          return;
        }

        try {
          // Complete sign-in
          const result = await signInWithEmailLink(auth, email, url);
          const user = result.user;

          // Reactivate the account by setting deactivated: false
          const userRef = ref(database, `users/${user.uid}`);
          await update(userRef, { deactivated: false });

          // Clear the email from local storage
          window.localStorage.removeItem('emailForSignIn');

          Alert.alert(
            'Account Reactivated',
            'Your account has been successfully reactivated. You can now log in normally.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // Navigate to login screen
                  // Note: In expo-router, you might need to use router.replace('/login')
                }
              }
            ]
          );
        } catch (error) {
          console.error('Reactivation error:', error);
          Alert.alert('Error', 'Failed to reactivate account. Please try again.');
        }
      }
    };

    // Listen for incoming links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened from a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  if (!loaded) return null;

  return (
    <ThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* Hide header for index.tsx (login screen) */}
        <Stack.Screen name="index" options={{ headerShown: false }} />

        {/* Other screens */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }}/>
        <Stack.Screen name="signup" options={{ headerShown: false }}/>
        <Stack.Screen name="home" options={{ headerShown: false }}/>
        <Stack.Screen name="addexpense" options={{ headerShown: false }}/>
        <Stack.Screen name="addincome" options={{ headerShown: false }}/>
        <Stack.Screen name="budget" options={{ headerShown: false }}/>
        <Stack.Screen name="editBudget" options={{ headerShown: false }}/>
        <Stack.Screen name="budgetDetails" options={{ headerShown: false }}/>
        <Stack.Screen name="settings" options={{ headerShown: false }}/>
        <Stack.Screen name="statistics" options={{ headerShown: false }}/>
        <Stack.Screen name="wishlist" options={{ headerShown: false }}/>
        <Stack.Screen name="editWishlist" options={{ headerShown: false }}/>
        <Stack.Screen name="wishlistDetails" options={{ headerShown: false }}/>
        <Stack.Screen name="savingsGoals" options={{ headerShown: false }}/>
        <Stack.Screen name="resetPassword" options={{ headerShown: false }}/>
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <RootLayoutContent />
    </AppProvider>
  );
}
