import { memo, useEffect, useRef } from 'react'
import type { Quality } from '../features/review/classify'
import { QualityIcon, qualityColor } from './QualityIcon'

export interface MoveListProps {
  sans: string[]
  /** ply currently shown; 0 = start position */
  ply: number
  onSelect?: (ply: number) => void
  qualities?: (Quality | undefined)[]
  /** first move number (FEN start) and whether Black moves first */
  startNumber?: number
  blackFirst?: boolean
  className?: string
}

/** Props equal, with `qualities` compared item by item (callers rebuild the array each render). */
function sameProps(a: MoveListProps, b: MoveListProps) {
  for (const k of Object.keys({ ...a, ...b }) as (keyof MoveListProps)[]) {
    if (k === 'qualities') {
      const x = a.qualities
      const y = b.qualities
      if (x === y) continue
      if (!x || !y || x.length !== y.length || x.some((q, i) => q !== y[i])) return false
    } else if (a[k] !== b[k]) return false
  }
  return true
}

/** Two-column numbered move list in the chess.com style. */
export const MoveList = memo(MoveListView, sameProps)
export const MoveStrip = memo(MoveStripView, sameProps)

function MoveListView({ sans, ply, onSelect, qualities, startNumber = 1, blackFirst = false, className = '' }: MoveListProps) {
  const active = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLDivElement>(null)
  // Scroll only the list itself: scrollIntoView would also scroll the page on mobile.
  useEffect(() => {
    const el = active.current
    const c = box.current
    if (!el || !c || c.scrollHeight <= c.clientHeight) return
    const er = el.getBoundingClientRect()
    const cr = c.getBoundingClientRect()
    if (er.top < cr.top) c.scrollTop -= cr.top - er.top
    else if (er.bottom > cr.bottom) c.scrollTop += er.bottom - cr.bottom
  }, [ply])

  const rows: { n: number; w?: number; b?: number }[] = []
  let i = 0
  let n = startNumber
  if (blackFirst && sans.length) {
    rows.push({ n, b: 0 })
    i = 1
    n++
  }
  for (; i < sans.length; i += 2, n++) rows.push({ n, w: i, b: i + 1 < sans.length ? i + 1 : undefined })

  const cell = (idx: number | undefined) => {
    if (idx === undefined) return <span />
    const q = qualities?.[idx]
    const current = ply === idx + 1
    return (
      <button
        ref={current ? active : undefined}
        onClick={() => onSelect?.(idx + 1)}
        className={`flex min-h-7 items-center gap-1.5 rounded px-1.5 text-left font-semibold transition-colors duration-100 ${
          current ? 'bg-raise-2 text-fg' : 'text-fg-2 hover:bg-raise'
        }`}
      >
        {q && q !== 'best' && q !== 'excellent' && q !== 'good' && q !== 'forced' && <QualityIcon quality={q} size={16} />}
        <span style={q && ['brilliant', 'great', 'blunder', 'mistake', 'miss', 'inaccuracy'].includes(q) ? { color: qualityColor(q) } : undefined}>
          {sans[idx]}
        </span>
      </button>
    )
  }

  return (
    <div ref={box} className={`tabular overflow-y-auto text-[14px] ${className}`}>
      {rows.map((r, k) => (
        <div key={r.n} className={`grid grid-cols-[2.6rem_1fr_1fr] items-center gap-1 px-2 py-0.5 ${k % 2 ? 'bg-panel-2/40' : ''}`}>
          <span className="pl-1 text-fg-3">{r.n}.</span>
          {r.w !== undefined ? cell(r.w) : <span className="px-1.5 text-fg-3">…</span>}
          {cell(r.b)}
        </div>
      ))}
    </div>
  )
}

/** One-line, horizontally scrolling move list for phones. */
function MoveStripView({ sans, ply, onSelect, qualities, className = '' }: Omit<MoveListProps, 'startNumber' | 'blackFirst'>) {
  const box = useRef<HTMLDivElement>(null)
  const active = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const el = active.current
    const c = box.current
    if (!el || !c) return
    c.scrollTo({ left: el.offsetLeft - c.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
  }, [ply, sans.length])
  if (!sans.length) return null
  return (
    <div ref={box} className={`tabular flex items-center gap-0.5 overflow-x-auto whitespace-nowrap px-2 py-1.5 text-[14px] [scrollbar-width:none] ${className}`}>
      {sans.map((san, i) => {
        const q = qualities?.[i]
        const current = ply === i + 1
        return (
          <span key={i} className="flex items-center">
            {i % 2 === 0 && <span className="ml-1.5 mr-1 text-fg-3">{i / 2 + 1}.</span>}
            <button
              ref={current ? active : undefined}
              onClick={() => onSelect?.(i + 1)}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold ${current ? 'bg-raise-2 text-fg' : 'text-fg-2'}`}
            >
              {q && q !== 'best' && q !== 'excellent' && q !== 'good' && q !== 'forced' && <QualityIcon quality={q} size={14} />}
              {san}
            </button>
          </span>
        )
      })}
    </div>
  )
}
