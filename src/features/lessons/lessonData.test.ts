import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { LESSONS } from './lessonData'
import { materialCount, playUci } from '../../chess/util'

describe('lessons content', () => {
  for (const lesson of LESSONS) {
    for (const [i, step] of lesson.steps.entries()) {
      it(`${lesson.id} step ${i + 1} is valid`, () => {
        const c = new Chess(step.fen)
        if (step.kind === 'practice') {
          expect(c.isGameOver()).toBe(false)
          // the learner plays the side to move: ahead to win, about level (a pawn at most) to hold a draw
          const mine = materialCount(c, c.turn())
          const theirs = materialCount(c, c.turn() === 'w' ? 'b' : 'w')
          if (step.hold) expect(step.goal).toBe('draw')
          if (step.goal === 'draw') expect(Math.abs(mine - theirs)).toBeLessThanOrEqual(1)
          else expect(mine).toBeGreaterThan(theirs)
          return
        }
        for (const [j, u] of step.moves.entries()) {
          // alternatives replace the last move, so they must be legal where it is played
          if (j === step.moves.length - 1)
            for (const alt of step.also ?? []) expect(playUci(new Chess(c.fen()), alt), `${alt} legal in ${c.fen()}`).not.toBeNull()
          expect(playUci(c, u), `${u} legal in ${c.fen()}`).not.toBeNull()
        }
        const name = lesson.id
        if (name.includes('mate')) expect(c.isCheckmate()).toBe(true)
      })
    }
  }
})
