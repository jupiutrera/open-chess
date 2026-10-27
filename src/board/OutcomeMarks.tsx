import { Crown, Flag, Timer, Hash } from '@phosphor-icons/react'
import type { Chess } from 'chess.js'

type Kind = 'win' | 'mate' | 'resign' | 'timeout' | 'loss' | 'draw'

/** Outcome badges on the corner of each king's square once a game is over. */
export function OutcomeMarks({
  chess,
  outcome,
  orientation,
}: {
  chess: Chess
  outcome: { result: '1-0' | '0-1' | '1/2-1/2'; reason: string }
  orientation: 'white' | 'black'
}) {
  const kings = { w: '', b: '' }
  for (const row of chess.board()) for (const p of row) if (p?.type === 'k') kings[p.color] = p.square
  const kind = (c: 'w' | 'b'): Kind => {
    if (outcome.result === '1/2-1/2') return 'draw'
    const won = (outcome.result === '1-0') === (c === 'w')
    if (won) return 'win'
    return outcome.reason === 'checkmate' ? 'mate' : outcome.reason === 'resign' ? 'resign' : outcome.reason === 'timeout' ? 'timeout' : 'loss'
  }
  return (
    <>
      {(['w', 'b'] as const).map((c, i) =>
        kings[c] ? <Mark key={c} square={kings[c]} kind={kind(c)} orientation={orientation} delay={i * 70} /> : null,
      )}
    </>
  )
}

function Mark({ square, kind, orientation, delay }: { square: string; kind: Kind; orientation: 'white' | 'black'; delay: number }) {
  const f = 'abcdefgh'.indexOf(square[0])
  const r = Number(square[1]) - 1
  const col = orientation === 'white' ? f : 7 - f
  const row = orientation === 'white' ? 7 - r : r
  const bg = kind === 'win' ? 'var(--accent)' : kind === 'draw' ? '#8b8987' : 'var(--danger)'
  const glyph =
    kind === 'win' ? (
      <Crown weight="fill" />
    ) : kind === 'mate' ? (
      <Hash weight="bold" />
    ) : kind === 'resign' ? (
      <Flag weight="fill" />
    ) : kind === 'timeout' ? (
      <Timer weight="fill" />
    ) : kind === 'draw' ? (
      <span className="text-[0.8em] font-extrabold leading-none">½</span>
    ) : (
      <Flag weight="fill" />
    )
  return (
    <span
      className="outcome-mark"
      style={{
        left: `${((col + 1) / 8) * 100 - 2}%`,
        top: `${(row / 8) * 100 + 2}%`,
        background: bg,
        animationDelay: `${delay}ms`,
      }}
      aria-hidden
    >
      {glyph}
    </span>
  )
}
