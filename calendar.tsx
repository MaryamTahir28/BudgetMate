import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useAppContext } from '../AppContext';

const CalendarScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { themeColors } = useAppContext();
  const currentYear = parseInt(params.currentYear as string) || new Date().getFullYear();
  const selectedMonth = params.selectedMonth !== undefined ? parseInt(params.selectedMonth as string) : null;
  const selectedDate = params.selectedDate !== undefined ? parseInt(params.selectedDate as string) : null;
  const isDarkMode = params.isDarkMode === 'true';

  const handleDateSelect = (day) => {
    const selectedDateObj = new Date(day.dateString);
    const date = selectedDateObj.getDate();
    const month = selectedDateObj.getMonth();
    const year = selectedDateObj.getFullYear();
    router.push({
      pathname: '/',
      params: {
        selectedDate: date,
        selectedMonth: month,
        currentYear: year,
        applyCalendarFilter: 'true'
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isDarkMode && { color: '#fff' }]}>Select Date</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
      <Calendar
        style={{ flex: 1 }}
        current={`${currentYear}-${String(selectedMonth !== null ? selectedMonth + 1 : new Date().getMonth() + 1).padStart(2, '0')}-01`}
        onDayPress={handleDateSelect}
        markedDates={{
          ...(selectedDate !== null && selectedMonth !== null ? {
            [`${currentYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`]: {
              selected: true,
              selectedColor: themeColors.primary
            }
          } : {})
        }}
        theme={{
          backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
          calendarBackground: isDarkMode ? '#2A2A2A' : '#fff',
          textSectionTitleColor: isDarkMode ? '#fff' : '#003366',
          selectedDayBackgroundColor: themeColors.primary,
          selectedDayTextColor: '#fff',
          todayTextColor: themeColors.primary,
          dayTextColor: isDarkMode ? '#fff' : '#003366',
          textDisabledColor: isDarkMode ? '#555' : '#d9e1e8',
          dotColor: themeColors.primary,
          selectedDotColor: '#fff',
          arrowColor: themeColors.primary,
          disabledArrowColor: isDarkMode ? '#555' : '#d9e1e8',
          monthTextColor: isDarkMode ? '#fff' : '#003366',
          indicatorColor: themeColors.primary,
          textDayFontFamily: 'serif',
          textMonthFontFamily: 'serif',
          textDayHeaderFontFamily: 'serif',
          textDayFontWeight: 'bold',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: 'bold',
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 14,
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#003366',
    fontFamily: 'serif',
  },
  closeButton: {
    backgroundColor: '#003366',
    padding: 10,
    borderRadius: 5,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CalendarScreen;
