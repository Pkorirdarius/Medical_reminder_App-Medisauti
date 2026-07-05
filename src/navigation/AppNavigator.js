import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { HighContrastProvider } from '../utils/HighContrastContext';
import { useTheme } from '../utils/ThemeContext';
import { COLORS, RADIUS, FONT } from '../utils/constants';
import { isConfigured as sbConfigured, onAuthChanged, logoutUser as sbLogout } from '../utils/supabase';
import LandingScreen from '../screens/LandingScreen';
import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';
import PrescriptionScreen from '../screens/PrescriptionScreen';
import RemindersScreen from '../screens/RemindersScreen';
import ReportScreen from '../screens/ReportScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PrescriptionScheduleScreen from '../screens/PrescriptionScheduleScreen';
import DoctorScreen from '../screens/DoctorScreen';
import DoctorAnalyticsScreen from '../screens/DoctorAnalyticsScreen';
import PatientSearchScreen from '../screens/PatientSearchScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function ScanStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ScanHome" component={ScanScreen} />
      <Stack.Screen name="PrescriptionForm" component={PrescriptionScreen} />
    </Stack.Navigator>
  );
}

const PATIENT_TABS = [
  { name: 'Nyumbani',   label: 'Home',        icon: 'view-dashboard-outline',    iconActive: 'view-dashboard',       Component: HomeScreen },
  { name: 'Scan',       label: 'Scan',        icon: 'camera-enhance-outline',    iconActive: 'camera-enhance',       Component: ScanStack },
  { name: 'Dawa',       label: 'Meds',        icon: 'pill',                      iconActive: 'pill',                 Component: PrescriptionScreen },
  { name: 'Vikumbusho', label: 'Reminders',   icon: 'bell-ring-outline',         iconActive: 'bell-ring',            Component: RemindersScreen },
  { name: 'Ripoti',     label: 'Reports',     icon: 'chart-box-outline',         iconActive: 'chart-box',            Component: ReportScreen },
];

const DOCTOR_TABS = [
  { name: 'Uchambuzi', label: 'Analytics',   icon: 'chart-box-outline',         iconActive: 'chart-box',            Component: DoctorAnalyticsScreen },
  { name: 'Daktari',   label: 'Doctor',       icon: 'stethoscope',               iconActive: 'stethoscope',          Component: DoctorScreen },
  { name: 'Wagonjwa',  label: 'Search',       icon: 'account-search-outline',    iconActive: 'account-search',       Component: PatientSearchScreen },
];

function TabIcon({ icon, iconActive, focused, label }) {
  const { COLORS: themeColors } = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 1 }}>
      <MaterialCommunityIcons
        name={focused ? iconActive : icon}
        size={24}
        color={focused ? themeColors.primary : themeColors.outline}
      />
      <Text style={{
        fontSize: 9,
        fontFamily: FONT.body,
        color: focused ? themeColors.primary : themeColors.outline,
        letterSpacing: 0.2,
      }}>
        {label}
      </Text>
    </View>
  );
}

function MainTabs({ userRole }) {
  const { isDark } = useTheme();
  const tabs = userRole === 'doctor' ? DOCTOR_TABS : PATIENT_TABS;
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#161b22' : 'rgba(255,255,255,0.85)',
          borderTopWidth: 0,
          height: 66,
          paddingTop: 6,
          paddingBottom: 6,
          paddingHorizontal: 4,
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
        },
        tabBarShowLabel: false,
      }}
    >
      {tabs.map(({ name, label, icon, iconActive, Component }) => (
        <Tab.Screen
          key={name}
          name={name}
          component={Component}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={icon} iconActive={iconActive} focused={focused} label={label} />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('patient');
  const { COLORS: themeColors } = useTheme();

  useEffect(() => {
    if (sbConfigured()) {
      const unsub = onAuthChanged(user => {
        if (user) {
          setAuthenticated(true);
          import('../utils/storage').then(({ getUser }) =>
            getUser().then(u => setUserRole(u?.role || 'patient'))
          );
        }
        setReady(true);
      });
      return unsub;
    }
    setReady(true);
  }, []);

  function handleAuthSuccess(role) {
    setUserRole(role || 'patient');
    setAuthenticated(true);
  }

  async function handleLogout() {
    if (sbConfigured()) await sbLogout();
    setAuthenticated(false);
    setUserRole('patient');
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center',           backgroundColor: themeColors.background }}>
        <Text style={{ fontSize: 28, fontFamily: FONT.headline, color: themeColors.primary, marginBottom: 16 }}>
          MEDISAUTI
        </Text>
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  return (
    <HighContrastProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!authenticated ? (
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Auth">
              {props => <AuthScreen {...props} onAuthSuccess={handleAuthSuccess} />}
            </Stack.Screen>
          </>
        ) : (
          <>
            <Stack.Screen name="Main">
              {() => <MainTabs userRole={userRole} />}
            </Stack.Screen>
            <Stack.Screen name="Profile">
  {props => <ProfileScreen {...props} onLogout={handleLogout} />}
</Stack.Screen>
            <Stack.Screen name="PrescriptionSchedule" component={PrescriptionScheduleScreen} />
          </>
        )}
      </Stack.Navigator>
    </HighContrastProvider>
  );
}
