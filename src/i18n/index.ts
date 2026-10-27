import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './es.json'
import en from './en.json'
import { useSettings } from '../settings'

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: useSettings.getState().lang,
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
})

useSettings.subscribe((s) => {
  if (i18n.language !== s.lang) void i18n.changeLanguage(s.lang)
})

export default i18n
