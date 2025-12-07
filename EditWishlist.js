//EditWishList.js
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { onValue, ref, update } from "firebase/database";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useAppContext } from "../../AppContext";
import { auth, database } from "../../firebaseConfig";

export default function EditWishlist() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { isDarkMode, formatAmount, convertToPKR, convertFromPKR, themeColors } = useAppContext();
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        router.push('/login');
      }
    });
    return unsubscribe;
  }, []);

  // Load existing wishlist item data
  useEffect(() => {
    if (!user || !id) return;
    const itemRef = ref(database, `users/${user.uid}/wishlist/${id}`);
    onValue(itemRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setName(data.name || "");
        // Convert from PKR to selected currency for display
        const displayAmount = convertFromPKR(data.amount);
        setAmount(displayAmount.toString());
      }
      setLoading(false);
    });
  }, [id, user]);

  // Update wishlist item
  const updateWishlistItem = () => {
    if (!user || !name.trim() || !amount.trim()) {
      Alert.alert("Error", "Please fill item name and amount");
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert("Error", "Please enter a valid positive amount");
      return;
    }

    // Convert to PKR before saving
    const pkrAmount = convertToPKR(amountValue);

    update(ref(database, `users/${user.uid}/wishlist/${id}`), {
      name: name.trim(),
      amount: pkrAmount.toString(),
    }).then(() => {
      Alert.alert("Success", "Wishlist item updated successfully");
      router.back();
    }).catch((error) => {
      Alert.alert("Error", "Failed to update wishlist item");
      console.error(error);
    });
  };

  if (loading) {
    const styles = getStyles(isDarkMode, themeColors);
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={{ color: isDarkMode ? '#fff' : themeColors.secondary }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const styles = getStyles(isDarkMode, themeColors);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Edit Wishlist Item</Text>

        <Text style={styles.label}>Item Name</Text>
        <TextInput
          style={[styles.input, styles.tealInput]}
          placeholder="Item Name"
          value={name}
          onChangeText={setName}
          placeholderTextColor="#aaa"
        />

        <Text style={styles.label}>Required Amount</Text>
        <TextInput
          style={[styles.input, styles.tealInput]}
          placeholder="Amount"
          keyboardType="numeric"
          value={amount}
          onChangeText={(text) => {
            // Only allow positive numbers and decimals
            const numericValue = text.replace(/[^0-9.]/g, '');
            // Prevent multiple decimal points
            const parts = numericValue.split('.');
            if (parts.length > 2) {
              setAmount(parts[0] + '.' + parts.slice(1).join(''));
            } else {
              setAmount(numericValue);
            }
          }}
          placeholderTextColor="#aaa"
        />



        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.saveButton} onPress={updateWishlistItem}>
            <Text style={styles.saveText}>Update Item</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (isDarkMode, themeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: isDarkMode ? '#121212' : '#F9F9F9',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    padding: 20,
    backgroundColor: isDarkMode ? '#121212' : '#F9F9F9',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: themeColors.primary,
    fontFamily: 'serif',
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    color: isDarkMode ? '#fff' : themeColors.secondary,
    marginTop: 12,
    fontFamily: 'serif',
  },
  input: {
    borderWidth: 1,
    borderColor: isDarkMode ? '#555' : '#D3D3D3',
    padding: 10,
    borderRadius: 5,
    fontSize: 16,
    marginTop: 6,
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
    fontFamily: 'serif',
  },
  tealInput: { color: isDarkMode ? '#fff' : themeColors.secondary },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  saveButton: {
    backgroundColor: themeColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderRadius: 8,
  },
  saveText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'serif',
    fontWeight: 'bold'
  },
  cancelButton: {
    backgroundColor: themeColors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderRadius: 8,
  },
  cancelText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'serif',
    fontWeight: 'bold'
  },
});
