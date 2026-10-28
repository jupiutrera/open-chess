import { describe, expect, it } from 'vitest'
import type { GameRow } from '../../db/db'
import { gameMatcher, gameOutcome, NO_FILTER } from './gameFilter'

const g = (over: Partial<GameRow>): GameRow => ({
  id: 'x',
  updatedAt: 0,
  source: 'bot',
  pgn: '',
  white: 'Ana',
  black: 'Martín',
  result: '1-0',
  userColor: 'w',
  date: 0,
  ...over,
})

describe('gameOutcome', () => {
  it('reads the result from the user side', () => {
    expect(gameOutcome(g({}))).toBe('win')
    expect(gameOutcome(g({ userColor: 'b' }))).toBe('loss')
    expect(gameOutcome(g({ result: '1/2-1/2', userColor: undefined }))).toBe('draw')
    expect(gameOutcome(g({ userColor: undefined }))).toBeNull()
    expect(gameOutcome(g({ result: '*' }))).toBeNull()
  })
})

describe('gameMatcher', () => {
  it('drops deleted games and filters by source', () => {
    expect(gameMatcher(NO_FILTER)(g({ deleted: true }))).toBe(false)
    const imported = gameMatcher({ ...NO_FILTER, source: 'imported' })
    expect(imported(g({ source: 'lichess' }))).toBe(true)
    expect(imported(g({ source: 'local' }))).toBe(false)
    expect(gameMatcher({ ...NO_FILTER, source: 'bot' })(g({ source: 'local' }))).toBe(true)
  })
  it('filters by result and color', () => {
    expect(gameMatcher({ ...NO_FILTER, result: 'loss' })(g({}))).toBe(false)
    expect(gameMatcher({ ...NO_FILTER, result: 'win', color: 'w' })(g({}))).toBe(true)
    expect(gameMatcher({ ...NO_FILTER, color: 'b' })(g({}))).toBe(false)
  })
  it('searches names and opening ignoring case and accents', () => {
    expect(gameMatcher({ ...NO_FILTER, query: 'martin' })(g({}))).toBe(true)
    // the search sees names as they are shown
    const shown = gameMatcher({ ...NO_FILTER, query: 'tu' }, (n) => (n === 'You' ? 'Tú' : n))
    expect(shown(g({ white: 'You' }))).toBe(true)
    expect(gameMatcher({ ...NO_FILTER, query: 'sicilian' })(g({ opening: 'B20 Sicilian Defense' }))).toBe(true)
    expect(gameMatcher({ ...NO_FILTER, query: 'french' })(g({ opening: 'B20 Sicilian Defense' }))).toBe(false)
  })
})
