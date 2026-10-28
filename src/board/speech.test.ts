import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import en from '../i18n/en.json'
import { spokenSan } from './speech'

// enough of i18next for the keys spokenSan uses
const t = ((key: string, vars?: Record<string, string>) => {
  let v: unknown = en
  for (const k of key.split('.')) v = (v as Record<string, unknown>)[k]
  return String(v).replace(/{{(\w+)}}/g, (_, n: string) => vars?.[n] ?? '')
}) as unknown as TFunction

describe('spokenSan', () => {
  it('names the piece and the capture', () => {
    expect(spokenSan('Nf3', t)).toBe('Knight f3')
    expect(spokenSan('Bxe5', t)).toBe('Bishop takes e5')
    expect(spokenSan('exd5', t)).toBe('e takes d5')
    expect(spokenSan('e4', t)).toBe('e4')
  })
  it('says castling, promotion, check and mate', () => {
    expect(spokenSan('O-O', t)).toBe('castles kingside')
    expect(spokenSan('O-O-O+', t)).toBe('castles queenside, check')
    expect(spokenSan('e8=Q+', t)).toBe('e8, promotes to Queen, check')
    expect(spokenSan('Qh7#', t)).toBe('Queen h7, checkmate')
  })
})
