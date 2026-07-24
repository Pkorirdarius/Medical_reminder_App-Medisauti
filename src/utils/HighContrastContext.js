import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS as BASE } from './constants';

const HC_KEY = 'medisauti:high_contrast';

const HC_COLORS = {
  primary:        '#003d2c',
  primaryContainer: '#00513f',
  onPrimaryContainer: '#c4ffdd',
  primaryFixed:   '#6bdebc',

  secondary:       '#0a3d6e',
  secondaryContainer: '#6ba6ff',
  onSecondaryFixedVariant: '#002c54',

  background:       '#ffffff',
  surfaceLowest:    '#ffffff',
  surfaceLow:       '#f0f0ec',
  surfaceHigh:      '#e0e0dc',

  onSurface:        '#000000',
  onSurfaceVariant: '#1a2c24',
  outline:          '#2a3e36',

  error:            '#ba1a1a',
  errorContainer:   '#ffdad6',
  errorMuted:       'rgba(186,26,26,0.50)',

  warning:          '#8B6914',

  teal:     { 50: '#C8E6D9', 100: '#6BBF9F', 400: '#006B4D', 600: '#003D2C', 800: '#001A12' },
  amber:    { 50: '#FFE0B2', 400: '#E65100', 800: '#3E1A00' },
  red:      { 50: '#FFCDD2', 400: '#C62828', 800: '#4A0000' },
  green:    { 50: '#C8E6C9', 400: '#2E7D32', 800: '#003300' },
  blue:     { 50: '#BBDEFB', 400: '#1565C0', 800: '#002F6C' },
  gray:     { 50: '#E0E0E0', 100: '#BDBDBD', 200: '#9E9E9E', 600: '#212121', 800: '#000000' },
  white:    '#FFFFFF',
  text:     { primary: '#000000', secondary: '#1A1A1A', hint: '#4A4A4A' },

  goal:     { 300: '#4CAF50', 500: '#2E7D32', 700: '#1B5E20' },
  cardShadow: '#000',
};

export function HighContrastProvider({ children }) {
  const [highContrast, setHighContrast] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(HC_KEY).then(v => {
      if (v === 'true') setHighContrast(true);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const toggleHighContrast = () => {
    setHighContrast(hc => {
      const next = !hc;
      AsyncStorage.setItem(HC_KEY, String(next)).catch(() => {});
      return next;
    });
  };

  const value = useMemo(() => ({
    highContrast,
    toggleHighContrast,
    COLORS: highContrast ? HC_COLORS : BASE,
  }), [highContrast]);

  if (!loaded) return null;

  return (
    <HighContrastContext.Provider value={value}>
      {children}
    </HighContrastContext.Provider>
  );
}

export function useHighContrast() {
  const ctx = useContext(HighContrastContext);
  if (!ctx) throw new Error('useHighContrast must be used within HighContrastProvider');
  return ctx;
}
