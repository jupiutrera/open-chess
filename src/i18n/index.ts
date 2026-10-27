import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './es.json'
import en from './en.json'
import fr from './fr.json'
import it from './it.json'
import zh from './zh.json'
import ja from './ja.json'
import { useSettings } from '../settings'

void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
    fr: { translation: fr },
    it: { translation: it },
    zh: { translation: zh },
    ja: { translation: ja },
  },
  lng: useSettings.getState().lang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

useSettings.subscribe((s) => {
  if (i18n.language !== s.lang) void i18n.changeLanguage(s.lang)
})

export default i18n
