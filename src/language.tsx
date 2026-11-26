import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';

export type Language = 'ru' | 'en';
type UiLanguage = {language: Language; t: (ru: string, en: string) => string; setLanguage: (value: Language) => void};
const UI = createContext<UiLanguage>({language:'ru', t: ru => ru, setLanguage: () => {}});
const storageKey = 'agentik:language';
function initial(): Language {
  try { return localStorage.getItem(storageKey) === 'en' ? 'en' : 'ru'; } catch { return 'ru'; }
}
export function UiLanguageProvider({children}: {children: ReactNode}) {
  const [language, setLanguage] = useState<Language>(initial);
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem(storageKey, language); } catch {}
  }, [language]);
  return <UI.Provider value={{language, setLanguage, t:(ru, en) => language === 'en' ? en : ru}}>{children}</UI.Provider>;
}
export function useUi() { return useContext(UI); }
