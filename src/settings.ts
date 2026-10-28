import { useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const PIECE_SETS = ['staunty', 'fresca', 'tatiana', 'maestro', 'california', 'cardinal', 'gioco', 'chessnut', 'cburnett'] as const
export type PieceSet = (typeof PIECE_SETS)[number]

export const SOUND_SETS = ['wood', 'sfx', 'piano', 'nes', 'futuristic'] as const
export type SoundSet = (typeof SOUND_SETS)[number]

export const LANGS = ['es', 'en', 'fr', 'it', 'zh', 'ja'] as const
export type Lang = (typeof LANGS)[number]

/** Native name of each language, for the picker. */
export const LANG_NAMES: Record<Lang, string> = { es: 'Español', en: 'English', fr: 'Français', it: 'Italiano', zh: '中文', ja: '日本語' }

/** The first browser language the app speaks; English for everyone else. */
export function detectLang(prefs: readonly string[] = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])): Lang {
  for (const p of prefs) {
    const code = (p ?? '').slice(0, 2).toLowerCase()
    if ((LANGS as readonly string[]).includes(code)) return code as Lang
  }
  return 'en'
}

/** 'system' follows the device's light/dark preference. */
export type ThemeChoice = 'system' | 'dark' | 'light'

export type BoardTheme = 'green' | 'brown' | 'blue' | 'gray' | 'purple'

/** In-game help against bots */
export interface AssistSettings {
  eval: boolean
  threats: boolean
  suggest: boolean
  feedback: boolean
  engine: boolean
}

export interface Settings {
  lang: Lang
  theme: ThemeChoice
  board: BoardTheme
  pieces: PieceSet
  sound: boolean
  soundSet: SoundSet
  coords: boolean
  showDests: boolean
  autoQueen: boolean
  animation: boolean
  /** darker accent and danger colours so white text meets WCAG AA */
  highContrast: boolean
  haptics: boolean
  reviewDepth: number
  assist: AssistSettings
  /** optional personal token: the Lichess opening explorer requires one */
  lichessToken: string
  set: (patch: Partial<Omit<Settings, 'set'>>) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      lang: detectLang(),
      theme: 'system',
      board: 'green',
      pieces: 'staunty',
      sound: true,
      soundSet: 'wood',
      coords: true,
      showDests: true,
      autoQueen: false,
      animation: true,
      highContrast: false,
      haptics: true,
      reviewDepth: 14,
      assist: { eval: false, threats: false, suggest: false, feedback: true, engine: false },
      lichessToken: '',
      set: (patch) => set(patch),
    }),
    {
      name: 'oc-settings',
      // v1 added the 'system' theme; older saves need no change, merge validates them all
      version: 1,
      migrate: (persisted) => persisted as Settings,
      merge: (persisted, current) => mergeSettings(persisted, current),
    },
  ),
)

/** Settings that go into a backup: everything but the Lichess token, a personal credential. */
export type BackupSettings = Omit<Settings, 'set' | 'lichessToken'>

export function backupSettings(s: Settings = useSettings.getState()): BackupSettings {
  const out: Record<string, unknown> = { ...s }
  delete out.set
  delete out.lichessToken
  return out as unknown as BackupSettings
}

const CHOICES: Partial<Record<keyof Settings, readonly string[]>> = {
  lang: LANGS,
  theme: ['system', 'dark', 'light'] satisfies ThemeChoice[],
  board: ['green', 'brown', 'blue', 'gray', 'purple'] satisfies BoardTheme[],
  pieces: PIECE_SETS,
  soundSet: SOUND_SETS,
}

/** The valid part of backed-up settings, as a patch over `current`; unknown or mistyped values are dropped. */
export function settingsPatch(raw: unknown, current: Settings): Partial<BackupSettings> {
  const patch: Record<string, unknown> = {}
  if (!raw || typeof raw !== 'object') return patch
  for (const [k, v] of Object.entries(raw)) {
    const key = k as keyof Settings
    const now = current[key]
    if (key === 'set' || key === 'lichessToken' || !(key in current) || typeof v !== typeof now) continue
    if (CHOICES[key] && !CHOICES[key].includes(v as string)) continue
    if (typeof now === 'object' && now) {
      // nested flags (assist): only known keys of the same type
      const sub = Object.fromEntries(Object.entries(v as object).filter(([sk, sv]) => sk in now && typeof sv === typeof (now as unknown as Record<string, unknown>)[sk]))
      patch[key] = { ...now, ...sub }
    } else patch[key] = v
  }
  return patch as Partial<BackupSettings>
}

/**
 * Saved settings over the defaults: nested flags (assist) merge key by key so a new flag gets its default,
 * and values a newer or older version doesn't know are dropped instead of breaking the UI.
 */
export function mergeSettings(persisted: unknown, current: Settings): Settings {
  const token = (persisted as { lichessToken?: unknown } | null)?.lichessToken
  return { ...current, ...settingsPatch(persisted, current), ...(typeof token === 'string' ? { lichessToken: token } : {}) }
}

const lightQuery = () => (typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-color-scheme: light)'))

function subscribeScheme(cb: () => void) {
  const q = lightQuery()
  q?.addEventListener('change', cb)
  return () => q?.removeEventListener('change', cb)
}

/** The theme actually shown: 'system' resolves to the device preference and follows it live. */
export function useResolvedTheme(): 'dark' | 'light' {
  const choice = useSettings((s) => s.theme)
  const systemLight = useSyncExternalStore(subscribeScheme, () => !!lightQuery()?.matches, () => false)
  return choice === 'system' ? (systemLight ? 'light' : 'dark') : choice
}

export function applyDocumentSettings(s: Pick<Settings, 'board' | 'lang' | 'pieces' | 'highContrast'> & { theme: 'dark' | 'light' }) {
  const root = document.documentElement
  root.dataset.theme = s.theme
  root.dataset.contrast = s.highContrast ? 'high' : 'normal'
  root.dataset.board = s.board
  root.dataset.pieces = s.pieces
  root.lang = s.lang
  // browser chrome (address bar, PWA title bar) follows the rail colour of the theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', s.theme === 'light' ? '#ffffff' : '#262421')
}
