import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { explainMove, explanationTheme, type Explanation } from './explain'
import { THEMES } from '../puzzles/puzzlesData'
import { annotatedPgn } from './pgnExport'
import { moveNumberLabel } from './moveNumber'
import { playLine } from './line'
import type { MoveReview } from './classify'
import type { GameRow } from '../../db/db'

const mv = (over: Partial<MoveReview>): MoveReview => ({
  ply: 1, san: 'x', uci: 'a2a3', color: 'w', quality: 'blunder', loss: 40, accuracy: 10, bestUci: null, bestSan: null, scoreAfter: { cp: 0 }, ...over,
})

describe('explainMove', () => {
  it('says when a move allows mate', () => {
    expect(explainMove(mv({ scoreAfter: { mate: -2 } }), '4k3/8/8/8/8/8/P7/4K3 w - - 0 1')).toEqual({ key: 'allowsMate', n: 2 })
  })
  it('says when a mate was missed', () => {
    expect(explainMove(mv({ bestSan: 'Qh7#', scoreAfter: { cp: 300 } }), '4k3/8/8/8/8/8/P7/4K3 w - - 0 1', { mate: 1 })).toEqual({ key: 'missedMate', n: 1, best: 'Qh7#' })
  })
  it('spots a hanging piece', () => {
    // the knight goes to d5, attacked by the e6 pawn and undefended
    const fen = '4k3/8/4p3/8/8/2N5/8/4K3 w - - 0 1'
    expect(explainMove(mv({ uci: 'c3d5', san: 'Nd5' }), fen)).toEqual({ key: 'hangs', piece: 'n', square: 'd5' })
  })
  it('names a back-rank mate', () => {
    // Kh1 walks into Ra1#: the f2-g2-h2 pawns leave no air
    const fen = 'r5k1/8/8/8/8/8/5PPP/6K1 w - - 0 1'
    expect(explainMove(mv({ uci: 'g1h1', scoreAfter: { mate: -1 } }), fen, { cp: 0 }, ['a8a1'])).toEqual({ key: 'backRank', n: 1 })
  })
  it('names the fork the move allows', () => {
    const fen = '4k3/8/8/8/3n4/8/7P/R3K3 w - - 0 1'
    expect(explainMove(mv({ uci: 'h2h3', scoreAfter: { cp: -400 } }), fen, { cp: 0 }, ['d4c2'])).toEqual({
      key: 'allowsFork',
      san: 'Nc2+',
      targets: [
        { piece: 'r', square: 'a1' },
        { piece: 'k', square: 'e1' },
      ],
    })
  })
  it('names the pin the move allows', () => {
    // with d2 empty, h3 lets Bb4 pin the c3 knight to the king
    const fen = 'rnbqk1nr/pppp1ppp/8/2b1p3/8/2NP4/PPP1PPPP/R1BQKBNR w KQkq - 0 1'
    expect(explainMove(mv({ uci: 'h2h3', scoreAfter: { cp: -150 } }), fen, { cp: 0 }, ['c5b4'])).toEqual({
      key: 'allowsPin',
      san: 'Bb4',
      pinned: { piece: 'n', square: 'c3' },
      behind: { piece: 'k', square: 'e1' },
    })
  })
  it('names a piece trapped by the reply', () => {
    // the bishop that took on a7 is shut in by b6
    const fen = 'r2rk3/Bpp5/8/8/8/8/8/4K3 w - - 0 1'
    expect(explainMove(mv({ uci: 'e1e2', scoreAfter: { cp: -300 } }), fen, { cp: 0 }, ['b7b6'])).toEqual({
      key: 'trapped',
      san: 'b6',
      piece: { piece: 'b', square: 'a7' },
    })
  })
  it('names a trade that throws away a winning ending', () => {
    const fen = '3rk3/8/8/3r4/8/8/3R4/4K3 w - - 0 1'
    expect(explainMove(mv({ uci: 'd2d5', scoreAfter: { cp: 20 } }), fen, { cp: 600 }, ['d8d5'])).toEqual({ key: 'losingTrade' })
  })
  it('maps every explanation to a puzzle theme', () => {
    const all: Explanation[] = [
      { key: 'allowsMate', n: 2 },
      { key: 'allowsMate', n: 7 },
      { key: 'backRank', n: 1 },
      { key: 'missedMate', n: 3, best: 'Qh7#' },
      { key: 'hangs', piece: 'n', square: 'd5' },
      { key: 'allowsFork', san: 'Nc2+', targets: [] },
      { key: 'missedPin', san: 'Bb5', pinned: { piece: 'n', square: 'c6' }, behind: { piece: 'k', square: 'e8' } },
      { key: 'trapped', san: 'b6', piece: { piece: 'b', square: 'a7' } },
      { key: 'losingTrade' },
    ]
    for (const e of all) expect(THEMES).toContain(explanationTheme(e))
  })
  it('names a fork that was missed', () => {
    const fen = 'r3k3/8/8/3N4/8/8/7P/4K3 w - - 0 1'
    expect(explainMove(mv({ uci: 'h2h3', bestUci: 'd5c7', bestSan: 'Nc7+', scoreAfter: { cp: 0 } }), fen, { cp: 500 }, [])).toMatchObject({
      key: 'missedFork',
      san: 'Nc7+',
    })
  })
  it('stays quiet for good moves', () => {
    expect(explainMove(mv({ quality: 'best' }), '4k3/8/8/8/8/8/P7/4K3 w - - 0 1')).toBeNull()
  })
})

