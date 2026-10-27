import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const PIECE_SETS = ['staunty', 'fresca', 'tatiana', 'maestro', 'california', 'cardinal', 'gioco', 'chessnut', 'cburnett'] as const
export type PieceSet = (typeof PIECE_SETS)[number]

export type BoardTheme = 'green' | 'brown' | 'blue' | 'gray' | 'purple'

export interface Settings {
  lang: 'es' | 'en'
  theme: 'dark' | 'light'
  board: BoardTheme
  pieces: PieceSet
  sound: boolean
  coords: boolean
  showDests: boolean
  autoQueen: boolean
  animation: boolean
  haptics: boolean
  reviewDepth: number
  /** optional personal token: the Lichess opening explorer requires one */
  lichessToken: string
  set: (patch: Partial<Omit<Settings, 'set'>>) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      lang: navigator.language?.startsWith('en') ? 'en' : 'es',
      theme: 'dark',
      board: 'green',
      pieces: 'staunty',
      sound: true,
      coords: true,
      showDests: true,
      autoQueen: false,
      animation: true,
      haptics: true,
      reviewDepth: 14,
      lichessToken: '',
      set: (patch) => set(patch),
    }),
    { name: 'oc-settings' },
  ),
)

export function applyDocumentSettings(s: Pick<Settings, 'theme' | 'board' | 'lang' | 'pieces'>) {
  const root = document.documentElement
  root.dataset.theme = s.theme
  root.dataset.board = s.board
  root.dataset.pieces = s.pieces
  root.lang = s.lang
}
