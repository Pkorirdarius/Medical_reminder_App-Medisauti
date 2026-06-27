import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS as LIGHT, DARK_COLORS as DARK } from './constants';

const ThemeContext = createContext();
const THEME_KEY = 'medisauti:theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val === 'dark' || val === 'light') setTheme(val);
      setLoaded(true);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = t === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    theme,
    toggleTheme,
    isDark: theme === 'dark',
    COLORS: theme === 'dark' ? DARK : LIGHT,
  }), [theme]);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
