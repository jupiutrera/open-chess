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

function detectLang(): Lang {
  const nav = (navigator.language ?? 'es').slice(0, 2).toLowerCase()
  return (LANGS as readonly string[]).includes(nav) ? (nav as Lang) : 'es'
}

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
  theme: 'dark' | 'light'
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
      theme: 'dark',
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
    { name: 'oc-settings' },
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
  theme: ['dark', 'light'],
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

export function applyDocumentSettings(s: Pick<Settings, 'theme' | 'board' | 'lang' | 'pieces' | 'highContrast'>) {
  const root = document.documentElement
  root.dataset.theme = s.theme
  root.dataset.contrast = s.highContrast ? 'high' : 'normal'
  root.dataset.board = s.board
  root.dataset.pieces = s.pieces
  root.lang = s.lang
}
