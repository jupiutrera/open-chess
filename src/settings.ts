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

export function applyDocumentSettings(s: Pick<Settings, 'theme' | 'board' | 'lang' | 'pieces' | 'highContrast'>) {
  const root = document.documentElement
  root.dataset.theme = s.theme
  root.dataset.contrast = s.highContrast ? 'high' : 'normal'
  root.dataset.board = s.board
  root.dataset.pieces = s.pieces
  root.lang = s.lang
}
