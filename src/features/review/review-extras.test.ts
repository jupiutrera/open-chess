import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { explainMove } from './explain'
import { annotatedPgn } from './pgnExport'
import { moveNumberLabel } from './moveNumber'
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
