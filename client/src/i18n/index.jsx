import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import fr from './fr';
import ar from './ar';
import en from './en';

/**
 * Internationalisation : français (défaut), arabe (droite à gauche), anglais.
 * t('clé', { var }) → texte traduit ; repli sur le français si la clé manque.
 * La langue est mémorisée dans le navigateur et dans le profil utilisateur.
 */
const DICTS = { fr, ar, en };
export const LANGS = [['fr', 'Français'], ['ar', 'العربية'], ['en', 'English']];
const RTL = ['ar'];

const I18nContext = createContext(null);

const readLang = () => { try { return localStorage.getItem('athenee.lang') || 'fr'; } catch { return 'fr'; } };

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.includes(lang) ? 'rtl' : 'ltr';
  }, [lang]);

  const setLang = useCallback(l => {
    if (!DICTS[l]) return;
    setLangState(l);
    try { localStorage.setItem('athenee.lang', l); } catch { /* navigation privée */ }
  }, []);

  const t = useCallback((key, vars) => {
    let s = (DICTS[lang] && DICTS[lang][key]) ?? fr[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  }, [lang]);

  const locale = lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-GB' : 'fr-FR';
  const value = useMemo(() => ({ lang, setLang, t, locale, rtl: RTL.includes(lang) }), [lang, setLang, t, locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
