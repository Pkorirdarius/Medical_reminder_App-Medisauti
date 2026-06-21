import React, { createContext, useContext, useState, useMemo } from 'react';
import { COLORS as BASE } from './constants';

const HighContrastContext = createContext();

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

  teal:     { 50: '#C8E6D9', 100: '#6BBF9F', 400: '#006B4D', 600: '#003D2C', 800: '#001A12' },
  amber:    { 50: '#FFE0B2', 400: '#E65100', 800: '#3E1A00' },
  red:      { 50: '#FFCDD2', 400: '#C62828', 800: '#4A0000' },
  green:    { 50: '#C8E6C9', 400: '#2E7D32', 800: '#003300' },
  blue:     { 50: '#BBDEFB', 400: '#1565C0', 800: '#002F6C' },
  gray:     { 50: '#E0E0E0', 100: '#BDBDBD', 200: '#9E9E9E', 600: '#212121', 800: '#000000' },
  white:    '#FFFFFF',
  background: '#FFFFFF',
  text:     { primary: '#000000', secondary: '#1A1A1A', hint: '#4A4A4A' },
};

export function HighContrastProvider({ children }) {
  const [highContrast, setHighContrast] = useState(false);
  const value = useMemo(() => ({
    highContrast,
    setHighContrast,
    toggleHighContrast: () => setHighContrast(hc => !hc),
    COLORS: highContrast ? HC_COLORS : BASE,
  }), [highContrast]);
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
