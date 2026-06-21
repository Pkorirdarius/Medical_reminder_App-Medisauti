import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { HighContrastProvider } from '../utils/HighContrastContext';
import { COLORS, RADIUS, FONT } from '../utils/constants';
import LandingScreen from '../screens/LandingScreen';
import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import PrescriptionScreen from '../screens/PrescriptionScreen';
import RemindersScreen from '../screens/RemindersScreen';
import ReportScreen from '../screens/ReportScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TABS = [
  { name: 'Nyumbani',   label: 'Home',        icon: 'view-dashboard-outline',    iconActive: 'view-dashboard',       Component: HomeScreen },
  { name: 'Dawa',       label: 'Meds',        icon: 'pill',                      iconActive: 'pill',                 Component: PrescriptionScreen },
  { name: 'Vikumbusho', label: 'Reminders',   icon: 'bell-ring-outline',         iconActive: 'bell-ring',            Component: RemindersScreen },
  { name: 'Ripoti',     label: 'Reports',     icon: 'chart-box-outline',         iconActive: 'chart-box',            Component: ReportScreen },
];

function TabIcon({ icon, iconActive, focused, label }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <MaterialCommunityIcons
        name={focused ? iconActive : icon}
        size={26}
        color={focused ? COLORS.primary : COLORS.outline}
      />
      <Text style={{
        fontSize: 10,
        fontFamily: FONT.body,
        fontWeight: '500',
        color: focused ? COLORS.primary : COLORS.outline,
        letterSpacing: 0.3,
      }}>
        {label}
      </Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.85)',
          borderTopWidth: 0,
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          paddingHorizontal: 8,
          backdropFilter: 'blur(20px)',
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
        },
        tabBarShowLabel: false,
      }}
    >
      {TABS.map(({ name, label, icon, iconActive, Component }) => (
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

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <Text style={{ fontSize: 28, fontFamily: FONT.headline, color: COLORS.primary, marginBottom: 16 }}>
          MEDISAUTI
        </Text>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
              {props => <AuthScreen {...props} onAuthSuccess={() => setAuthenticated(true)} />}
            </Stack.Screen>
          </>
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </HighContrastProvider>
  );
}
