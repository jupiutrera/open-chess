import type { TFunction } from 'i18next'
import type { GameSource } from '../../db/db'

/**
 * Player names of games played in the app are stored language-neutral, as these English
 * markers, so the PGN reads well and the name follows the UI language.
 */
export const PLAYER = { you: 'You', white: 'White', black: 'Black' } as const

// older rows hold the name in the language the app had then (common.you / white / black)
const LEGACY: Record<string, keyof typeof PLAYER> = {
  You: 'you', Tú: 'you', Vous: 'you', Tu: 'you', あなた: 'you', 你: 'you',
  White: 'white', Blancas: 'white', Blancs: 'white', Bianco: 'white', 白: 'white', 白方: 'white',
  Black: 'black', Negras: 'black', Noirs: 'black', Nero: 'black', 黒: 'black', 黑方: 'black',
}

/** A stored player name in the current language; names of imported games are left alone. */
export function playerName(name: string, source: GameSource | undefined, t: TFunction): string {
  const key = source === 'bot' || source === 'local' ? LEGACY[name] : undefined
  return key ? t(`common.${key}`) : name
}
