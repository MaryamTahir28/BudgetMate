import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { onValue, push, ref, remove } from "firebase/database";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useAppContext } from "../../AppContext";
import { auth, database } from "../../firebaseConfig";

export default function WishlistScreen() {

  const router = useRouter();
  const { isDarkMode, formatAmount, currency, convertFromPKR, convertToPKR, themeColors } = useAppContext();

  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [wishlist, setWishlist] = useState([]);

  useEffect(() => {
    if (auth.currentUser) {
      setUser(auth.currentUser);
      setAuthChecked(true);
    }
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, [router, authChecked]);

  // Load wishlist
  useEffect(() => {
    if (!user) return;
    const wishlistRef = ref(database, `users/${user.uid}/wishlist`);
    onValue(wishlistRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedItems = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setWishlist(loadedItems);
      } else {
        setWishlist([]);
      }
    });
  }, [user]);

  // Add wishlist item
  const addWishlistItem = async () => {
    if (!user) {
      Alert.alert("Error", "User not logged in");
      return;
    }
    if (!name || !amount) {
      Alert.alert("Error", "Please fill both item name and amount");
      return;
    }
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert("Error", "Please enter a valid positive amount");
      return;
    }
    try {
      // Convert to PKR before saving
      const pkrAmount = convertToPKR(amountValue);
      await push(ref(database, `users/${user.uid}/wishlist`), {
        name,
        amount: pkrAmount,
        createdAt: new Date().toISOString(),
      });
      Alert.alert("Success", "Item added to wishlist");
      setName("");
      setAmount("");
    } catch (error) {
      Alert.alert("Error", "Failed to add item: " + error.message);
    }
  };

  // Handle wishlist deletion
  const handleDelete = (id) => {
    Alert.alert(
      "Delete Item",
      "Are you sure you want to delete this item?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: () => {
            if (!user) return;
            remove(ref(database, `users/${user.uid}/wishlist/${id}`));
          }
        }
      ]
    );
  };

  const styles = getStyles(isDarkMode, themeColors);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={wishlist}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Manage Wishlist</Text>

            <Text style={styles.label}>Item Name</Text>
            <TextInput
              style={[styles.input, styles.tealInput]}
              placeholder="e.g. Laptop, Phone"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#aaa"
              autoCorrect={false}
            />

            <Text style={styles.label}>Required Amount</Text>
            <TextInput
              style={[styles.input, styles.tealInput]}
              placeholder="Enter amount"
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
              autoCorrect={false}
            />

            <TouchableOpacity style={styles.saveButton} onPress={addWishlistItem}>
              <Text style={styles.saveText}>Add Item</Text>
            </TouchableOpacity>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: "/wishlistDetails", params: { id: item.id } })}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <View style={styles.iconContainer}>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/editWishlist", params: { id: item.id } })}
                  style={styles.editButton}
                >
                  <MaterialCommunityIcons name="pencil" size={20} color={themeColors.secondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  style={styles.deleteButton}
                >
                  <MaterialCommunityIcons name="delete" size={20} color="red" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.cardText}>Amount: {formatAmount(item.amount)}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.container}
      />
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
  saveButton: {
    marginTop: 20,
    backgroundColor: themeColors.primary,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    alignSelf: 'center',
    minWidth: 150,
  },
  saveText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'serif',
    fontWeight: 'bold'
  },
  card: {
    padding: 15,
    borderWidth: 1,
    borderColor: themeColors.primary,
    marginVertical: 8,
    borderRadius: 8,
    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    color: themeColors.primary,
    fontFamily: 'serif',
    flex: 1,
  },
  iconContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  editButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: isDarkMode ? '#333' : '#f0f8ff',
  },
  deleteButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: isDarkMode ? '#4A2A2A' : '#fff0f0',
  },
  cardText: {
    fontSize: 16,
    color: isDarkMode ? '#fff' : themeColors.secondary,
    fontFamily: 'serif',
    marginBottom: 4
  },
});
