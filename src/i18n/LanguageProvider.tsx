import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Lang, Translations, translations } from "./translations";

const STORAGE_KEY = "app_language";

type LanguageContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: "de",
  setLang: () => {},
  t: translations.de,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("de");

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((stored) => {
      if (stored === "de" || stored === "en") setLangState(stored);
    });
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    SecureStore.setItemAsync(STORAGE_KEY, l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  return useContext(LanguageContext);
}
