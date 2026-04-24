import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import PrescriptionScreen from '../screens/PrescriptionScreen';
import RemindersScreen from '../screens/RemindersScreen';
import ReportScreen from '../screens/ReportScreen';

const Tab = createBottomTabNavigator();

const TEAL = '#0F6E56';
const GRAY = '#888780';

function TabIcon({ label, focused }) {
  const icons = {
    Nyumbani: '🏠',
    Dawa: '💊',
    Vikumbusho: '⏰',
    Ripoti: '📊',
  };
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 20 }}>{icons[label]}</Text>
      <Text style={{ fontSize: 10, color: focused ? TEAL : GRAY, fontWeight: focused ? '600' : '400' }}>
        {label}
      </Text>
    </View>
  );
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e0e0e0',
          borderTopWidth: 0.5,
          height: 65,
          paddingBottom: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Nyumbani"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Nyumbani" focused={focused} /> }}
      />
      <Tab.Screen
        name="Dawa"
        component={PrescriptionScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Dawa" focused={focused} /> }}
      />
      <Tab.Screen
        name="Vikumbusho"
        component={RemindersScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Vikumbusho" focused={focused} /> }}
      />
      <Tab.Screen
        name="Ripoti"
        component={ReportScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Ripoti" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}
