// app/index.tsx
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import LoginScreen from './screens/LoginScreen';

export default function index() {
  const router = useRouter();

  useEffect(() => {
    const handleDeepLink = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        const url = new URL(initialUrl);
        const mode = url.searchParams.get('mode');
        const oobCode = url.searchParams.get('oobCode');
        if (mode === 'resetPassword' && oobCode) {
          router.replace(`/resetPassword?mode=${mode}&oobCode=${oobCode}`);
        }
      }
    };

    handleDeepLink();

    const subscription = Linking.addEventListener('url', (event) => {
      const url = new URL(event.url);
      const mode = url.searchParams.get('mode');
      const oobCode = url.searchParams.get('oobCode');
      if (mode === 'resetPassword' && oobCode) {
        router.replace(`/resetPassword?mode=${mode}&oobCode=${oobCode}`);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [router]);

  return <LoginScreen />;
}

