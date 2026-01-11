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
  const { isDarkMode, formatAmount, convertToPKR, themeColors, selectedDateRange } = useAppContext();

  // Use global selectedDateRange for consistent filtering
  const startDate = selectedDateRange?.startDate;
  const endDate = selectedDateRange?.endDate;

  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [wishlist, setWishlist] = useState([]);
  const [filteredWishlist, setFilteredWishlist] = useState([]); // 2. Added filtered state

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return unsubscribe;
  }, []);

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

  // 3. Filter Effect
  useEffect(() => {
    const filtered = wishlist.filter(isWishInSelectedRange);
    setFilteredWishlist(filtered);
  }, [wishlist, startDate, endDate]);

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

  // 4. Helper function for date range
  const isWishInSelectedRange = (item) => {
    if (!item.createdAt) return false;
    const createdDate = new Date(item.createdAt);

    // If NO filter is selected (default view), SHOW ONLY CURRENT MONTH ITEMS
    if (!startDate || !endDate) {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const itemMonth = createdDate.getMonth();
      const itemYear = createdDate.getFullYear();
      return itemMonth === currentMonth && itemYear === currentYear;
    }

    // For selected range, show if the selected range is current month or later
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const rangeStart = new Date(startDate);
    const rangeStartMonth = rangeStart.getMonth();
    const rangeStartYear = rangeStart.getFullYear();

    if (rangeStartYear > currentYear || (rangeStartYear === currentYear && rangeStartMonth >= currentMonth)) {
      return true; // Show wishlist items in current or future months
    } else {
      return false; // Don't show wishlist items in past months
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
        data={filteredWishlist} // Render filtered list
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
                const numericValue = text.replace(/[^0-9.]/g, '');
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
        renderItem={({ item }) => {
          return (
            <TouchableOpacity 
              style={styles.card} 
              onPress={() => router.push({ pathname: "/wishlistDetails", params: { id: item.id } })}
            >
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
          );
        }}
        contentContainerStyle={styles.container}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 20, color: 'gray' }}>
            No wishlist items found for this period.
          </Text>
        }
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