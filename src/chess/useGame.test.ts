import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { nextRecordedMove } from './useGame'

describe('nextRecordedMove', () => {
  const c = new Chess()
  for (const san of ['e4', 'e5', 'Nf3']) c.move(san)
  const hist = c.history({ verbose: true })

  it('matches the next recorded move', () => {
    expect(nextRecordedMove(hist, 1, 'e7', 'e5')?.san).toBe('e5')
    expect(nextRecordedMove(hist, 0, 'e2', 'e4')?.san).toBe('e4')
  })

  it('rejects a different move, or nothing after the end', () => {
    expect(nextRecordedMove(hist, 1, 'e7', 'e6')).toBeNull()
    expect(nextRecordedMove(hist, 3, 'e2', 'e4')).toBeNull()
  })

  it('compares the promotion piece', () => {
    const p = new Chess('8/P7/8/8/8/8/8/k6K w - - 0 1')
    p.move('a8=Q')
    const h = p.history({ verbose: true })
    expect(nextRecordedMove(h, 0, 'a7', 'a8', 'q')).not.toBeNull()
    expect(nextRecordedMove(h, 0, 'a7', 'a8', 'n')).toBeNull()
  })
})
