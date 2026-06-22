import React, { createContext, useContext, useState, useCallback } from 'react';
import LANG from './lang';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('sw');

  const toggleLanguage = useCallback(() => {
    setLanguage(l => l === 'sw' ? 'en' : 'sw');
  }, []);

  const t = useCallback((key) => {
    const entry = LANG[key];
    if (!entry) return key;
    return entry[language] ?? key;
  }, [language]);

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
