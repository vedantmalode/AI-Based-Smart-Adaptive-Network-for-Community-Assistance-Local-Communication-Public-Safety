import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import mr from '../locales/mr.json';

const languages = { en, hi, mr, bn: en, gu: en, ta: en, te: en };
const LanguageContext = createContext(null);

function readLanguage() {
  try {
    const saved = localStorage.getItem('resqnet-language');
    return Object.hasOwn(languages, saved) ? saved : 'en';
  } catch { return 'en'; }
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(readLanguage);
  useEffect(() => {
    const locale = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', ta: 'ta-IN', te: 'te-IN' };
    document.documentElement.lang = locale[language] || 'en-IN';
  }, [language]);
  const value = useMemo(() => ({
    language,
    setLanguage(next) {
      if (!Object.hasOwn(languages, next)) return;
      setLanguage(next);
      try { localStorage.setItem('resqnet-language', next); } catch { /* Language remains selected for this session. */ }
    },
    t(text) { return languages[language][text] || text; },
  }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider.');
  return context;
}
