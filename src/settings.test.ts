import { describe, expect, it } from 'vitest'
import { backupSettings, settingsPatch, useSettings } from './settings'

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
