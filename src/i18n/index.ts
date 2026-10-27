import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './es.json'
import en from './en.json'
import { useSettings, type Lang } from '../settings'

// Spanish (default) and English (fallback) ship in the main bundle; the rest load when picked.
const lazyLangs: Partial<Record<Lang, () => Promise<{ default: object }>>> = {
  fr: () => import('./fr.json'),
  it: () => import('./it.json'),
  zh: () => import('./zh.json'),
  ja: () => import('./ja.json'),
}

async function ensureLang(lang: Lang) {
  const load = lazyLangs[lang]
  if (!load || i18n.hasResourceBundle(lang, 'translation')) return
  i18n.addResourceBundle(lang, 'translation', (await load()).default)
}

const initial = useSettings.getState().lang

/** Resolves once the saved language is loaded; render after it to avoid a flash of English. */
export const i18nReady = i18n
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: initial,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })
  .then(() => ensureLang(initial))
  .then(() => i18n.changeLanguage(initial))
  .catch(() => undefined)

useSettings.subscribe((s) => {
  if (i18n.language !== s.lang) void ensureLang(s.lang).then(() => i18n.changeLanguage(s.lang))
})

export default i18n
