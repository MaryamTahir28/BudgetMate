//_layout.tsx
// app/_layout.tsx or app/layout.tsx (same thing in Expo Router)
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AppProvider, useAppContext } from '../AppContext';

function RootLayoutContent() {
  const { isDarkMode } = useAppContext();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

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
