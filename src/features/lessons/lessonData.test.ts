import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { LESSONS } from './lessonData'
import { playUci } from '../../chess/util'

describe('lessons content', () => {
  for (const lesson of LESSONS) {
    for (const [i, step] of lesson.steps.entries()) {
      it(`${lesson.id} step ${i + 1} is valid`, () => {
        const c = new Chess(step.fen)
        if (step.kind === 'practice') {
          expect(c.isGameOver()).toBe(false)
          return
        }
        for (const u of step.moves) expect(playUci(c, u), `${u} legal in ${c.fen()}`).not.toBeNull()
        const name = lesson.id
        if (name.includes('mate')) expect(c.isCheckmate()).toBe(true)
      })
    }
  }
})
