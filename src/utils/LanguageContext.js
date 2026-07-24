import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LANG from './lang';

const LANG_KEY = 'medisauti:language';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('sw');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(v => {
      if (v === 'sw' || v === 'en') setLanguage(v);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(l => {
      const next = l === 'sw' ? 'en' : 'sw';
      AsyncStorage.setItem(LANG_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const t = useCallback((key) => {
    const entry = LANG[key];
    if (!entry) return key;
    return entry[language] ?? key;
  }, [language]);

  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
