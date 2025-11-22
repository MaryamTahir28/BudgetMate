import { useLocalSearchParams, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAppContext } from '../../AppContext';
import { auth, database } from '../../firebaseConfig';

export default function WishlistDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { isDarkMode, formatAmount, convertFromPKR } = useAppContext();

  const [user, setUser] = useState(null);
  const [wish, setWish] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user || !id) return;
    const wishRef = ref(database, `users/${user.uid}/wishlist/${id}`);
    onValue(wishRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Convert amounts for display
        const amount = convertFromPKR(data.amount);
        const savedAmount = data.savedAmount ? convertFromPKR(parseFloat(data.savedAmount)) : 0;
        const remaining = amount - savedAmount;
        setWish({
          name: data.name,
          amount,
          savedAmount,
          remaining,
        });
      }
    });
  }, [user, id]);

  if (!wish) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={{ color: isDarkMode ? '#fff' : '#000' }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{wish.name}</Text>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Required Amount:</Text>
          <Text style={styles.value}>{formatAmount(wish.amount)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Saved Amount:</Text>
          <Text style={styles.value}>{formatAmount(wish.savedAmount)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Remaining Amount:</Text>
          <Text style={styles.value}>{formatAmount(wish.remaining)}</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={() => router.push({ pathname: '/editWishlist', params: { id } })}>
          <Text style={styles.buttonText}>Edit Wish</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    backgroundColor: '#F9F9F9',
  },
  container: {
    padding: 20,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#800080',
    fontFamily: 'serif',
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'serif',
  },
  value: {
    fontSize: 18,
    color: '#800080',
    fontFamily: 'serif',
  },
  button: {
    backgroundColor: '#800080',
    padding: 15,
    borderRadius: 10,
    marginTop: 30,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'serif',
  },
});
