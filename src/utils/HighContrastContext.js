import React, { createContext, useContext, useState, useMemo } from 'react';

const HighContrastContext = createContext();

const NORMAL_COLORS = {
  teal:     { 50: '#E1F5EE', 100: '#9FE1CB', 400: '#1D9E75', 600: '#0F6E56', 800: '#085041' },
  amber:    { 50: '#FAEEDA', 400: '#BA7517', 800: '#633806' },
  red:      { 50: '#FCEBEB', 400: '#E24B4A', 800: '#791F1F' },
  green:    { 50: '#EAF3DE', 400: '#639922', 800: '#27500A' },
  blue:     { 50: '#E6F1FB', 400: '#378ADD', 800: '#0C447C' },
  gray:     { 50: '#F1EFE8', 100: '#D3D1C7', 200: '#B4B2A9', 600: '#5F5E5A', 800: '#444441' },
  white:    '#FFFFFF',
  background: '#F5F5F0',
  text:     { primary: '#1A1A18', secondary: '#5F5E5A', hint: '#B4B2A9' },
};

const HIGHT_CONTRAST_COLORS = {
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
    COLORS: highContrast ? HIGHT_CONTRAST_COLORS : NORMAL_COLORS,
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
