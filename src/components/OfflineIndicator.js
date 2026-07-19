import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { FONT } from '../utils/constants';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

export default function OfflineIndicator() {
  const { t } = useLanguage();
  const { COLORS } = useTheme();
  const [isOffline, setIsOffline] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    const sub = NetInfo.addEventListener(state => {
      const offline = !state.isConnected || !state.isInternetReachable;
      setIsOffline(offline);
      Animated.timing(fadeAnim, {
        toValue: offline ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
    return () => sub.remove();
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.banner, { backgroundColor: COLORS.amber[50], opacity: fadeAnim }]}>
      <MaterialCommunityIcons name="wifi-off" size={16} color={COLORS.amber[800]} />
      <Text style={[styles.text, { color: COLORS.amber[800] }]}>
        {t('offline_mode') || 'Offline mode — data saved locally'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    justifyContent: 'center',
  },
  text: {
    fontSize: 12, fontFamily: FONT.bodySemiBold || 'System',
  },
});
