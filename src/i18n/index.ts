import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './es.json'
import en from './en.json'
import { useSettings, type Lang } from '../settings'
import { polishPlurals } from './polishPlurals'

// Spanish (default) and English (fallback) ship in the main bundle; the rest load when picked.
const lazyLangs: Partial<Record<Lang, () => Promise<{ default: object }>>> = {
  fr: () => import('./fr.json'),
  it: () => import('./it.json'),
  zh: () => import('./zh.json'),
  ja: () => import('./ja.json'),
  pl: () => import('./pl.json'),
}

async function ensureLang(lang: Lang) {
  const load = lazyLangs[lang]
  if (!load || i18n.hasResourceBundle(lang, 'translation')) return
  const resource = (await load()).default
  i18n.addResourceBundle(lang, 'translation', lang === 'pl' ? polishPlurals(resource) : resource)
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

async function applyLang() {
  const lang = useSettings.getState().lang
  await ensureLang(lang)
  // the user may have picked another language while this chunk loaded: only the latest pick wins
  if (useSettings.getState().lang === lang) await i18n.changeLanguage(lang)
}

useSettings.subscribe((s) => {
  // a chunk that fails to load (offline) leaves the current language in place
  if (i18n.language !== s.lang) void applyLang().catch(() => undefined)
})

export default i18n
