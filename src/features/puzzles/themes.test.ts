import { describe, expect, it } from 'vitest'
import en from '../../i18n/en.json'
import { THEMES } from './puzzlesData'

describe('THEMES', () => {
  it('are unique and all have a translated name', () => {
    expect(new Set(THEMES).size).toBe(THEMES.length)
    const names = en.themes as Record<string, string>
    expect(THEMES.filter((th) => !names[th])).toEqual([])
  })
})
