# BudgetMate App - Summary of Completed Work

## Overview
BudgetMate is a personal finance management application designed to help users track income, expenses, budgets, savings goals, wishlist items, and more. The app integrates with Firebase to provide a real-time, user-specific data experience. It supports features like date-based filtering, currency conversion, and dark mode, creating a user-friendly and visually appealing interface.

## Key Features and Modules

### 1. Home Screen (Dashboard)
- Displays total balance calculated as income minus expenses.
- Supports viewing and managing income and expenses separately with tabbed navigation.
- Enables searching and filtering transactions by category and date range using a calendar.
- Groups transactions by date and allows expanding notes for each entry.
- Supports adding, editing, and deleting income and expenses.
- Integrated with Firebase for real-time data fetching and updates.
- Provides bottom navigation for quick access to Budget, Statistics, Settings, and Add Transaction screens.

### 2. Add Expense Screen
- Allows users to add or edit expense entries with fields: amount, date, category (select or custom), note, and rent.
- Includes validation for mandatory fields and amount correctness.
- Automatically adjusts associated budget usage on updating/adding expenses.
- Uses Firebase for data storage and synchronization.
- Supports an intuitive UI with a date picker, category selectors, and dark mode.

### 3. Income Module
- Supports tracking income entries separately with fields: amount, date, and category.
- Allows adding, editing, and deleting income items.
- Integrates tightly with other modules like Home, Statistics, and Budgets.
- Data is saved and synced via Firebase real-time database.
- UI supports filtering and search similar to expenses.
- Includes validation and formatting with currency support.
- Contributes to total balance calculation in the dashboard and statistics.

### 4. Savings Goals Screen
- Enables managing savings goals with target amount, timeframe (weeks, months, years), and duration.
- Optionally link savings goals to wishlist items.
- Tracks progress visually with progress bars and allows updating saved amounts manually.
- Uses modals for adding and updating goals.
- Firebase integration for persisting goals and fetching wishlist items.
- Dark mode and currency conversion support.

### 4. Budget Screen
- Allows users to create and manage budgets by category.
- Displays budget amount, used amount, and remaining funds.
- Supports adding new budgets and deleting existing ones.
- Firebase real-time database backing.
- Navigation to budget details and edit budget screens.
- Supports dark and light themes.

### 5. Wishlist Screen
- Supports creating and managing wishlist items with a name and required amount.
- Displays list of wishlist items with edit and delete options.
- Firebase integration for user-specific wishlist data.
- Currency formatting and dark mode supported.

### 6. Statistics Screen
- Displays comprehensive statistics including total income, total expenses, and net balance.
- Supports filtering statistics by time periods: weekly, monthly, and yearly.
- Visualizes expenses over time using bar charts.
- Displays expense category breakdown using interactive pie charts.
- Shows quick statistics including counts of income entries, expense entries, and categories used.
- Integrated with Firebase for live data updates.
- Supports dark mode and currency formatting.

### 7. Settings Screen
- Allows users to update profile details such as display name.
- Implements password reset via email verification link.
- Supports changing app currency with multiple options.
- Enables toggling dark mode on or off.
- Provides navigation links to Wishlist and Savings Goals management.
- Includes account deactivation feature that deletes user data and Firebase account.
- Supports logout functionality.
- Includes user-friendly modal dialogs for sensitive operations.
- Fully supports dark mode styling and user alerts.

## Additional Features
- User authentication managed via Firebase Authentication.
- Data stored internally in PKR with dynamic conversion for display.
- Navigation handled using Expo Router.
- Global state management for currency and theme using React Context.
- Comprehensive error handling and user feedback through alerts.

## Technologies Used
- React Native with Expo framework.
- Firebase Realtime Database and Firebase Authentication.
- Community libraries such as react-native-chart-kit for visualizations, react-native-picker for dropdowns, and others.
- Async Storage for local storage needs.
- Expo Router for navigation and routing.

## Summary
The BudgetMate app provides a thorough personal finance solution allowing users to track income, expenses, budgets, savings goals, and wishlist items, alongside rich statistics and customizable settings. The app leverages Firebase for real-time synchronization and secure user authentication. The UI supports dark mode, multiple currencies, and smooth navigation, making it suitable for everyday financial planning and monitoring.

This summary document is ready for use in your PowerPoint presentation to showcase the current progress and capabilities of the BudgetMate app.
