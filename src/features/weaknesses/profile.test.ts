import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import type { GameRow } from '../../db/db'
import type { MoveReview, Quality } from '../review/classify'
import { THEMES } from '../puzzles/puzzlesData'
import { buildPlan, buildProfile, dayKey, dayProgress, gameMistakes, openingFamily, phaseOf, planIsCurrent, weekStart } from './profile'

// every game built gets a new version, as every write does in the app (profile.ts caches by it)
let version = 0

/** A reviewed game as White where `bad` maps plies to their quality; every other move is "good". */
function game(id: string, pgn: string, bad: Record<number, Quality>, extra: Partial<GameRow> = {}): GameRow {
  const c = new Chess()
  c.loadPgn(pgn)
  const moves: MoveReview[] = c.history({ verbose: true }).map((m, i) => ({
    ply: i + 1,
    san: m.san,
    uci: m.from + m.to + (m.promotion ?? ''),
    color: m.color,
    quality: bad[i + 1] ?? 'good',
    loss: bad[i + 1] ? 30 : 1,
    accuracy: 80,
    bestUci: null,
    bestSan: null,
    scoreAfter: { cp: 0 },
  }))
  return {
    id,
    updatedAt: ++version,
    source: 'pgn',
    pgn,
    white: 'me',
    black: 'them',
    result: '0-1',
    userColor: 'w',
    date: Date.UTC(2026, 9, Number(id.replace(/\D/g, '')) || 1),
    review: { depth: 12, accuracy: { white: 70, black: 80 }, moves, curve: [] },
    ...extra,
  } as GameRow
}

// 3.Qxe5+?? leaves the queen to the c6 knight
const HANG = '1. e4 e5 2. Qh5 Nc6 3. Qxe5+ Nxe5 0-1'

describe('phases', () => {
  it('counts the first 20 plies as the opening, then reads the material', () => {
    expect(phaseOf('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 12)).toBe('opening')
    expect(phaseOf('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 30)).toBe('middlegame')
    expect(phaseOf('4k3/pp3ppp/8/8/8/8/PP3PPP/3RK3 w - - 0 30', 60)).toBe('endgame')
  })
  it('groups openings by family', () => {
    expect(openingFamily('C20 King’s Pawn Game: Wayward Queen Attack')).toBe('King’s Pawn Game')
    expect(openingFamily('B20 Sicilian Defense')).toBe('Sicilian Defense')
  })
})

describe('gameMistakes', () => {
  it('counts the user’s moves and tags their mistakes', () => {
    const r = gameMistakes(game('g1', HANG, { 5: 'blunder' }))!
    expect(r.moves.opening).toBe(3)
    expect(r.mistakes).toEqual([{ gameId: 'g1', ply: 5, phase: 'opening', theme: 'hangingPiece', date: expect.any(Number) }])
  })
  it('skips book moves, the opponent and unreviewed games', () => {
    expect(gameMistakes(game('g1', HANG, { 1: 'book', 4: 'blunder' }))!.moves.opening).toBe(2)
    expect(gameMistakes(game('g1', HANG, { 4: 'blunder' }))!.mistakes).toEqual([])
    expect(gameMistakes({ ...game('g1', HANG, {}), review: undefined })).toBeNull()
    expect(gameMistakes({ ...game('g1', HANG, {}), userColor: undefined })).toBeNull()
  })
})

describe('buildProfile', () => {
  const games = [
    game('g1', HANG, { 5: 'blunder' }, { opening: 'C20 King’s Pawn Game: Wayward Queen Attack' }),
    game('g2', HANG, { 5: 'mistake' }, { opening: 'C20 King’s Pawn Game' }),
    game('g3', HANG, { 3: 'inaccuracy' }, { opening: 'B20 Sicilian Defense' }),
    { ...game('g4', HANG, { 5: 'blunder' }), deleted: true },
  ]
  const p = buildProfile(games)
  it('adds up the reviewed, live games', () => {
    expect(p.games).toBe(3)
    expect(p.moves).toBe(9)
    expect(p.overall.mistakes).toBe(2)
    expect(p.byPhase.opening.per100).toBeCloseTo((2 / 9) * 100)
  })
  it('ranks the themes and keeps examples, newest first', () => {
    expect(p.weaknesses).toHaveLength(1)
    expect(p.weaknesses[0]).toMatchObject({ theme: 'hangingPiece', count: 2 })
    expect(p.weaknesses[0].examples.map((m) => m.gameId)).toEqual(['g2', 'g1'])
  })
  it('needs two games of an opening family to rate it', () => {
    expect(p.byOpening).toEqual([{ name: 'King’s Pawn Game', games: 2, moves: 6, mistakes: 2, per100: (2 / 6) * 100 }])
  })
  it('has no trend with few games', () => {
    expect(p.trend).toBeNull()
    const many = Array.from({ length: 20 }, (_, i) => game(`g${i + 1}`, HANG, i < 10 ? { 5: 'blunder' } : {}))
    // g11-g20 are the newer ones (later dates) and clean
    expect(buildProfile(many).trend).toMatchObject({ recent: { mistakes: 0 }, before: { mistakes: 10 } })
  })
})

describe('weekly plan', () => {
  const p = buildProfile([game('g1', HANG, { 5: 'blunder' }), game('g2', HANG, { 5: 'blunder' }), game('g3', HANG, {})])
  // a Wednesday
  const now = new Date(2026, 9, 28, 15)
  it('starts on Monday and spreads the worst themes over the week', () => {
    const plan = buildPlan(p, now, true)
    expect(plan.start).toBe('2026-10-26')
    expect(plan.days.map((d) => d.day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    expect(plan.days[0].theme).toBe('hangingPiece')
    expect(plan.days[6].theme).toBe('mistakes')
    // missing themes come from the phases, and are real puzzle themes
    for (const d of plan.days.slice(0, 6)) expect(THEMES).toContain(d.theme)
    expect(buildPlan(p, now, false).days[6].theme).not.toBe('mistakes')
  })
  it('is only current during its own week', () => {
    const plan = buildPlan(p, now, true)
    expect(planIsCurrent(plan, new Date(2026, 10, 1, 23))).toBe(true)
    expect(planIsCurrent(plan, new Date(2026, 10, 2, 1))).toBe(false)
    expect(planIsCurrent(null, now)).toBe(false)
    expect(dayKey(weekStart(new Date(2026, 10, 1)))).toBe('2026-10-26')
  })
  it('counts the day’s attempts of its theme', () => {
    const day = { day: '2026-10-28', theme: 'fork' as const, count: 10 }
    const at = (h: number) => new Date(2026, 9, 28, h).getTime()
    const attempts = [
      { date: at(9), mode: 'theme', theme: 'fork' },
      { date: at(10), mode: 'theme', theme: 'pin' },
      { date: at(11), mode: 'rated' },
      { date: new Date(2026, 9, 29, 9).getTime(), mode: 'theme', theme: 'fork' },
    ]
    expect(dayProgress(day, attempts)).toBe(1)
    expect(dayProgress({ ...day, theme: 'mistakes' }, [{ date: at(9), mode: 'mistakes' }])).toBe(1)
  })
})
