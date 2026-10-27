import { describe, expect, it } from 'vitest'
import { mistakesFromGame } from './mistakes'
import type { GameRow } from '../../db/db'
import type { MoveReview } from '../review/classify'

const mv = (ply: number, color: 'w' | 'b', quality: MoveReview['quality'], bestUci: string | null = null): MoveReview => ({
  ply, san: '?', uci: '', color, quality, loss: 0, accuracy: 0, bestUci, bestSan: null, scoreAfter: { cp: 0 },
})

describe('mistakesFromGame', () => {
  it('turns the user’s errors into puzzles that start with the opponent’s move', () => {
    const game = {
      id: 'g1',
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 *',
      userColor: 'b',
      white: 'Bot',
      black: 'You',
      review: { moves: [mv(1, 'w', 'book'), mv(2, 'b', 'book'), mv(3, 'w', 'best'), mv(4, 'b', 'best'), mv(5, 'w', 'best'), mv(6, 'b', 'mistake', 'g8f6')] },
    } as unknown as GameRow
    const [p, ...rest] = mistakesFromGame(game)
    expect(rest).toHaveLength(0)
    expect(p).toMatchObject({ id: 'm:g1:6', moves: ['f1c4', 'g8f6'], opponent: 'Bot', quality: 'mistake' })
    expect(p.fen.split(' ')[1]).toBe('w')
  })
  it('ignores games without a review or a known side', () => {
    expect(mistakesFromGame({ pgn: '1. e4 *' } as GameRow)).toEqual([])
  })
})
