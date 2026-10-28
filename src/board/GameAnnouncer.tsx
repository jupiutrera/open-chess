import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Move } from 'chess.js'
import { spokenSan } from './speech'

/**
 * Screen-reader announcements for a game in progress: each new move as it is played
 * ("Black: Knight f6, check") and then the result. The live region stays mounted and only
 * its text changes; regions inserted together with their text are often not read.
 */
export function GameAnnouncer({ moves, result }: { moves: Move[]; result?: string | null }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const last = moves[moves.length - 1]
  const prev = useRef({ count: moves.length, result })
  useEffect(() => {
    const p = prev.current
    prev.current = { count: moves.length, result }
    const parts: string[] = []
    // one move played; not takebacks, resets or a resumed game appearing at once
    if (last && moves.length === p.count + 1) parts.push(`${t(last.color === 'w' ? 'common.white' : 'common.black')}: ${spokenSan(last.san, t)}`)
    if (result && result !== p.result) parts.push(result)
    if (parts.length) setText(parts.join('. '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last, result])
  return (
    <div role="status" aria-live="polite" aria-atomic className="sr-only">
      {text}
    </div>
  )
}