describe('annotatedPgn', () => {
  it('writes qualities and evals as comments', () => {
    const game = {
      pgn: '1. e4 e5 2. Qh5 Nc6 *',
      review: {
        depth: 14,
        accuracy: { white: 80, black: 80 },
        curve: [],
        moves: [
          mv({ ply: 1, san: 'e4', quality: 'book', scoreAfter: { cp: 30 } }),
          mv({ ply: 2, san: 'e5', color: 'b', quality: 'book', scoreAfter: { cp: 30 } }),
          mv({ ply: 3, san: 'Qh5', quality: 'inaccuracy', bestSan: 'Nf3', scoreAfter: { cp: -10 } }),
          mv({ ply: 4, san: 'Nc6', color: 'b', quality: 'best', scoreAfter: { cp: -10 } }),
        ],
      },
    } as unknown as GameRow
    const pgn = annotatedPgn(game, (q) => q)
    expect(pgn).toContain('?! inaccuracy. Nf3!')
    expect(pgn).toContain('[%eval -0.1]')
    expect(new Chess().loadPgn(pgn)).toBeUndefined()
  })
})

describe('moveNumberLabel', () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  it('counts from move 1 with White first', () => {
    expect(moveNumberLabel(1, start)).toBe('1.')
    expect(moveNumberLabel(2, start)).toBe('1…')
    expect(moveNumberLabel(3, start)).toBe('2.')
  })
  it('follows a FEN start with Black to move', () => {
    const fen = '4k3/8/8/8/8/8/4P3/4K3 b - - 0 23'
    expect(moveNumberLabel(1, fen, '...')).toBe('23...')
    expect(moveNumberLabel(2, fen)).toBe('24.')
    expect(moveNumberLabel(3, fen)).toBe('24…')
  })
})

describe('playLine', () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  it('steps into an engine line', () => {
    const r = playLine(start, ['e2e4', 'e7e5', 'g1f3'], 2)
    expect(r.played).toBe(2)
    expect(r.last?.san).toBe('e5')
    expect(r.fen.split(' ')[0]).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR')
  })
  it('step 0 is the position itself, and an illegal move ends the line', () => {
    expect(playLine(start, ['e2e4'], 0)).toEqual({ fen: start, last: null, played: 0 })
    expect(playLine(start, ['e2e4', 'e2e4', 'g1f3'], 3).played).toBe(1)
  })
})
