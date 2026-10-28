import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { PLAYER, playerName } from './playerName'

const t = ((k: string) => `[${k}]`) as unknown as TFunction

describe('playerName', () => {
  it('shows the stored markers in the current language', () => {
    expect(playerName(PLAYER.you, 'bot', t)).toBe('[common.you]')
    expect(playerName(PLAYER.white, 'local', t)).toBe('[common.white]')
  })
  it('also maps names saved in another language by older versions', () => {
    expect(playerName('Tú', 'bot', t)).toBe('[common.you]')
    expect(playerName('黑方', 'local', t)).toBe('[common.black]')
  })
  it('leaves bot and imported player names alone', () => {
    expect(playerName('Iván', 'bot', t)).toBe('Iván')
    expect(playerName('You', 'lichess', t)).toBe('You')
  })
})
