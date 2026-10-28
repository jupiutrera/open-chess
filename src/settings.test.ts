import { describe, expect, it } from 'vitest'
import { backupSettings, detectLang, mergeSettings, settingsPatch, useSettings } from './settings'

describe('settings in backups', () => {
  const current = { ...useSettings.getState(), lichessToken: 'lip_secret' }

  it('leaves the Lichess token out of a backup', () => {
    const b = backupSettings(current) as unknown as Record<string, unknown>
    expect(b.lichessToken).toBeUndefined()
    expect(b.set).toBeUndefined()
    expect(b.board).toBe(current.board)
  })

  it('restores only known, well-typed values and never the token', () => {
    const patch = settingsPatch(
      { board: 'blue', pieces: 'no-such-set', sound: 'yes', reviewDepth: 18, lichessToken: 'evil', extra: 1, assist: { eval: true, bogus: true, threats: 1 } },
      current,
    )
    expect(patch).toEqual({ board: 'blue', reviewDepth: 18, assist: { ...current.assist, eval: true } })
  })

  it('ignores a backup without settings', () => {
    expect(settingsPatch(undefined, current)).toEqual({})
  })
})

describe('saved settings on load', () => {
  const defaults = useSettings.getState()

  it('keeps new assist flags at their default when an old save lacks them', () => {
    const merged = mergeSettings({ assist: { eval: true }, board: 'brown' }, defaults)
    expect(merged.assist).toEqual({ ...defaults.assist, eval: true })
    expect(merged.board).toBe('brown')
  })

  it('drops values this version does not know, keeping the token and the setter', () => {
    const merged = mergeSettings({ pieces: 'gone-set', soundSet: 42, theme: 'sepia', lang: 'de', lichessToken: 'lip_x' }, defaults)
    expect(merged.pieces).toBe(defaults.pieces)
    expect(merged.soundSet).toBe(defaults.soundSet)
    expect(merged.theme).toBe(defaults.theme)
    expect(merged.lang).toBe(defaults.lang)
    expect(merged.lichessToken).toBe('lip_x')
    expect(merged.set).toBe(defaults.set)
  })

  it('survives a missing or corrupt save', () => {
    expect(mergeSettings(undefined, defaults)).toEqual(defaults)
    expect(mergeSettings('garbage', defaults)).toEqual(defaults)
  })

  it('new users follow the system theme', () => {
    expect(defaults.theme).toBe('system')
    expect(mergeSettings({ theme: 'light' }, defaults).theme).toBe('light')
  })
})

describe('browser language', () => {
  it('picks the first language the app speaks', () => {
    expect(detectLang(['es-ES'])).toBe('es')
    expect(detectLang(['de-DE', 'fr-FR'])).toBe('fr')
    expect(detectLang(['ja'])).toBe('ja')
  })

  it('falls back to English', () => {
    expect(detectLang(['de-DE', 'pt-BR'])).toBe('en')
    expect(detectLang([])).toBe('en')
  })
})
