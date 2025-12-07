//signup.tsx
import { useAppContext } from '../AppContext';
import SignUpScreen from './screens/SignUpScreen';
export default function SignUp() {
  const { themeColors } = useAppContext();
  return <SignUpScreen themeColors={themeColors} />;
}
