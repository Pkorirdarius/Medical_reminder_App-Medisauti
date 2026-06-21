import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Text } from 'react-native';
import * as Font from 'expo-font';
import {
  Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold,
  Lexend_700Bold, Lexend_800ExtraBold, Lexend_900Black,
} from '@expo-google-fonts/lexend';
import {
  PublicSans_400Regular, PublicSans_500Medium,
  PublicSans_600SemiBold, PublicSans_700Bold,
} from '@expo-google-fonts/public-sans';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      await Font.loadAsync({
        Lexend:          Lexend_400Regular,
        'Lexend-Medium':   Lexend_500Medium,
        'Lexend-SemiBold': Lexend_600SemiBold,
        'Lexend-Bold':     Lexend_700Bold,
        'Lexend-ExtraBold': Lexend_800ExtraBold,
        'Lexend-Black':    Lexend_900Black,
        PublicSans:          PublicSans_400Regular,
        'PublicSans-Medium':   PublicSans_500Medium,
        'PublicSans-SemiBold': PublicSans_600SemiBold,
        'PublicSans-Bold':     PublicSans_700Bold,
      });
      setFontsLoaded(true);
    }
    load();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9faf5' }}>
        <Text style={{ fontSize: 28, fontFamily: 'Lexend-ExtraBold', color: '#00513f', marginBottom: 16 }}>MEDISAUTI</Text>
        <ActivityIndicator size="large" color="#00513f" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" backgroundColor="#f9faf5" />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
